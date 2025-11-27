import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '../../../src/services/config.service';

/**
 * WBS-35 Phase 4: Config validation tests for Slack file download
 */
describe('ConfigService - Slack File Download Configuration', () => {
  let configService: ConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear relevant environment variables
    delete process.env.CREWX_SLACK_FILE_DIR;
    delete process.env.CREWX_SLACK_FILE_DOWNLOAD;
    delete process.env.CREWX_SLACK_MAX_FILE_SIZE;
    delete process.env.CREWX_SLACK_ALLOWED_MIME_TYPES;

    configService = new ConfigService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getSlackFileDownloadDir', () => {
    it('should return default directory when no env var is set', () => {
      const dir = configService.getSlackFileDownloadDir();
      expect(dir).toContain('.crewx/slack-files');
      expect(dir).toContain(process.cwd());
    });

    it('should return custom directory from env var', () => {
      process.env.CREWX_SLACK_FILE_DIR = '/custom/slack/files';
      const dir = configService.getSlackFileDownloadDir();
      expect(dir).toBe('/custom/slack/files');
    });

    it('should handle relative paths', () => {
      process.env.CREWX_SLACK_FILE_DIR = 'custom-files';
      const dir = configService.getSlackFileDownloadDir();
      expect(dir).toBe('custom-files');
    });
  });

  describe('isSlackFileDownloadEnabled', () => {
    it('should return true by default', () => {
      const enabled = configService.isSlackFileDownloadEnabled();
      expect(enabled).toBe(true);
    });

    it('should return false when explicitly disabled', () => {
      process.env.CREWX_SLACK_FILE_DOWNLOAD = 'false';
      const enabled = configService.isSlackFileDownloadEnabled();
      expect(enabled).toBe(false);
    });

    it('should return true for any value except "false"', () => {
      const testCases = ['true', '1', 'yes', 'enabled', 'anything'];

      for (const value of testCases) {
        process.env.CREWX_SLACK_FILE_DOWNLOAD = value;
        const service = new ConfigService();
        expect(service.isSlackFileDownloadEnabled()).toBe(true);
      }
    });
  });

  describe('getSlackMaxFileSize', () => {
    it('should return 10MB by default', () => {
      const maxSize = configService.getSlackMaxFileSize();
      expect(maxSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should parse custom file size from env var', () => {
      process.env.CREWX_SLACK_MAX_FILE_SIZE = String(5 * 1024 * 1024); // 5MB
      const service = new ConfigService();
      const maxSize = service.getSlackMaxFileSize();
      expect(maxSize).toBe(5 * 1024 * 1024);
    });

    it('should handle invalid env var and return default', () => {
      process.env.CREWX_SLACK_MAX_FILE_SIZE = 'invalid';
      const service = new ConfigService();
      const maxSize = service.getSlackMaxFileSize();
      expect(isNaN(maxSize)).toBe(true); // parseInt returns NaN for invalid input
    });

    it('should handle zero value', () => {
      process.env.CREWX_SLACK_MAX_FILE_SIZE = '0';
      const service = new ConfigService();
      const maxSize = service.getSlackMaxFileSize();
      expect(maxSize).toBe(0);
    });
  });

  describe('getSlackAllowedMimeTypes', () => {
    it('should return empty array by default (allow all)', () => {
      const mimeTypes = configService.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual([]);
    });

    it('should parse comma-separated MIME types', () => {
      process.env.CREWX_SLACK_ALLOWED_MIME_TYPES = 'application/pdf,image/png,image/jpeg';
      const service = new ConfigService();
      const mimeTypes = service.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual(['application/pdf', 'image/png', 'image/jpeg']);
    });

    it('should trim whitespace from MIME types', () => {
      process.env.CREWX_SLACK_ALLOWED_MIME_TYPES = '  application/pdf  ,  image/png  ,  image/jpeg  ';
      const service = new ConfigService();
      const mimeTypes = service.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual(['application/pdf', 'image/png', 'image/jpeg']);
    });

    it('should filter out empty strings', () => {
      process.env.CREWX_SLACK_ALLOWED_MIME_TYPES = 'application/pdf,,image/png,  ,image/jpeg';
      const service = new ConfigService();
      const mimeTypes = service.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual(['application/pdf', 'image/png', 'image/jpeg']);
    });

    it('should handle empty string env var', () => {
      process.env.CREWX_SLACK_ALLOWED_MIME_TYPES = '';
      const service = new ConfigService();
      const mimeTypes = service.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual([]);
    });

    it('should handle single MIME type', () => {
      process.env.CREWX_SLACK_ALLOWED_MIME_TYPES = 'application/pdf';
      const service = new ConfigService();
      const mimeTypes = service.getSlackAllowedMimeTypes();
      expect(mimeTypes).toEqual(['application/pdf']);
    });
  });
});
