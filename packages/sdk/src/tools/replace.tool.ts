/**
 * replace tool for CrewX API Provider
 * Modifies file content by replacing specific line ranges
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * replace (edit) tool definition
 *
 * Modifies file content by replacing a range of lines with new text.
 */
export const replaceTool = createTool({
  id: 'replace',
  description: `Replaces a range of lines in a file with new text. Useful for editing existing files. Requires start_line, end_line, and new_text parameters. Line numbers are 1-based.`,

  inputSchema: z.object({
    file_path: z
      .string()
      .describe('The path to the file to modify.'),
    start_line: z
      .number()
      .int()
      .positive()
      .describe('The starting line number to replace (1-based, inclusive).'),
    end_line: z
      .number()
      .int()
      .positive()
      .describe('The ending line number to replace (1-based, inclusive).'),
    new_text: z
      .string()
      .describe('The new text to insert in place of the specified lines.'),
  }),

  outputSchema: z.string().describe('Success message or error'),

  execute: async ({ context }) => {
    const { file_path, start_line, end_line, new_text } = context;

    // Validation
    if (file_path.trim() === '') {
      throw new Error("The 'file_path' parameter must be non-empty.");
    }

    if (start_line > end_line) {
      throw new Error(`Invalid line range: start_line (${start_line}) must be <= end_line (${end_line}).`);
    }

    const resolvedPath = path.resolve(file_path);

    try {
      // Check if file exists
      await fs.access(resolvedPath);

      // Read file content
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');

      // Validate line numbers
      if (start_line < 1 || start_line > lines.length) {
        throw new Error(`start_line (${start_line}) is out of range. File has ${lines.length} lines.`);
      }

      if (end_line > lines.length) {
        throw new Error(`end_line (${end_line}) is out of range. File has ${lines.length} lines.`);
      }

      // Replace lines (convert to 0-based index)
      const newLines = new_text.split('\n');
      lines.splice(start_line - 1, end_line - start_line + 1, ...newLines);

      // Write back to file
      await fs.writeFile(resolvedPath, lines.join('\n'), 'utf-8');

      return `Successfully replaced lines ${start_line}-${end_line} in ${file_path}`;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${file_path}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${file_path}`);
      }
      throw error;
    }
  },
});
