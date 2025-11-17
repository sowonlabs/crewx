/**
 * Find Tool - Search for files by name pattern
 *
 * Similar to Unix 'find' command, searches for files matching a name pattern.
 * Based on gemini_cli's glob tool but optimized for filename search.
 *
 * @example
 * ```typescript
 * // Find all TypeScript files with "Provider" in name
 * findTool.execute({ context: { pattern: "*Provider*.ts" } })
 *
 * // Find exact filename
 * findTool.execute({ context: { pattern: "MastraAPIProvider.ts" } })
 *
 * // Find in specific directory
 * findTool.execute({ context: { pattern: "*.yaml", dir_path: "examples" } })
 * ```
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';

export const findToolInputSchema = z.object({
  pattern: z
    .string()
    .describe('Filename pattern to search for (supports * and ? wildcards). Example: "MastraAPIProvider.ts", "*Provider*.ts", "*.yaml"'),
  dir_path: z
    .string()
    .optional()
    .describe('Directory to search in (default: current directory). Use "." for current, or relative/absolute path'),
  case_sensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to match case-sensitively (default: false)'),
  max_results: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of results to return (default: 50)'),
});

export const findToolOutputSchema = z.string();

export type FindToolInput = z.infer<typeof findToolInputSchema>;
export type FindToolOutput = z.infer<typeof findToolOutputSchema>;

/**
 * Find files by name pattern
 *
 * Searches for files matching the given pattern in the specified directory.
 * Returns absolute paths sorted by relevance (exact matches first, then by modification time).
 */
export const findTool = createTool({
  id: 'find',
  description: 'Search for files by filename pattern. Supports wildcards (* and ?). Returns absolute file paths.',
  inputSchema: findToolInputSchema,
  outputSchema: findToolOutputSchema,
  execute: async ({ context }: { context: FindToolInput }): Promise<FindToolOutput> => {
    const { pattern, dir_path = '.', case_sensitive = false, max_results = 50 } = context;

    try {
      // Resolve directory path
      const searchDir = path.resolve(process.cwd(), dir_path);

      // Verify directory exists
      if (!fs.existsSync(searchDir)) {
        return `Error: Directory not found: ${searchDir}`;
      }

      // Build glob pattern for filename search
      // If pattern doesn't contain path separators, search recursively
      const globPattern = pattern.includes('/')
        ? path.join(searchDir, pattern)
        : path.join(searchDir, '**', pattern);

      // Execute glob search
      const matches = await glob(globPattern, {
        nocase: !case_sensitive,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/.crewx/**',
        ],
        absolute: true,
      });

      if (matches.length === 0) {
        return `No files found matching pattern: ${pattern}\nSearched in: ${searchDir}`;
      }

      // Sort by relevance:
      // 1. Exact filename matches first
      // 2. Then by modification time (newest first)
      const exactMatches: string[] = [];
      const partialMatches: string[] = [];

      const patternBasename = path.basename(pattern.replace(/\*/g, ''));

      for (const match of matches) {
        const matchBasename = path.basename(match);
        if (matchBasename === pattern.replace(/\*/g, '')) {
          exactMatches.push(match);
        } else {
          partialMatches.push(match);
        }
      }

      // Sort each group by modification time
      const sortByMtime = (files: string[]) => {
        return files.sort((a, b) => {
          try {
            const aStat = fs.statSync(a);
            const bStat = fs.statSync(b);
            return bStat.mtime.getTime() - aStat.mtime.getTime();
          } catch {
            return 0;
          }
        });
      };

      const sortedMatches = [
        ...sortByMtime(exactMatches),
        ...sortByMtime(partialMatches),
      ].slice(0, max_results);

      // Format output
      const resultLines = sortedMatches.map((filePath, index) => {
        const relativePath = path.relative(process.cwd(), filePath);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        const isExact = exactMatches.includes(filePath);
        const marker = isExact ? '✓' : ' ';

        return `${marker} ${index + 1}. ${relativePath} (${sizeKB} KB)`;
      });

      const header = `Found ${sortedMatches.length} file(s) matching "${pattern}":\n`;
      const footer = sortedMatches.length >= max_results
        ? `\n(Limited to ${max_results} results. Use max_results parameter to see more)`
        : '';

      return header + resultLines.join('\n') + footer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Error searching for files: ${errorMessage}`;
    }
  },
});
