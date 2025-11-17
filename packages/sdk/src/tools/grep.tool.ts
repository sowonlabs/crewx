/**
 * grep tool for CrewX API Provider
 * Searches for patterns in files using regular expressions
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Search for pattern in a single file
 */
async function searchFile(
  filePath: string,
  pattern: RegExp,
  basePath: string,
): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: string[] = [];

    const relativePath = path.relative(basePath, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined && pattern.test(line)) {
        matches.push(`${relativePath}:${i + 1}: ${line}`);
      }
    }

    return matches;
  } catch (error) {
    // Skip files that can't be read (binary, permissions, etc.)
    return [];
  }
}

/**
 * Recursively search directory
 */
async function searchRecursive(
  dirPath: string,
  pattern: RegExp,
  basePath: string,
  maxDepth: number = 10,
  currentDepth: number = 0,
): Promise<string[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const results: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Skip common directories to ignore
    if (entry.isDirectory()) {
      const dirName = entry.name;
      if (
        dirName === 'node_modules' ||
        dirName === '.git' ||
        dirName === 'dist' ||
        dirName === 'build' ||
        dirName === '.next'
      ) {
        continue;
      }

      try {
        const subResults = await searchRecursive(
          fullPath,
          pattern,
          basePath,
          maxDepth,
          currentDepth + 1,
        );
        results.push(...subResults);
      } catch {
        // Skip directories we can't access
      }
    } else {
      const matches = await searchFile(fullPath, pattern, basePath);
      results.push(...matches);
    }
  }

  return results;
}

/**
 * grep (search) tool definition
 *
 * Searches for a pattern in files using regular expressions.
 */
export const grepTool = createTool({
  id: 'grep',
  description: `Searches for a pattern in files using regular expressions. Can search recursively through directories. Returns matching lines with file paths and line numbers. Automatically skips common build directories (node_modules, .git, dist, build, .next).`,

  inputSchema: z.object({
    pattern: z
      .string()
      .describe('The regular expression pattern to search for.'),
    path: z
      .string()
      .optional()
      .default('.')
      .describe('The file or directory path to search in (default: current directory).'),
    recursive: z
      .boolean()
      .optional()
      .default(true)
      .describe('Optional: Search recursively through subdirectories (default: true).'),
  }),

  outputSchema: z.string().describe('Search results or error message'),

  execute: async ({ context }) => {
    const { pattern, path: searchPath = '.', recursive = true } = context;

    // Validation
    if (pattern.trim() === '') {
      throw new Error("The 'pattern' parameter must be non-empty.");
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (error: any) {
      throw new Error(`Invalid regular expression: ${error.message}`);
    }

    const resolvedPath = path.resolve(searchPath);

    try {
      const stats = await fs.stat(resolvedPath);
      const basePath = stats.isDirectory() ? resolvedPath : path.dirname(resolvedPath);

      let matches: string[] = [];

      if (stats.isDirectory()) {
        if (recursive) {
          matches = await searchRecursive(resolvedPath, regex, basePath);
        } else {
          const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) {
              const fullPath = path.join(resolvedPath, entry.name);
              const fileMatches = await searchFile(fullPath, regex, basePath);
              matches.push(...fileMatches);
            }
          }
        }
      } else {
        // Single file
        matches = await searchFile(resolvedPath, regex, basePath);
      }

      if (matches.length === 0) {
        return `No matches found for pattern: ${pattern}`;
      }

      // Limit results to avoid too much output
      const maxResults = 100;
      const limited = matches.slice(0, maxResults);
      let output = `Found ${matches.length} match(es) for pattern: ${pattern}\n\n`;
      output += limited.join('\n');

      if (matches.length > maxResults) {
        output += `\n\n... and ${matches.length - maxResults} more matches (output truncated)`;
      }

      return output;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Path not found: ${searchPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${searchPath}`);
      }
      throw error;
    }
  },
});
