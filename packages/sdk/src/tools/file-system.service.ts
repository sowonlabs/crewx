/**
 * Standard file system service implementation
 */

import fs from 'node:fs/promises';
import type { FileSystemService } from './types.js';

/**
 * Standard file system service using Node.js fs module
 */
export class StandardFileSystemService implements FileSystemService {
  async readFile(path: string): Promise<Buffer> {
    return await fs.readFile(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<{ size: number; isDirectory: boolean }> {
    const stats = await fs.stat(path);
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
    };
  }

  async readdir(path: string): Promise<string[]> {
    return await fs.readdir(path);
  }
}
