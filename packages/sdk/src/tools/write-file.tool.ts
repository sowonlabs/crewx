/**
 * write_file tool for CrewX API Provider
 * Creates or overwrites a file with specified content
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * write_file tool definition
 *
 * Creates a new file or overwrites an existing file with the provided content.
 */
export const writeFileTool = createTool({
  id: 'write_file',
  description: `Creates a new file or overwrites an existing file with the provided content. Use with caution as this will replace existing files without warning.`,

  inputSchema: z.object({
    file_path: z
      .string()
      .describe('The path to the file to create or overwrite.'),
    content: z
      .string()
      .describe('The content to write to the file.'),
  }),

  outputSchema: z.string().describe('Success message or error'),

  execute: async ({ context }) => {
    const { file_path, content } = context;

    // Validation
    if (file_path.trim() === '') {
      throw new Error("The 'file_path' parameter must be non-empty.");
    }

    const resolvedPath = path.resolve(file_path);

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(resolvedPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Check if file exists to provide appropriate message
      let fileExists = false;
      try {
        await fs.access(resolvedPath);
        fileExists = true;
      } catch {
        // File doesn't exist, which is fine
      }

      // Write file
      await fs.writeFile(resolvedPath, content, 'utf-8');

      const action = fileExists ? 'Updated' : 'Created';
      const size = Buffer.byteLength(content, 'utf-8');
      return `${action} file: ${file_path} (${size} bytes)`;
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${file_path}`);
      }
      if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory: ${file_path}`);
      }
      throw error;
    }
  },
});
