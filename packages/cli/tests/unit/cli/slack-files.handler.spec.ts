import { handleSlackFiles } from '../../../src/cli/slack-files.handler';
import { SlackFileDownloadService } from '../../../src/slack/services/slack-file-download.service';
import { ConfigService } from '../../../src/services/config.service';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../../src/slack/services/slack-file-download.service');
jest.mock('fs');

describe('SlackFilesHandler', () => {
  let mockApp: any;
  let mockConfigService: ConfigService;
  let mockFileDownloadService: any;
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original values
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];

    // Mock console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
      throw new Error(`process.exit: ${code}`);
    });

    // Mock ConfigService
    mockConfigService = {
      getSlackFileDownloadDir: jest.fn().mockReturnValue('.crewx/slack-files'),
    } as any;

    // Mock SlackFileDownloadService
    mockFileDownloadService = {
      downloadFile: jest.fn(),
      getThreadFilesMetadata: jest.fn(),
      getThreadFiles: jest.fn(),
    };

    (SlackFileDownloadService as any).mockImplementation(() => mockFileDownloadService);

    // Mock app
    mockApp = {
      get: jest.fn().mockImplementation((service: any) => {
        if (service === ConfigService) {
          return mockConfigService;
        }
        return null;
      }),
    };

    // Set SLACK_BOT_TOKEN
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    process.argv = originalArgv;

    // Restore mocks
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Environment validation', () => {
    it('should fail if SLACK_BOT_TOKEN is not set', async () => {
      delete process.env.SLACK_BOT_TOKEN;
      process.argv = ['node', 'crewx', 'slack:files', '--thread', '1234567890.123456'];

      await expect(handleSlackFiles(mockApp, {} as any)).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLACK_BOT_TOKEN environment variable not found')
      );
    });
  });

  describe('Download files (default behavior)', () => {
    it('should fail if --thread option is missing', async () => {
      process.argv = ['node', 'crewx', 'slack:files'];

      await expect(handleSlackFiles(mockApp, {} as any)).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('--thread option is required')
      );
    });

    it('should display help for download without thread ID', async () => {
      process.argv = ['node', 'crewx', 'slack:files'];

      await expect(handleSlackFiles(mockApp, {} as any)).rejects.toThrow('process.exit: 1');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: crewx slack:files --thread')
      );
    });
  });

  describe('List files (--list)', () => {
    it('should list files for specific thread', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--list', '--thread', '1234567890.123456'];

      mockFileDownloadService.getThreadFilesMetadata.mockResolvedValue([
        {
          fileName: 'test.pdf',
          fileSize: 1024,
          filePath: '.crewx/slack-files/1234567890.123456/test.pdf',
          downloadedAt: new Date('2025-01-01T00:00:00Z'),
        },
      ]);

      await handleSlackFiles(mockApp, {} as any);

      expect(mockFileDownloadService.getThreadFilesMetadata).toHaveBeenCalledWith('1234567890.123456');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Files in thread'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test.pdf'));
    });

    it('should list all files across all threads', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--list'];

      const mockReaddir = fs.readdirSync as jest.Mock;
      const mockStatSync = fs.statSync as jest.Mock;
      const mockExistsSync = fs.existsSync as jest.Mock;

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockReturnValue(['1234567890.123456', '1234567890.234567']);
      mockStatSync.mockReturnValue({ isDirectory: () => true });

      mockFileDownloadService.getThreadFilesMetadata
        .mockResolvedValueOnce([
          {
            fileName: 'file1.pdf',
            fileSize: 1024,
            filePath: '.crewx/slack-files/1234567890.123456/file1.pdf',
            downloadedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            fileName: 'file2.png',
            fileSize: 2048,
            filePath: '.crewx/slack-files/1234567890.234567/file2.png',
            downloadedAt: new Date(),
          },
        ]);

      await handleSlackFiles(mockApp, {} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All downloaded Slack files'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file1.pdf'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file2.png'));
    });

    it('should show message when no files are downloaded yet', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--list'];

      const mockExistsSync = fs.existsSync as jest.Mock;
      mockExistsSync.mockReturnValue(false);

      await handleSlackFiles(mockApp, {} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No files downloaded yet'));
    });
  });

  describe('Clean files (--clean)', () => {
    it('should clean files for specific thread', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--clean', '--thread', '1234567890.123456'];

      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockReaddir = fs.readdirSync as jest.Mock;
      const mockUnlink = fs.unlinkSync as jest.Mock;
      const mockRmdir = fs.rmdirSync as jest.Mock;

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockReturnValue(['file1.pdf', 'file2.png']);

      await handleSlackFiles(mockApp, {} as any);

      expect(mockUnlink).toHaveBeenCalledTimes(2);
      expect(mockRmdir).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned 2 files'));
    });

    it('should clean all files across all threads', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--clean'];

      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockReaddir = fs.readdirSync as jest.Mock;
      const mockStatSync = fs.statSync as jest.Mock;
      const mockUnlink = fs.unlinkSync as jest.Mock;
      const mockRmdir = fs.rmdirSync as jest.Mock;

      mockExistsSync.mockReturnValue(true);
      mockReaddir
        .mockReturnValueOnce(['1234567890.123456', '1234567890.234567']) // thread dirs
        .mockReturnValueOnce(['file1.pdf', 'file2.png']) // thread 1 files
        .mockReturnValueOnce(['file3.jpg']); // thread 2 files

      mockStatSync.mockReturnValue({ isDirectory: () => true });

      await handleSlackFiles(mockApp, {} as any);

      expect(mockUnlink).toHaveBeenCalledTimes(3); // 2 + 1 files
      expect(mockRmdir).toHaveBeenCalledTimes(2); // 2 thread dirs
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned 3 files from 2 threads'));
    });

    it('should show message when no files to clean', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--clean', '--thread', '1234567890.123456'];

      const mockExistsSync = fs.existsSync as jest.Mock;
      mockExistsSync.mockReturnValue(false);

      await handleSlackFiles(mockApp, {} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No files to clean'));
    });
  });

  describe('Command aliases', () => {
    it('should accept -t as alias for --thread', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--list', '-t', '1234567890.123456'];

      mockFileDownloadService.getThreadFilesMetadata.mockResolvedValue([]);

      await handleSlackFiles(mockApp, {} as any);

      expect(mockFileDownloadService.getThreadFilesMetadata).toHaveBeenCalledWith('1234567890.123456');
    });

    it('should accept -l as alias for --list', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '-l'];

      const mockExistsSync = fs.existsSync as jest.Mock;
      mockExistsSync.mockReturnValue(false);

      await handleSlackFiles(mockApp, {} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All downloaded Slack files'));
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      process.argv = ['node', 'crewx', 'slack:files', '--list', '--thread', '1234567890.123456'];

      mockFileDownloadService.getThreadFilesMetadata.mockRejectedValue(
        new Error('Service error')
      );

      await expect(handleSlackFiles(mockApp, {} as any)).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slack files command failed')
      );
    });
  });
});
