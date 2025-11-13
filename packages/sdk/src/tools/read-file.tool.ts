/**
 * read_file tool for CrewX API Provider
 * Adapted from Gemini CLI for Mastra framework
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import type { ToolExecutionContext } from '../types/api-provider.types.js';
import type { FileSystemService } from './types.js';
import {
  processSingleFileContent,
  makeRelative,
  shortenPath,
} from './utils/file-utils.js';
import { StandardFileSystemService } from './file-system.service.js';

/**
 * read_file tool definition
 *
 * Reads and returns the content of a specified file.
 * Handles text, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files.
 */
export const readFileTool = createTool({
  id: 'read_file',
  description: `Reads and returns the content of a specified file. If the file is large, the content will be truncated. The tool's response will clearly indicate if truncation has occurred and will provide details on how to read more of the file using the 'offset' and 'limit' parameters. Handles text, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files. For text files, it can read specific line ranges.`,

  inputSchema: z.object({
    file_path: z
      .string()
      .describe('The path to the file to read.'),
    offset: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        "Optional: For text files, the 0-based line number to start reading from. Use for paginating through large files.",
      ),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Optional: For text files, maximum number of lines to read. Use with 'offset' to paginate through large files.",
      ),
  }),

  outputSchema: z.string().describe('The file content or error message'),

  execute: async ({ context }) => {
    const { file_path, offset, limit } = context;
    // Validation
    if (file_path.trim() === '') {
      throw new Error("The 'file_path' parameter must be non-empty.");
    }

    // Get working directory - default to process.cwd() if not set
    const targetDir = process.cwd();
    const resolvedPath = path.resolve(file_path);

    // For this initial implementation, we allow reading any file
    // TODO: Add proper workspace boundary checks based on context.agent configuration

    // Create file system service
    const fileSystemService: FileSystemService = new StandardFileSystemService();

    // Execute file read
    const result = await processSingleFileContent(
      resolvedPath,
      targetDir,
      fileSystemService,
      offset,
      limit,
    );

    if (result.error) {
      throw new Error(result.error);
    }

    // Format content
    if (typeof result.llmContent === 'string') {
      // Text file
      if (result.isTruncated) {
        const [start, end] = result.linesShown!;
        const total = result.originalLineCount!;
        const nextOffset = offset ? offset + end - start + 1 : end;

        return `IMPORTANT: The file content has been truncated.
Status: Showing lines ${start}-${end} of ${total} total lines.
Action: To read more of the file, you can use the 'offset' and 'limit' parameters in a subsequent 'read_file' call. For example, to read the next section of the file, use offset: ${nextOffset}.

--- FILE CONTENT (truncated) ---
${result.llmContent}`;
      }

      return result.llmContent;
    }

    // Binary file (image/PDF)
    const relativePath2 = makeRelative(resolvedPath, targetDir);
    const inlineData = (result.llmContent as any).inlineData;

    return `File read successfully: ${shortenPath(relativePath2)}
Type: ${inlineData.mimeType}
Size: ${Buffer.from(inlineData.data, 'base64').length} bytes

Note: Binary content (image/PDF) has been loaded. The agent can work with this file.
Base64 data: ${inlineData.data.substring(0, 100)}...`;
  },
});
