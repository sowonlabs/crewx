import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackFileDownloadService, SlackFileDownloadError } from '../../../src/slack/services/slack-file-download.service';
import { ConfigService } from '../../../src/services/config.service';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('fs/promises');

describe('SlackFileDownloadService - Error Handling & Logging', () => {
  let service: SlackFileDownloadService;
  let mockConfigService: ConfigService;
  let mockClient: WebClient;

  beforeEach(() => {
    // Mock ConfigService
    mockConfigService = {
      getSlackFileDownloadDir: vi.fn(() => '.crewx/slack-files'),
      getSlackMaxFileSize: vi.fn(() => 10 * 1024 * 1024), // 10MB
      getSlackAllowedMimeTypes: vi.fn(() => []),
      isSlackFileDownloadEnabled: vi.fn(() => true),
    } as any;

    // Mock WebClient
    mockClient = {
      token: 'xoxb-test-token',
      files: {
        info: vi.fn(),
      },
    } as any;

    service = new SlackFileDownloadService(mockConfigService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rate Limiting (429 errors)', () => {
    it('should handle 429 rate limit from Slack API with retry', async () => {
      const mockFileInfo = {
        ok: false,
        error: 'ratelimited',
        retry_after: 2,
      };

      mockClient.files.info = vi
        .fn()
        .mockResolvedValueOnce(mockFileInfo)
        .mockResolvedValueOnce({
          ok: true,
          file: {
            id: 'F123',
            name: 'test.pdf',
            size: 1024,
            mimetype: 'application/pdf',
            timestamp: 1234567890,
            url_private: 'https://files.slack.com/test.pdf',
          },
        });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });
      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();
      expect(mockClient.files.info).toHaveBeenCalledTimes(2);
    });

    it('should handle 429 rate limit from fetch with retry-after header', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: {
            get: (name: string) => (name === 'retry-after' ? '3' : null),
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1024),
        });

      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on persistent rate limiting', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: false,
        error: 'ratelimited',
        retry_after: 1,
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(SlackFileDownloadError);

      expect(mockClient.files.info).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Network Timeout Handling', () => {
    it('should timeout after 30 seconds and throw error', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/Network timeout after 30s/);
    });

    it('should retry on network timeout', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1024),
        });

      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('File Access Permission Errors', () => {
    it('should handle 403 permission denied error', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/Permission denied/);
    });

    it('should handle invalid_auth error from Slack API', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/authentication failed/);
    });
  });

  describe('Invalid File URL/ID Errors', () => {
    it('should handle file_not_found error', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: false,
        error: 'file_not_found',
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/File not found/);
    });

    it('should handle 404 error from fetch', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/File not found/);
    });

    it('should handle missing url_private field', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: null, // Missing private URL
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/did not return a private download URL/);
    });
  });

  describe('Disk Space Errors', () => {
    it('should throw error when disk space is insufficient', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000, // Very small
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/Insufficient disk space/);
    });

    it('should continue if disk space check fails (directory not exists)', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const enoentError = new Error('Directory not found');
      (enoentError as any).code = 'ENOENT';
      vi.spyOn(fs.promises, 'statfs').mockRejectedValue(enoentError);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();
    });
  });

  describe('File Size and Type Validation', () => {
    it('should throw error for files exceeding size limit', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'huge.pdf',
          size: 50 * 1024 * 1024, // 50MB
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'huge.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/File too large/);
    });

    it('should throw error for disallowed MIME types', async () => {
      // Override config to restrict MIME types
      mockConfigService.getSlackAllowedMimeTypes = vi.fn(() => ['image/png', 'image/jpeg']);
      service = new SlackFileDownloadService(mockConfigService);

      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf', // Not allowed
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/File type not allowed/);
    });
  });

  describe('Structured Logging and Performance Metrics', () => {
    it('should log download start, success, and metrics', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      const loggerSpy = vi.spyOn((service as any).logger, 'log');

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();

      // Verify structured logging
      const logCalls = loggerSpy.mock.calls.map(call => call[0]);
      expect(logCalls.some((log: string) => log.includes('download.start'))).toBe(true);
      expect(logCalls.some((log: string) => log.includes('download.complete'))).toBe(true);
      expect(logCalls.some((log: string) => log.includes('downloadTimeMs'))).toBe(true);
      expect(logCalls.some((log: string) => log.includes('throughputKbps'))).toBe(true);
    });

    it('should log skip when file already exists', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({
        size: 1024,
        mtime: new Date(),
      } as any);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.pdf',
          size: 1024,
          mimetype: 'application/pdf',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      const loggerSpy = vi.spyOn((service as any).logger, 'log');

      const result = await service.downloadFile(
        mockClient,
        'F123',
        'test.pdf',
        'thread123',
        'channel123',
        'user123',
      );

      expect(result).toBeDefined();

      const logCalls = loggerSpy.mock.calls.map(call => call[0]);
      expect(logCalls.some((log: string) => log.includes('download.skip_existing'))).toBe(true);
    });

    it('should log errors with context', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: false,
        error: 'file_not_found',
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      const loggerSpy = vi.spyOn((service as any).logger, 'error');

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalled();
      const errorLog = loggerSpy.mock.calls[0][0];
      expect(errorLog).toContain('download.failed');
      expect(errorLog).toContain('fileId');
    });
  });

  describe('Disabled File Download', () => {
    it('should throw error when file download is disabled', async () => {
      mockConfigService.isSlackFileDownloadEnabled = vi.fn(() => false);
      service = new SlackFileDownloadService(mockConfigService);

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        service.downloadFile(mockClient, 'F123', 'test.pdf', 'thread123', 'channel123', 'user123'),
      ).rejects.toThrow(/Slack file download is disabled/);
    });
  });

  describe('Path Sanitization Security', () => {
    it('should sanitize malicious file paths', async () => {
      mockClient.files.info = vi.fn().mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: '../../../etc/passwd',
          size: 1024,
          mimetype: 'text/plain',
          timestamp: 1234567890,
          url_private: 'https://files.slack.com/test.pdf',
        },
      });

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs.promises, 'statfs').mockResolvedValue({
        bavail: 1000000,
        bsize: 4096,
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      const result = await service.downloadFile(
        mockClient,
        'F123',
        '../../../etc/passwd',
        'thread123',
        'channel123',
        'user123',
      );

      // Verify sanitized filename doesn't contain path traversal
      expect(result.fileName).not.toContain('..');
      expect(result.fileName).not.toContain('/');
      expect(result.filePath).toContain('.crewx/slack-files/thread123');
      expect(writeFileSpy).toHaveBeenCalled();
      const writePath = writeFileSpy.mock.calls[0][0] as string;
      expect(writePath).not.toContain('../../../etc');
    });
  });
});
