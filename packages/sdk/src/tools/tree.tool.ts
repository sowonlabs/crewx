/**
 * tree tool for CrewX API Provider
 * Displays a directory tree similar to the Unix `tree` command
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';

const INDENT_UNIT = '  ';

interface TreeTraversalOptions {
  currentDepth: number;
  maxDepth: number;
}

/**
 * Recursively build tree lines for the provided directory
 */
async function buildTreeLines(dirPath: string, options: TreeTraversalOptions): Promise<string[]> {
  const { currentDepth, maxDepth } = options;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error: any) {
    const indent = INDENT_UNIT.repeat(currentDepth);
    const reason = error?.code === 'EACCES' ? 'permission denied' : error?.message || 'unknown error';
    return [`${indent}(error reading directory: ${reason})`];
  }

  if (entries.length === 0) {
    return [`${INDENT_UNIT.repeat(currentDepth)}(empty)`];
  }

  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];

  for (const entry of entries) {
    const indent = INDENT_UNIT.repeat(currentDepth);
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      lines.push(`${indent}[DIR] ${entry.name}/`);

      if (currentDepth < maxDepth) {
        const childLines = await buildTreeLines(fullPath, {
          currentDepth: currentDepth + 1,
          maxDepth,
        });
        lines.push(...childLines);
      } else {
        lines.push(`${INDENT_UNIT.repeat(currentDepth + 1)}(max depth reached)`);
      }
    } else {
      try {
        const stats = await fs.stat(fullPath);
        lines.push(`${indent}[FILE] ${entry.name} (${stats.size} bytes)`);
      } catch (error: any) {
        lines.push(`${indent}[FILE] ${entry.name} (error: ${error?.code || 'stat failed'})`);
      }
    }
  }

  return lines;
}

/**
 * tree tool definition
 *
 * Recursively displays a directory structure with optional depth control.
 */
export const treeTool = createTool({
  id: 'tree',
  description: `Displays a directory tree similar to the Unix 'tree' command. Shows nested directories up to 'max_depth' levels with [DIR]/[FILE] labels and indentation to represent hierarchy.`,

  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .default('.')
      .describe('Path of the directory to inspect (default: current working directory).'),
    max_depth: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(3)
      .describe('Maximum depth to traverse relative to the root directory (default: 3).'),
  }),

  outputSchema: z.string().describe('Formatted tree output or an error message'),

  execute: async ({ context }) => {
    const { path: targetPath = '.', max_depth = 3 } = context;

    const resolvedPath = path.resolve(targetPath);

    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${targetPath}`);
      }
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new Error(`Directory not found: ${targetPath}`);
      }
      if (error?.code === 'EACCES') {
        throw new Error(`Permission denied: ${targetPath}`);
      }
      throw error;
    }

    const relativeRoot = path.relative(process.cwd(), resolvedPath);
    const rootLabel = relativeRoot === '' ? '.' : relativeRoot;

    const lines = [`Tree for ${rootLabel} (max depth: ${max_depth})`, `[DIR] ${rootLabel}/`];
    const treeLines = await buildTreeLines(resolvedPath, {
      currentDepth: 1,
      maxDepth: max_depth,
    });

    lines.push(...treeLines);

    return lines.join('\n');
  },
});
