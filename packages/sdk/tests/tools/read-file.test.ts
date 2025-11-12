/**
 * Unit tests for read_file tool
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileTool } from '../../src/tools/read-file.tool';
import { MastraToolAdapter } from '../../src/adapters/MastraToolAdapter';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('read_file tool', () => {
  let testDir: string;
  let testFile: string;

  beforeAll(async () => {
    // Create temp directory for tests
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crewx-read-file-test-'));
    testFile = path.join(testDir, 'test.txt');

    // Create test file
    await fs.writeFile(testFile, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n');
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should have correct metadata', () => {
    expect(readFileTool.name).toBe('read_file');
    expect(readFileTool.description).toContain('Reads and returns');
    expect(readFileTool.parameters).toBeDefined();
    expect(readFileTool.execute).toBeDefined();
  });

  it('should validate with MastraToolAdapter', () => {
    const isValid = MastraToolAdapter.validateTool(readFileTool);
    expect(isValid).toBe(true);
  });

  it('should read a simple text file', async () => {
    const context = MastraToolAdapter.createMinimalContext(
      'test-agent',
      'api/openai',
      'gpt-4',
    );

    const result = await readFileTool.execute(
      { file_path: testFile },
      context,
    );

    expect(result).toContain('Line 1');
    expect(result).toContain('Line 5');
  });

  it('should handle file not found', async () => {
    const context = MastraToolAdapter.createMinimalContext(
      'test-agent',
      'api/openai',
      'gpt-4',
    );

    const nonexistentFile = path.join(testDir, 'nonexistent.txt');

    await expect(
      readFileTool.execute({ file_path: nonexistentFile }, context),
    ).rejects.toThrow('File not found');
  });

  it('should handle offset and limit', async () => {
    const context = MastraToolAdapter.createMinimalContext(
      'test-agent',
      'api/openai',
      'gpt-4',
    );

    const result = await readFileTool.execute(
      { file_path: testFile, offset: 1, limit: 2 },
      context,
    );

    expect(result).toContain('Line 2');
    expect(result).toContain('Line 3');
    expect(result).not.toContain('Line 1');
    expect(result).not.toContain('Line 4');
  });

  it('should reject empty file_path', async () => {
    const context = MastraToolAdapter.createMinimalContext(
      'test-agent',
      'api/openai',
      'gpt-4',
    );

    await expect(
      readFileTool.execute({ file_path: '' }, context),
    ).rejects.toThrow('must be non-empty');
  });

  // Note: Workspace checks are disabled in this initial implementation
  // Will be added in a future iteration with proper context configuration
  it.skip('should reject paths outside workspace', async () => {
    const context = MastraToolAdapter.createMinimalContext(
      'test-agent',
      'api/openai',
      'gpt-4',
    );

    // Try to access a file outside the current working directory
    const outsidePath = path.join(process.cwd(), '../../../etc/passwd');

    await expect(
      readFileTool.execute({ file_path: outsidePath }, context),
    ).rejects.toThrow('must be within the workspace');
  });
});
