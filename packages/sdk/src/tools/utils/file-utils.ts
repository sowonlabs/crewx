/**
 * File utility functions for reading and processing files
 * Adapted from Gemini CLI for CrewX
 */

import path from 'node:path';
import type {
  FileSystemService,
  ProcessedFileReadResult,
  ToolErrorType,
} from '../types.js';

// Constants
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_LINE_LENGTH = 2000;
const DEFAULT_MAX_LINES = 2000;

// Image extensions
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
]);

// PDF extension
const PDF_EXTENSION = '.pdf';

/**
 * Detect BOM (Byte Order Mark) and return encoding
 */
function detectBOM(buffer: Buffer): {
  encoding: BufferEncoding;
  offset: number;
} {
  // UTF-8 BOM: EF BB BF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return { encoding: 'utf8', offset: 3 };
  }

  // UTF-16 BE BOM: FE FF
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf16le', offset: 2 };
  }

  // UTF-16 LE BOM: FF FE
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    // Check if it's UTF-32 LE (FF FE 00 00)
    if (buffer.length >= 4 && buffer[2] === 0x00 && buffer[3] === 0x00) {
      return { encoding: 'utf8', offset: 4 }; // Node.js doesn't support UTF-32, fallback to UTF-8
    }
    return { encoding: 'utf16le', offset: 2 };
  }

  // UTF-32 BE BOM: 00 00 FE FF
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0xfe &&
    buffer[3] === 0xff
  ) {
    return { encoding: 'utf8', offset: 4 }; // Node.js doesn't support UTF-32, fallback to UTF-8
  }

  // No BOM detected
  return { encoding: 'utf8', offset: 0 };
}

/**
 * Check if a file is binary by sampling the content
 */
function isBinaryFile(buffer: Buffer): boolean {
  const sampleSize = Math.min(8000, buffer.length);
  const sample = buffer.subarray(0, sampleSize);

  let nullBytes = 0;
  let suspiciousBytes = 0;

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === undefined) continue;

    // Count null bytes
    if (byte === 0) {
      nullBytes++;
    }

    // Count suspicious bytes (non-printable, non-whitespace)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspiciousBytes++;
    }
  }

  // If more than 1% null bytes or more than 10% suspicious bytes, it's binary
  return (
    nullBytes > sampleSize * 0.01 || suspiciousBytes > sampleSize * 0.1
  );
}

/**
 * Get MIME type for a file based on extension
 */
export function getSpecificMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Detect file type: text, image, pdf, or binary
 */
function detectFileType(
  filePath: string,
  buffer: Buffer,
): 'text' | 'image' | 'pdf' | 'binary' {
  const ext = path.extname(filePath).toLowerCase();

  // Check if it's an image
  if (IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }

  // Check if it's a PDF
  if (ext === PDF_EXTENSION) {
    return 'pdf';
  }

  // Check if it's binary
  if (isBinaryFile(buffer)) {
    return 'binary';
  }

  return 'text';
}

/**
 * Process a single file and return its content
 */
export async function processSingleFileContent(
  filePath: string,
  rootDirectory: string,
  fileSystemService: FileSystemService,
  offset?: number,
  limit?: number,
): Promise<ProcessedFileReadResult> {
  try {
    // Check if file exists
    const exists = await fileSystemService.exists(filePath);
    if (!exists) {
      return {
        llmContent: '',
        returnDisplay: `File not found: ${filePath}`,
        error: `File not found: ${filePath}`,
        errorType: 'FILE_NOT_FOUND' as ToolErrorType,
      };
    }

    // Check if it's a directory
    const stats = await fileSystemService.stat(filePath);
    if (stats.isDirectory) {
      return {
        llmContent: '',
        returnDisplay: `Path is a directory: ${filePath}`,
        error: `Path is a directory: ${filePath}`,
        errorType: 'PATH_IS_DIRECTORY' as ToolErrorType,
      };
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return {
        llmContent: '',
        returnDisplay: `File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`,
        error: `File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`,
        errorType: 'FILE_TOO_LARGE' as ToolErrorType,
      };
    }

    // Read file content
    const buffer = await fileSystemService.readFile(filePath);

    // Detect file type
    const fileType = detectFileType(filePath, buffer);

    // Handle binary files (images, PDFs)
    if (fileType === 'image' || fileType === 'pdf') {
      const base64Data = buffer.toString('base64');
      const mimeType = getSpecificMimeType(filePath);

      return {
        llmContent: {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
        returnDisplay: `Read ${fileType} file: ${path.basename(filePath)} (${stats.size} bytes)`,
      };
    }

    // Handle unknown binary files
    if (fileType === 'binary') {
      return {
        llmContent: '',
        returnDisplay: `Binary file detected: ${filePath}`,
        error: `Binary file detected: ${filePath}`,
        errorType: 'BINARY_FILE' as ToolErrorType,
      };
    }

    // Handle text files
    const { encoding, offset: bomOffset } = detectBOM(buffer);
    const content = buffer.subarray(bomOffset).toString(encoding);

    // Split into lines
    const lines = content.split('\n');

    // Apply offset and limit
    let startLine = offset || 0;
    let endLine = limit ? startLine + limit : lines.length;
    let isTruncated = false;

    // Apply default limit if no limit specified
    if (!limit && lines.length > DEFAULT_MAX_LINES) {
      endLine = DEFAULT_MAX_LINES;
      isTruncated = true;
    }

    // Ensure we don't exceed file length
    if (endLine > lines.length) {
      endLine = lines.length;
    } else if (endLine < lines.length) {
      isTruncated = true;
    }

    // Get the slice of lines
    const selectedLines = lines.slice(startLine, endLine);

    // Truncate long lines
    const truncatedLines = selectedLines.map((line) => {
      if (line.length > MAX_LINE_LENGTH) {
        return line.substring(0, MAX_LINE_LENGTH) + '...';
      }
      return line;
    });

    // Format output with line numbers
    const formattedContent = truncatedLines
      .map((line, i) => `${startLine + i + 1}→${line}`)
      .join('\n');

    const relativePath = path.relative(rootDirectory, filePath);

    return {
      llmContent: formattedContent,
      returnDisplay: `Read ${relativePath} (lines ${startLine + 1}-${endLine})`,
      isTruncated,
      originalLineCount: lines.length,
      linesShown: [startLine + 1, endLine],
    };
  } catch (error: any) {
    return {
      llmContent: '',
      returnDisplay: `Error reading file: ${error.message}`,
      error: error.message,
      errorType: 'UNKNOWN' as ToolErrorType,
    };
  }
}

/**
 * Make a path relative to a root directory
 */
export function makeRelative(absolutePath: string, rootDir: string): string {
  const relative = path.relative(rootDir, absolutePath);
  // If the path is outside the root, return the absolute path
  if (relative.startsWith('..')) {
    return absolutePath;
  }
  return relative;
}

/**
 * Shorten a path for display
 */
export function shortenPath(filePath: string, maxLength: number = 50): string {
  if (filePath.length <= maxLength) {
    return filePath;
  }

  // Split path into parts
  const parts = filePath.split(path.sep);

  // Always keep the filename
  const filename = parts[parts.length - 1];
  if (!filename) {
    return filePath; // Should not happen, but handle gracefully
  }

  // If filename alone is too long, truncate it
  if (filename.length > maxLength) {
    return '...' + filename.substring(filename.length - maxLength + 3);
  }

  // Try to fit as many directory parts as possible
  let shortened = filename;
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;
    const candidate = part + path.sep + shortened;
    if (candidate.length > maxLength) {
      return '...' + path.sep + shortened;
    }
    shortened = candidate;
  }

  return shortened;
}
