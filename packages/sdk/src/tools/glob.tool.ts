/**
 * Glob Tool - Search for files using glob patterns
 *
 * Searches for files matching glob patterns (e.g., "**​/*.ts", "src/**​/*.yaml").
 * Similar to Unix shell globbing, supports wildcards and pattern matching.
 * Based on gemini_cli glob tool implementation.
 *
 * @example
 * ```typescript
 * // Find all TypeScript files
 * globTool.execute({ context: { pattern: "**​/*.ts" } })
 *
 * // Find YAML files in examples directory
 * globTool.execute({ context: { pattern: "examples/**​/*.yaml" } })
 *
 * // Case-sensitive search
 * globTool.execute({ context: { pattern: "**​/*.MD", case_sensitive: true } })
 * ```
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';

export const globToolInputSchema = z.object({
  pattern: z
    .string()
    .describe('Glob pattern to match files against (e.g., "**/*.ts", "src/**/*.yaml", "*.md"). Supports * (any chars), ? (single char), ** (recursive directories)'),
  dir_path: z
    .string()
    .optional()
    .describe('Directory to search in (default: current directory). Use "." for current, or relative/absolute path'),
  case_sensitive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to match case-sensitively (default: false)'),
  respect_git_ignore: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to respect .gitignore patterns (default: true)'),
  max_results: z
    .number()
    .optional()
    .default(100)
    .describe('Maximum number of results to return (default: 100)'),
});

export const globToolOutputSchema = z.string();

export type GlobToolInput = z.infer<typeof globToolInputSchema>;
export type GlobToolOutput = z.infer<typeof globToolOutputSchema>;

/**
 * Interface for file paths with modification time
 * (compatible with glob's Path interface)
 */
interface FileEntry {
  fullpath: string;
  mtimeMs?: number;
}

/**
 * Sort file entries by modification time (newest first), then alphabetically
 * Recent files (modified within 24 hours) are listed first
 */
function sortFileEntries(entries: FileEntry[]): FileEntry[] {
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const nowTimestamp = Date.now();

  return entries.sort((a, b) => {
    const mtimeA = a.mtimeMs ?? 0;
    const mtimeB = b.mtimeMs ?? 0;
    const aIsRecent = nowTimestamp - mtimeA < oneDayInMs;
    const bIsRecent = nowTimestamp - mtimeB < oneDayInMs;

    // Both recent: sort by modification time (newest first)
    if (aIsRecent && bIsRecent) {
      return mtimeB - mtimeA;
    }
    // Only a is recent
    if (aIsRecent) {
      return -1;
    }
    // Only b is recent
    if (bIsRecent) {
      return 1;
    }
    // Both old: sort alphabetically
    return a.fullpath.localeCompare(b.fullpath);
  });
}

/**
 * Find files using glob patterns
 *
 * Searches for files matching the given glob pattern.
 * Returns absolute paths sorted by modification time (newest first).
 */
export const globTool = createTool({
  id: 'glob',
  description: 'Efficiently finds files matching glob patterns (e.g., "**/*.ts", "src/**/*.yaml"). Returns absolute paths sorted by modification time (newest first). Ideal for locating files by path structure.',
  inputSchema: globToolInputSchema,
  outputSchema: globToolOutputSchema,
  execute: async ({ context }: { context: GlobToolInput }): Promise<GlobToolOutput> => {
    const {
      pattern,
      dir_path = '.',
      case_sensitive = false,
      respect_git_ignore = true,
      max_results = 100
    } = context;

    try {
      // Resolve directory path
      const searchDir = path.resolve(process.cwd(), dir_path);

      // Verify directory exists
      if (!fs.existsSync(searchDir)) {
        return `Error: Directory not found: ${searchDir}`;
      }

      if (!fs.statSync(searchDir).isDirectory()) {
        return `Error: Path is not a directory: ${searchDir}`;
      }

      // Build ignore patterns
      const ignorePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.crewx/**',
      ];

      // Execute glob search with withFileTypes to get stat info
      const matches = await glob(pattern, {
        cwd: searchDir,
        nocase: !case_sensitive,
        ignore: respect_git_ignore ? ignorePatterns : ['**/node_modules/**', '**/.git/**'],
        nodir: true, // Only return files, not directories
        withFileTypes: true, // Get Path objects with stat info
        stat: true, // Include file stats (modification time)
        dot: true, // Include dotfiles
        follow: false, // Don't follow symlinks
      });

      if (matches.length === 0) {
        return `No files found matching pattern: ${pattern}\nSearched in: ${searchDir}`;
      }

      // Convert glob Path objects to FileEntry objects with absolute paths
      const fileEntries: FileEntry[] = matches.map((entry: any) => ({
        fullpath: path.resolve(searchDir, entry.fullpath()),
        mtimeMs: entry.mtimeMs,
      }));

      // Sort by recency and alphabetically
      const sortedEntries = sortFileEntries(fileEntries);

      // Limit results
      const limitedEntries = sortedEntries.slice(0, max_results);

      // Format output
      const resultLines = limitedEntries.map((entry, index) => {
        const relativePath = path.relative(process.cwd(), entry.fullpath);
        const stats = fs.statSync(entry.fullpath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        const mtime = new Date(stats.mtime);
        const now = new Date();
        const isRecent = now.getTime() - mtime.getTime() < 24 * 60 * 60 * 1000;
        const marker = isRecent ? '🔥' : '  ';

        return `${marker} ${index + 1}. ${relativePath} (${sizeKB} KB)`;
      });

      const header = `Found ${limitedEntries.length} file(s) matching "${pattern}":\n`;
      const footer = sortedEntries.length > max_results
        ? `\n(Limited to ${max_results} results. Use max_results parameter to see more. Total matches: ${sortedEntries.length})`
        : sortedEntries.length === limitedEntries.length && matches.length > sortedEntries.length
        ? `\n(Total matches: ${matches.length})`
        : '';

      return header + resultLines.join('\n') + footer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Error during glob search: ${errorMessage}`;
    }
  },
});
