/**
 * handleSlack — unit tests for the slack command handler.
 * Tests list/clean subcommands with local filesystem (no Slack API calls).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleSlack } from '../../src/commands/slack';

// ─── Test helpers ──────────────────────────────────────────────────────────

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  origCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crewx-slack-test-'));
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createSlackFile(threadId: string, fileName: string, content = 'test'): string {
  const safeThreadDir = threadId.replace(/:/g, '_');
  const dir = path.join(tmpDir, '.crewx', 'slack-files', safeThreadDir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// ─── list tests ───────────────────────────────────────────────────────────

describe('handleSlack --list', () => {
  it('prints "No files downloaded yet" when download dir is empty', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--list']);
    } finally {
      console.log = orig;
    }
    expect(logs.some(l => l.includes('No files downloaded yet'))).toBe(true);
  });

  it('lists files for a specific thread', async () => {
    createSlackFile('1234.5678', 'file1.txt');
    createSlackFile('1234.5678', 'file2.txt');

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--list', '--thread', '1234.5678']);
    } finally {
      console.log = orig;
    }
    expect(logs.some(l => l.includes('file1.txt'))).toBe(true);
    expect(logs.some(l => l.includes('file2.txt'))).toBe(true);
  });

  it('lists all threads when no --thread given', async () => {
    createSlackFile('thread_A', 'a.txt');
    createSlackFile('thread_B', 'b.txt');

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--list']);
    } finally {
      console.log = orig;
    }
    expect(logs.some(l => l.includes('thread_A'))).toBe(true);
    expect(logs.some(l => l.includes('thread_B'))).toBe(true);
  });

  it('shows "No files downloaded" for thread with no downloads', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--list', '--thread', 'missing_thread']);
    } finally {
      console.log = orig;
    }
    expect(logs.some(l => l.includes('No files downloaded for this thread'))).toBe(true);
  });
});

// ─── clean tests ──────────────────────────────────────────────────────────

describe('handleSlack --clean', () => {
  it('cleans all files across all threads', async () => {
    const f1 = createSlackFile('thread_X', 'x1.txt');
    const f2 = createSlackFile('thread_Y', 'y1.txt');

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--clean']);
    } finally {
      console.log = orig;
    }

    expect(fs.existsSync(f1)).toBe(false);
    expect(fs.existsSync(f2)).toBe(false);
    expect(logs.some(l => l.includes('Cleaned'))).toBe(true);
  });

  it('cleans only the specified thread', async () => {
    const f1 = createSlackFile('thread_keep', 'keep.txt');
    const f2 = createSlackFile('thread_del', 'del.txt');

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--clean', '--thread', 'thread_del']);
    } finally {
      console.log = orig;
    }

    expect(fs.existsSync(f2)).toBe(false);
    expect(fs.existsSync(f1)).toBe(true); // untouched
    expect(logs.some(l => l.includes('Cleaned'))).toBe(true);
  });

  it('handles clean when no files exist', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    try {
      await handleSlack(['--clean']);
    } finally {
      console.log = orig;
    }
    expect(logs.some(l => l.includes('No files to clean'))).toBe(true);
  });
});
