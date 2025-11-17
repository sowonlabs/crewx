/**
 * ls tool for CrewX API Provider
 * Lists directory contents with optional recursive mode
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Recursively list directory contents
 */
async function listRecursive(
  dirPath: string,
  basePath: string,
  maxDepth: number = 5,
  currentDepth: number = 0,
): Promise<string[]> {
  if (currentDepth >= maxDepth) {
    return [`${dirPath}/ (max depth reached)`];
  }

  const results: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      results.push(`${relativePath}/`);
      try {
        const subResults = await listRecursive(
          fullPath,
          basePath,
          maxDepth,
          currentDepth + 1,
        );
        results.push(...subResults);
      } catch (error) {
        results.push(`${relativePath}/ (permission denied)`);
      }
    } else {
      const stats = await fs.stat(fullPath);
      results.push(`${relativePath} (${stats.size} bytes)`);
    }
  }

  return results;
}

/**
 * ls (list_directory) tool definition
 *
 * Lists directory contents with optional recursive mode.
 */
export const lsTool = createTool({
  id: 'ls',
  description: `Lists contents of a directory. Can list recursively with the 'recursive' flag. Shows file sizes and distinguishes directories with trailing slashes.`,

  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('The directory path to list (default: current directory).'),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Optional: List contents recursively (default: false).'),
  }),

  outputSchema: z.string().describe('Directory listing or error message'),

  execute: async ({ context }) => {
    const { path: dirPath = '.', recursive = false } = context;

    const resolvedPath = path.resolve(dirPath);

    try {
      // Check if path exists and is a directory
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      let output = `Directory listing: ${dirPath}\n\n`;

      if (recursive) {
        const entries = await listRecursive(resolvedPath, resolvedPath);
        output += entries.join('\n');
      } else {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const lines: string[] = [];

        for (const entry of entries) {
          const fullPath = path.join(resolvedPath, entry.name);
          if (entry.isDirectory()) {
            lines.push(`${entry.name}/`);
          } else {
            const stats = await fs.stat(fullPath);
            lines.push(`${entry.name} (${stats.size} bytes)`);
          }
        }

        output += lines.join('\n');
      }

      return output || 'Directory is empty';
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirPath}`);
      }
      throw error;
    }
  },
});
