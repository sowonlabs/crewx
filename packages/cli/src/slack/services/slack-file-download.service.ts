import { Logger } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../../services/config.service';

export interface SlackFileMetadata {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  threadId: string;
  channelId: string;
  downloadedAt: Date;
}

export class SlackFileDownloadError extends Error {
  statusCode?: number;
  suggestion?: string;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      suggestion?: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'SlackFileDownloadError';
    this.statusCode = options.statusCode;
    this.suggestion = options.suggestion;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

/**
 * Service for downloading files from Slack and managing them locally
 */
export class SlackFileDownloadService {
  private readonly logger = new Logger(SlackFileDownloadService.name);
  private readonly downloadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly maxRetries = 3;
  private readonly baseBackoffMs = 500;
  private readonly networkTimeoutMs = 30000; // 30 seconds
  private readonly minDiskSpaceBytes = 100 * 1024 * 1024; // 100MB

  constructor(private readonly configService: ConfigService) {
    // Load configuration from ConfigService (WBS-35 Phase 4)
    this.downloadDir = this.configService.getSlackFileDownloadDir();
    this.maxFileSize = this.configService.getSlackMaxFileSize();
    this.allowedMimeTypes = this.configService.getSlackAllowedMimeTypes();
  }

  /**
   * Download a file from Slack and save it locally
   * Includes duplicate prevention (skip if file already exists)
   */
  async downloadFile(
    client: WebClient,
    fileId: string,
    fileName: string,
    threadId: string,
    channelId: string,
    userId: string,
  ): Promise<SlackFileMetadata> {
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const context = { fileId, fileName: sanitizedFileName, threadId, channelId, userId };

    try {
      // 0. Check if file download is enabled (WBS-35 Phase 4)
      if (!this.configService.isSlackFileDownloadEnabled()) {
        throw new SlackFileDownloadError('Slack file download is disabled.', {
          statusCode: 403,
          suggestion: 'Enable slackFileDownload in crewx config or set CREWX_SLACK_FILE_DOWNLOAD=1.',
          retryable: false,
          details: context,
        });
      }

      const startTime = Date.now();
      this.logInfo('download.start', context);

      // 1. Check disk space before downloading
      await this.checkDiskSpace(context);

      // 2. Get file info from Slack API (with retry + rate limiting awareness)
      const fileInfo = await this.getFileInfo(client, fileId, context);

      // 2. Validate file size and type early with contextual logging
      this.validateFileInfo(fileInfo, context);

      if (!fileInfo.url_private) {
        throw new SlackFileDownloadError('Slack did not return a private download URL for this file.', {
          statusCode: 403,
          suggestion: 'Ensure the bot has files:read scope and access to the channel.',
          retryable: false,
          details: context,
        });
      }

      // 3. Build save path with sanitized filename
      const savePath = path.join(this.downloadDir, threadId, sanitizedFileName);

      // 4. Duplicate prevention - check if file already exists
      if (fs.existsSync(savePath)) {
        const stats = fs.statSync(savePath);
        this.logInfo('download.skip_existing', {
          ...context,
          filePath: savePath,
          fileSize: stats.size,
        });

        return {
          fileId,
          fileName: sanitizedFileName,
          filePath: savePath,
          fileSize: stats.size,
          mimeType: fileInfo.mimetype,
          uploadedBy: userId,
          uploadedAt: new Date(fileInfo.timestamp * 1000),
          threadId,
          channelId,
          downloadedAt: new Date(stats.mtime),
        };
      }

      // 5. Download file from Slack private URL (with retry)
      const fileBuffer = await this.fetchFileFromSlack(fileInfo.url_private, client, context);

      // 6. Create directory if it doesn't exist
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true });

      // 7. Save file to disk
      await fs.promises.writeFile(savePath, fileBuffer);

      const downloadTimeMs = Date.now() - startTime;

