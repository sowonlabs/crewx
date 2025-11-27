import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
    },
  };
});
import { SlackFileDownloadService } from '../../../src/slack/services/slack-file-download.service';
import { ConfigService } from '../../../src/services/config.service';
import * as fs from 'fs';
import * as path from 'path';

describe('SlackFileDownloadService', () => {
  let service: SlackFileDownloadService;
  let configService: ConfigService;
  let mockClient: any;
  let existsSyncSpy: ReturnType<typeof vi.fn>;
  let statSyncSpy: ReturnType<typeof vi.fn>;
  let mkdirSpy: ReturnType<typeof vi.fn>;
  let writeFileSpy: ReturnType<typeof vi.fn>;
  let readdirSpy: ReturnType<typeof vi.fn>;
  let loggerMock: {
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  const originalFetch = (global as any).fetch;

  beforeEach(() => {
    existsSyncSpy = fs.existsSync as unknown as vi.Mock;
    statSyncSpy = fs.statSync as unknown as vi.Mock;
    mkdirSpy = fs.promises.mkdir as unknown as vi.Mock;
    writeFileSpy = fs.promises.writeFile as unknown as vi.Mock;
    readdirSpy = fs.promises.readdir as unknown as vi.Mock;

    existsSyncSpy.mockReset();
    statSyncSpy.mockReset();
    mkdirSpy.mockReset();
    writeFileSpy.mockReset();
    readdirSpy.mockReset();

    existsSyncSpy.mockReturnValue(false);
    mkdirSpy.mockResolvedValue(undefined as any);
    writeFileSpy.mockResolvedValue(undefined as any);
    readdirSpy.mockResolvedValue([] as any);

    // Mock ConfigService
    configService = {
      getSlackFileDownloadDir: vi.fn().mockReturnValue('/tmp/.crewx/slack-files'),
      getSlackMaxFileSize: vi.fn().mockReturnValue(10 * 1024 * 1024),
      getSlackAllowedMimeTypes: vi.fn().mockReturnValue([]),
      isSlackFileDownloadEnabled: vi.fn().mockReturnValue(true),
    } as any;

    service = new SlackFileDownloadService(configService);
    loggerMock = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    (service as any).logger = loggerMock;

    // Mock Slack WebClient
    mockClient = {
      token: 'xoxb-mock-token',
      files: {
        info: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    (global as any).fetch = originalFetch;
  });

  const createFetchResponse = (status: number, size = 16, retryAfter?: number) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'mock',
    headers: {
      get: (key: string) => (key.toLowerCase() === 'retry-after' && retryAfter ? String(retryAfter) : undefined),
    },
    arrayBuffer: async () => new Uint8Array(size).buffer,
  });

  describe('sanitizeFileName', () => {
    it('should remove path separators', () => {
      const result = (service as any).sanitizeFileName('../../etc/passwd');
      expect(result).toBe('____etc_passwd');
    });

    it('should remove special characters', () => {
      const result = (service as any).sanitizeFileName('file<>:"|?*.txt');
      expect(result).toBe('file_______.txt');
    });

    it('should preserve alphanumeric, dots, dashes, and underscores', () => {
      const result = (service as any).sanitizeFileName('my-file_v2.0.txt');
      expect(result).toBe('my-file_v2.0.txt');
    });

    it('should handle empty filenames', () => {
      const result = (service as any).sanitizeFileName('');
      expect(result).toBe('unnamed_file');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      const result = (service as any).formatFileSize(500);
      expect(result).toBe('500B');
    });

    it('should format kilobytes', () => {
      const result = (service as any).formatFileSize(1536);
      expect(result).toBe('1.5KB');
    });

    it('should format megabytes', () => {
      const result = (service as any).formatFileSize(5242880);
      expect(result).toBe('5.0MB');
    });
  });

  describe('guessMimeType', () => {
    it('should guess PDF mime type', () => {
      const result = (service as any).guessMimeType('document.pdf');
      expect(result).toBe('application/pdf');
    });

    it('should guess PNG mime type', () => {
      const result = (service as any).guessMimeType('image.png');
      expect(result).toBe('image/png');
    });

    it('should guess JPEG mime type', () => {
      const result = (service as any).guessMimeType('photo.jpg');
      expect(result).toBe('image/jpeg');
    });

    it('should return default for unknown extensions', () => {
      const result = (service as any).guessMimeType('file.xyz');
      expect(result).toBe('application/octet-stream');
    });
  });

  describe('downloadFile', () => {
    it('should validate file size', async () => {
      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123456',
          name: 'large-file.pdf',
          size: 20 * 1024 * 1024, // 20MB (exceeds 10MB limit)
          mimetype: 'application/pdf',
          timestamp: Date.now() / 1000,
          url_private: 'https://files.slack.com/files-pri/T123/large-file.pdf',
        },
      });

      await expect(
        service.downloadFile(mockClient, 'F123456', 'large-file.pdf', '123456.789', 'C123', 'U123')
      ).rejects.toThrow('File too large');
    });

    it('should skip download if file already exists', async () => {
      // Mock file exists
      existsSyncSpy.mockReturnValue(true);
      statSyncSpy.mockReturnValue({
        size: 1024,
        mtime: new Date(),
        birthtime: new Date(),
      } as any);

      mockClient.files.info.mockResolvedValue({
        file: {
        id: 'F123456',
        name: 'existing-file.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        timestamp: Date.now() / 1000,
        url_private: 'https://files.slack.com/files-pri/T123/existing-file.pdf',
      },
    });

      const result = await service.downloadFile(
        mockClient,
        'F123456',
        'existing-file.pdf',
        '123456.789',
        'C123',
        'U123'
      );

      expect(result.fileName).toBe('existing-file.pdf');
      expect(result.fileSize).toBe(1024);
      expect(mockClient.files.info).toHaveBeenCalledWith({ file: 'F123456' });
    });

    it('should fail fast with clear message for invalid MIME type', async () => {
      (service as any).allowedMimeTypes = ['application/pdf'];

      mockClient.files.info.mockResolvedValue({
        file: {
          id: 'F123456',
          name: 'image.png',
          size: 1024,
          mimetype: 'image/png',
          timestamp: Date.now() / 1000,
          url_private: 'https://files.slack.com/files-pri/T123/image.png',
        },
      });

      await expect(
        service.downloadFile(mockClient, 'F123456', 'image.png', '123456.789', 'C123', 'U123')
      ).rejects.toThrow('File type not allowed');
    });

    it('should retry on rate limits and eventually succeed', async () => {
      const fileInfo = {
        id: 'F123456',
        name: 'file.pdf',
        size: 2048,
        mimetype: 'application/pdf',
        timestamp: Date.now() / 1000,
        url_private: 'https://files.slack.com/files-pri/T123/file.pdf',
      } as any;
      mockClient.files.info.mockResolvedValue({ file: fileInfo });
      existsSyncSpy.mockReturnValue(false);
      mkdirSpy.mockResolvedValue(undefined as any);
      writeFileSpy.mockResolvedValue(undefined as any);

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createFetchResponse(429, 0, 1))
        .mockResolvedValueOnce(createFetchResponse(429, 0, 1))
        .mockResolvedValue(createFetchResponse(200, 32));
      (global as any).fetch = fetchMock;

      const delaySpy = vi.spyOn<any, any>(service as any, 'delay').mockResolvedValue(undefined as any);

      const result = await service.downloadFile(mockClient, 'F123456', 'file.pdf', '123456.789', 'C123', 'U123');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(result.fileSize).toBe(32);
    });

    it('should not retry on permission errors', async () => {
      const fileInfo = {
        id: 'F123456',
        name: 'file.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        timestamp: Date.now() / 1000,
        url_private: 'https://files.slack.com/files-pri/T123/file.pdf',
      } as any;
      mockClient.files.info.mockResolvedValue({ file: fileInfo });
      existsSyncSpy.mockReturnValue(false);
      (global as any).fetch = vi.fn().mockResolvedValue(createFetchResponse(403));

      const delaySpy = vi.spyOn<any, any>(service as any, 'delay').mockResolvedValue(undefined as any);

      await expect(
        service.downloadFile(mockClient, 'F123456', 'file.pdf', '123456.789', 'C123', 'U123')
      ).rejects.toThrow('Permission denied');

      expect((global as any).fetch).toHaveBeenCalledTimes(1);
      expect(delaySpy).not.toHaveBeenCalled();
    });

    it('should retry network failures and surface a user-friendly message', async () => {
      const fileInfo = {
        id: 'F123456',
        name: 'file.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        timestamp: Date.now() / 1000,
        url_private: 'https://files.slack.com/files-pri/T123/file.pdf',
      } as any;
      mockClient.files.info.mockResolvedValue({ file: fileInfo });
      existsSyncSpy.mockReturnValue(false);
      (global as any).fetch = vi.fn().mockRejectedValue(new Error('network down'));

      const delaySpy = vi.spyOn<any, any>(service as any, 'delay').mockResolvedValue(undefined as any);

      await expect(
        service.downloadFile(mockClient, 'F123456', 'file.pdf', '123456.789', 'C123', 'U123')
      ).rejects.toThrow('Network error while communicating with Slack.');

      expect((global as any).fetch).toHaveBeenCalledTimes(3);
      expect(delaySpy).toHaveBeenCalledTimes(2);
    });

    it('should log download start and completion', async () => {
      const fileInfo = {
        id: 'F123456',
        name: 'file.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        timestamp: Date.now() / 1000,
        url_private: 'https://files.slack.com/files-pri/T123/file.pdf',
      } as any;
      mockClient.files.info.mockResolvedValue({ file: fileInfo });
      existsSyncSpy.mockReturnValue(false);
      mkdirSpy.mockResolvedValue(undefined as any);
      writeFileSpy.mockResolvedValue(undefined as any);
      (global as any).fetch = vi.fn().mockResolvedValue(createFetchResponse(200, 24));

      await service.downloadFile(mockClient, 'F123456', 'file.pdf', '123456.789', 'C123', 'U123');

      const logMessages = loggerMock.log.mock.calls.map(call => String(call[0]));
      expect(logMessages.some(msg => msg.includes('download.start'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('download.complete'))).toBe(true);
    });
  });

  describe('getThreadFiles', () => {
    it('should return empty array if directory does not exist', async () => {
      existsSyncSpy.mockReturnValue(false);

      const result = await service.getThreadFiles('123456.789');
      expect(result).toEqual([]);
    });

    it('should return file paths for existing directory', async () => {
      existsSyncSpy.mockReturnValue(true);
      readdirSpy.mockResolvedValue(['file1.pdf', 'file2.png'] as any);

      const result = await service.getThreadFiles('123456.789');
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('file1.pdf');
      expect(result[1]).toContain('file2.png');
    });
  });

  describe('ensureFileDownloaded', () => {
    it('should return metadata if file already exists', async () => {
      existsSyncSpy.mockReturnValue(true);
      statSyncSpy.mockReturnValue({
        size: 2048,
        mtime: new Date(),
        birthtime: new Date(),
      } as any);

      const result = await service.ensureFileDownloaded(
        mockClient,
        'F123456',
        'existing-file.pdf',
        '123456.789',
        'C123',
        'U123'
      );

      expect(result.fileName).toBe('existing-file.pdf');
      expect(result.fileSize).toBe(2048);
    });
  });

  describe('security validations', () => {
    it('should prevent path injection with sanitized filenames', () => {
      const maliciousNames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\sam',
      ];

      for (const name of maliciousNames) {
        const sanitized = (service as any).sanitizeFileName(name);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
      }
    });

    it('should enforce file size limits', async () => {
      const largeSizes = [15 * 1024 * 1024, 50 * 1024 * 1024, 100 * 1024 * 1024];

      for (const size of largeSizes) {
        mockClient.files.info.mockResolvedValue({
          file: {
            id: 'F123456',
            name: 'large.pdf',
            size,
            mimetype: 'application/pdf',
            timestamp: Date.now() / 1000,
          },
        });

        await expect(
          service.downloadFile(mockClient, 'F123456', 'large.pdf', '123456.789', 'C123', 'U123')
        ).rejects.toThrow('File too large');
      }
    });
  });
});