      this.logInfo('download.complete', {
        ...context,
        filePath: savePath,
        fileSize: fileBuffer.length,
        mimeType: fileInfo.mimetype,
        downloadTimeMs,
        throughputKbps: Math.round((fileBuffer.length / 1024) / (downloadTimeMs / 1000)),
      });

      // 8. Return metadata
      return {
        fileId,
        fileName: sanitizedFileName,
        filePath: savePath,
        fileSize: fileBuffer.length,
        mimeType: fileInfo.mimetype,
        uploadedBy: userId,
        uploadedAt: new Date(fileInfo.timestamp * 1000),
        threadId,
        channelId,
        downloadedAt: new Date(),
      };
    } catch (error: any) {
      const normalizedError = this.normalizeError(error, context);
      this.logError('download.failed', normalizedError, context);
      throw normalizedError;
    }
  }

  /**
   * Download file from Slack private URL
   */
  private async fetchFileFromSlack(url: string, client: WebClient, context: Record<string, any>): Promise<Buffer> {
    return this.withRetry<Buffer>(
      'download.fetch',
      async attempt => {
        this.logInfo('download.fetch_attempt', { ...context, attempt });

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.networkTimeoutMs);

          try {
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${client.token}`,
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

          const retryAfter = Number(response.headers?.get?.('retry-after') ?? 0) * 1000 || undefined;

          if (response.status === 429) {
            throw new SlackFileDownloadError(
              'Slack rate limit exceeded while downloading the file. Please retry after waiting.',
              {
                statusCode: 429,
                suggestion: 'Wait briefly or reduce concurrent downloads.',
                retryable: true,
                details: { ...context, retryAfterMs: retryAfter },
              },
            );
          }

          if (response.status === 403) {
            throw new SlackFileDownloadError('Permission denied to download Slack file.', {
              statusCode: 403,
              suggestion: 'Ensure the bot has files:read scope and access to the channel where the file was shared.',
              retryable: false,
              details: context,
            });
          }

          if (response.status === 404) {
            throw new SlackFileDownloadError('File not found or no longer available on Slack.', {
              statusCode: 404,
              suggestion: 'Verify the file is still available and shared with the bot.',
              retryable: false,
              details: context,
            });
          }

          if (!response.ok) {
            throw new SlackFileDownloadError(
              `Slack responded with HTTP ${response.status} while downloading the file.`,
              {
                statusCode: response.status,
                suggestion: 'Try again later or verify Slack availability.',
                retryable: response.status >= 500,
                details: context,
              },
            );
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          this.logInfo('download.fetch_success', {
            ...context,
            attempt,
            fileSize: buffer.length,
          });
          return buffer;
          } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new SlackFileDownloadError(
                `Network timeout after ${this.networkTimeoutMs / 1000}s while downloading file.`,
                {
                  statusCode: 408,
                  suggestion: 'Check your network connection or increase timeout in configuration.',
                  retryable: true,
                  details: { ...context, timeoutMs: this.networkTimeoutMs },
                },
              );
            }
            throw error;
          }
        } catch (error) {
          throw this.normalizeError(error, context);
        }
      },
      context,
    );
  }

  /**
   * Sanitize filename to prevent path injection attacks (WBS-35 Phase 4 - Security)
   * Removes special characters and path separators
   * Prevents directory traversal attacks (e.g., ../../../etc/passwd)
   */
  private sanitizeFileName(fileName: string): string {
    // Remove path separators (/, \\) to prevent directory traversal
    let safeName = fileName.replace(/[\/\\]/g, '_');

    // Remove any dot-dot-slash patterns (., ..)
    safeName = safeName.replace(/\.\./g, '_');

    // Remove special characters (allow only alphanumeric, ., _, -, space)
    safeName = safeName.replace(/[^a-zA-Z0-9._\-\s]/g, '_');

    // Remove leading/trailing dots to prevent hidden files
    safeName = safeName.replace(/^\.+|\.+$/g, '');

    // Trim whitespace and ensure it's not empty
    safeName = safeName.trim();
    if (!safeName || safeName === '') {
      safeName = 'unnamed_file';
    }

    return safeName;
  }

  /**
   * Get all files in a thread directory
   * Returns array of file paths
   */
  async getThreadFiles(threadId: string): Promise<string[]> {
    const threadDir = path.join(this.downloadDir, threadId);

    try {
      if (!fs.existsSync(threadDir)) {
        return [];
      }

      const files = await fs.promises.readdir(threadDir);
      return files.map(f => path.join(threadDir, f));
    } catch (error: any) {
      this.logger.warn(`Failed to read thread files: ${error.message}`);
      return [];
    }
  }

  /**
   * Get file metadata for all files in a thread
   */
  async getThreadFilesMetadata(threadId: string): Promise<SlackFileMetadata[]> {
    const files = await this.getThreadFiles(threadId);
    const metadata: SlackFileMetadata[] = [];

    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        metadata.push({
          fileId: '', // Not available from local file
          fileName,
          filePath,
          fileSize: stats.size,
          mimeType: this.guessMimeType(fileName),
          uploadedBy: '', // Not available from local file
          uploadedAt: new Date(stats.birthtime),
          threadId,
          channelId: '', // Not available from local file
          downloadedAt: new Date(stats.mtime),
        });
      } catch (error: any) {
        this.logger.warn(`Failed to read file metadata: ${filePath}`);
      }
    }

    return metadata;
  }

  /**
   * Ensure file is downloaded (download if not exists)
   * Used for mid-conversation scenario (bot joins thread with existing files)
   */
  async ensureFileDownloaded(
    client: WebClient,
    fileId: string,
    fileName: string,
    threadId: string,
    channelId: string,
    userId: string,
  ): Promise<SlackFileMetadata> {
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const savePath = path.join(this.downloadDir, threadId, sanitizedFileName);

    // Check if file already exists
    if (fs.existsSync(savePath)) {
      const stats = fs.statSync(savePath);
      this.logger.debug(`📎 File already exists (ensureFileDownloaded): ${sanitizedFileName}`);

      return {
        fileId,
        fileName: sanitizedFileName,
        filePath: savePath,
        fileSize: stats.size,
        mimeType: this.guessMimeType(fileName),
        uploadedBy: userId,
        uploadedAt: new Date(stats.birthtime),
        threadId,
        channelId,
        downloadedAt: new Date(stats.mtime),
      };
    }

    // Download file
    return this.downloadFile(client, fileId, fileName, threadId, channelId, userId);
  }

  /**
   * Format file size for human-readable display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Guess MIME type from file extension (fallback)
   */
  private guessMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Validate MIME type against allowed types (WBS-35 Phase 4 - Security)
   * Returns true if mime type is allowed, false otherwise
   */
  private isAllowedMimeType(mimeType: string): boolean {
    // If no restrictions, allow all
    if (this.allowedMimeTypes.length === 0) {
      return true;
    }

    // Check exact match
    return this.allowedMimeTypes.includes(mimeType);
  }

  private async getFileInfo(client: WebClient, fileId: string, context: Record<string, any>): Promise<any> {
    return this.withRetry<any>(
      'files.info',
      async attempt => {
        this.logInfo('files.info_attempt', { ...context, attempt });

        const response = await client.files.info({ file: fileId });

        if (response && response.ok === false) {
          throw this.mapSlackErrorResponse(response, context);
        }

        const fileInfo = (response as any).file;
        if (!fileInfo) {
          throw new SlackFileDownloadError(`File not found: ${fileId}`, {
            statusCode: 404,
            suggestion: 'Confirm the file is still available and shared with the bot.',
            retryable: false,
            details: context,
          });
        }

        return fileInfo;
      },
      context,
    );
  }

  private mapSlackErrorResponse(response: any, context: Record<string, any>): SlackFileDownloadError {
    const errorCode = response?.error;

    if (errorCode === 'ratelimited') {
      const retryAfterMs = response?.retry_after ? Number(response.retry_after) * 1000 : undefined;
      return new SlackFileDownloadError('Slack rate limit exceeded while fetching file metadata.', {
        statusCode: 429,
        suggestion: 'Wait briefly or reduce concurrent downloads.',
        retryable: true,
        details: { ...context, retryAfterMs },
      });
    }

    if (errorCode === 'file_not_found') {
      return new SlackFileDownloadError('File not found on Slack.', {
        statusCode: 404,
        suggestion: 'Verify the file is still available and shared with the bot.',
        retryable: false,
        details: context,
      });
    }

    if (['not_authed', 'invalid_auth', 'account_inactive'].includes(errorCode)) {
      return new SlackFileDownloadError('Slack authentication failed while fetching file metadata.', {
        statusCode: 403,
        suggestion: 'Check Slack bot token validity and scopes (files:read).',
        retryable: false,
        details: context,
      });
    }

    return new SlackFileDownloadError(`Slack API error: ${errorCode || 'unknown_error'}`, {
      statusCode: 500,
      suggestion: 'Try again later or check Slack API availability.',
      retryable: true,
      details: context,
    });
  }

  private validateFileInfo(fileInfo: any, context: Record<string, any>): void {
    if (fileInfo.size > this.maxFileSize) {
      throw new SlackFileDownloadError(
        `File too large: ${this.formatFileSize(fileInfo.size)} (max: ${this.formatFileSize(this.maxFileSize)})`,
        {
          statusCode: 413,
          suggestion: 'Reduce the file size or raise CREWX_SLACK_MAX_FILE_SIZE if appropriate.',
          retryable: false,
          details: { ...context, fileSize: fileInfo.size },
        },
      );
    }

    if (!this.isAllowedMimeType(fileInfo.mimetype)) {
      throw new SlackFileDownloadError(`File type not allowed: ${fileInfo.mimetype}`, {
        statusCode: 415,
        suggestion: `Allowed MIME types: ${this.allowedMimeTypes.join(', ')}`,
        retryable: false,
        details: context,
      });
    }

    this.logInfo('download.validation_passed', {
      ...context,
      fileSize: fileInfo.size,
      mimeType: fileInfo.mimetype,
    });
  }

  private async withRetry<T>(
    operation: string,
    fn: (attempt: number) => Promise<T>,
    context: Record<string, any>,
  ): Promise<T> {
    let delayMs = this.baseBackoffMs;
    let lastError: SlackFileDownloadError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        const normalizedError = this.normalizeError(error, context);
        lastError = normalizedError;
        const isClientError =
          normalizedError.statusCode !== undefined &&
          normalizedError.statusCode >= 400 &&
          normalizedError.statusCode < 500 &&
          normalizedError.statusCode !== 429;
        const shouldRetry = normalizedError.retryable && !isClientError && attempt < this.maxRetries;

        if (!shouldRetry) {
          throw normalizedError;
        }

        const backoffMs = normalizedError.details?.retryAfterMs
          ? Number(normalizedError.details.retryAfterMs)
          : delayMs;

        this.logWarn('download.retry', {
          ...context,
          operation,
          attempt,
          nextDelayMs: backoffMs,
          statusCode: normalizedError.statusCode,
          message: normalizedError.message,
        });

        await this.delay(backoffMs);
        delayMs *= 2; // Exponential backoff
      }
    }

    throw lastError ?? new SlackFileDownloadError(`${operation} failed`, { retryable: false });
  }

  private normalizeError(error: any, context: Record<string, any>): SlackFileDownloadError {
    if (error instanceof SlackFileDownloadError) {
      return error;
    }

    const statusCode = (error as any)?.status ?? (error as any)?.statusCode;
    const slackErrorCode = (error as any)?.data?.error;

    if (slackErrorCode === 'ratelimited') {
      const retryAfterMs = (error as any)?.data?.retry_after ? Number((error as any).data.retry_after) * 1000 : undefined;
      return new SlackFileDownloadError('Slack rate limit exceeded. Please wait and retry.', {
        statusCode: 429,
        suggestion: 'Wait briefly or reduce request frequency.',
        retryable: true,
        details: { ...context, retryAfterMs },
      });
    }

    if (slackErrorCode === 'file_not_found') {
      return new SlackFileDownloadError('File not found on Slack.', {
        statusCode: 404,
        suggestion: 'Verify the file is still available and shared with the bot.',
        retryable: false,
        details: context,
      });
    }

    if (statusCode === 403 || slackErrorCode === 'not_authed' || slackErrorCode === 'invalid_auth') {
      return new SlackFileDownloadError('Slack authentication failed while downloading the file.', {
        statusCode: 403,
        suggestion: 'Confirm the bot token is valid and has files:read scope.',
        retryable: false,
        details: context,
      });
    }

    if (statusCode === 404) {
      return new SlackFileDownloadError('File not found or no longer available on Slack.', {
        statusCode: 404,
        suggestion: 'Verify the file is still available and shared with the bot.',
        retryable: false,
        details: context,
      });
    }

    if (statusCode === 429) {
      return new SlackFileDownloadError('Slack rate limit exceeded. Please wait and retry.', {
        statusCode: 429,
        suggestion: 'Wait briefly or reduce request frequency.',
        retryable: true,
        details: context,
      });
    }

    if (statusCode !== undefined) {
      return new SlackFileDownloadError(`Slack API request failed with status ${statusCode}.`, {
        statusCode,
        suggestion: statusCode >= 500 ? 'Retry after a short delay.' : 'Check Slack permissions or file availability.',
        retryable: statusCode >= 500,
        details: context,
      });
    }

    return new SlackFileDownloadError('Network error while communicating with Slack.', {
      suggestion: 'Check your network connection and try again.',
      retryable: true,
      details: context,
    });
  }

  private logInfo(event: string, context: Record<string, any>): void {
    this.logger.log(`${event} | ${JSON.stringify(context)}`);
  }

  private logWarn(event: string, context: Record<string, any>): void {
    this.logger.warn(`${event} | ${JSON.stringify(context)}`);
  }

  private logError(event: string, error: SlackFileDownloadError, context: Record<string, any>): void {
    const payload = {
      ...context,
      statusCode: error.statusCode,
      suggestion: error.suggestion,
    };

    this.logger.error(`${event} | ${error.message} | ${JSON.stringify(payload)}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if there is sufficient disk space for downloading files
   * Throws error if disk space is below minimum threshold
   */
  private async checkDiskSpace(context: Record<string, any>): Promise<void> {
    try {
      const stats = await fs.promises.statfs(this.downloadDir);
      const availableSpace = stats.bavail * stats.bsize;

      this.logInfo('disk_space.check', {
        ...context,
        availableBytes: availableSpace,
        availableMB: Math.round(availableSpace / (1024 * 1024)),
        minRequiredBytes: this.minDiskSpaceBytes,
      });

      if (availableSpace < this.minDiskSpaceBytes) {
        throw new SlackFileDownloadError(
          `Insufficient disk space: ${this.formatFileSize(availableSpace)} available (minimum: ${this.formatFileSize(this.minDiskSpaceBytes)})`,
          {
            statusCode: 507,
            suggestion: 'Free up disk space or configure a different download directory.',
            retryable: false,
            details: { ...context, availableBytes: availableSpace },
          },
        );
      }
    } catch (error: any) {
      // If statfs is not available (some environments), log warning and continue
      if (error.code === 'ENOENT') {
        // Directory doesn't exist yet - will be created later
        return;
      }
      if (error instanceof SlackFileDownloadError) {
        throw error;
      }
      this.logWarn('disk_space.check_failed', {
        ...context,
        error: error.message,
        suggestion: 'Disk space check unavailable - continuing anyway',
      });
    }
  }
 }
