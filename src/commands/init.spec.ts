import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock handleHookInstall before importing init
const mockHandleHookInstall = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock('./hook/install', () => ({
  handleHookInstall: mockHandleHookInstall,
}));

import { handleInit, type InitResult } from './init';

describe('handleInit', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crewx-init-test-'));
    mockHandleHookInstall.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('creates crewx.yaml with planner/developer/reviewer agents', async () => {
    const result = await handleInit({ path: tmpDir, skipHook: true });

    expect(result.yamlCreated).toBe(true);
    expect(result.hookInstalled).toBe(false);
    expect(result.errors).toEqual([]);

    const yamlContent = fs.readFileSync(path.join(tmpDir, 'crewx.yaml'), 'utf-8');
    expect(yamlContent).toContain('id: "planner"');
    expect(yamlContent).toContain('id: "developer"');
    expect(yamlContent).toContain('id: "reviewer"');
  });

  it('creates .crewx/logs and .claude/commands directories', async () => {
    await handleInit({ path: tmpDir, skipHook: true });

    expect(fs.existsSync(path.join(tmpDir, '.crewx', 'logs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'commands'))).toBe(true);
  });

  it('installs hook when skipHook is false (default)', async () => {
    await handleInit({ path: tmpDir });

    expect(mockHandleHookInstall).toHaveBeenCalledOnce();
    expect(mockHandleHookInstall).toHaveBeenCalledWith({ projectRoot: tmpDir, yes: true });
  });

  it('skips hook install when skipHook: true', async () => {
    const result = await handleInit({ path: tmpDir, skipHook: true });

    expect(mockHandleHookInstall).not.toHaveBeenCalled();
    expect(result.hookInstalled).toBe(false);
  });

  it('returns hookInstalled: true when hook installed successfully', async () => {
    const result = await handleInit({ path: tmpDir });

    expect(result.hookInstalled).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns yaml-exists skippedReason when crewx.yaml already exists (no force)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'crewx.yaml'), 'agents: []', 'utf-8');

    const result = await handleInit({ path: tmpDir });

    expect(result.yamlCreated).toBe(false);
    expect(result.hookInstalled).toBe(false);
    expect(result.skippedReason).toBe('yaml-exists');
    expect(result.errors).toEqual([]);
    // yaml must not be overwritten
    expect(fs.readFileSync(path.join(tmpDir, 'crewx.yaml'), 'utf-8')).toBe('agents: []');
  });

  it('returns yaml-exists skippedReason when crewx.yml already exists (no force)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'crewx.yml'), 'agents: []', 'utf-8');

    const result = await handleInit({ path: tmpDir });

    expect(result.skippedReason).toBe('yaml-exists');
    expect(result.yamlCreated).toBe(false);
  });

  it('overwrites yaml when force: true', async () => {
    fs.writeFileSync(path.join(tmpDir, 'crewx.yaml'), 'agents: []', 'utf-8');

    const result = await handleInit({ path: tmpDir, force: true, skipHook: true });

    expect(result.yamlCreated).toBe(true);
    expect(result.skippedReason).toBeUndefined();
    const content = fs.readFileSync(path.join(tmpDir, 'crewx.yaml'), 'utf-8');
    expect(content).toContain('id: "planner"');
  });

  it('collects hook failure in errors without rolling back yaml', async () => {
    mockHandleHookInstall.mockRejectedValue(new Error('permission denied'));

    const result = await handleInit({ path: tmpDir });

    expect(result.yamlCreated).toBe(true);
    expect(result.hookInstalled).toBe(false);
    expect(result.errors.some((e) => e.includes('HOOK_INSTALL_FAILED'))).toBe(true);
    // yaml must still exist
    expect(fs.existsSync(path.join(tmpDir, 'crewx.yaml'))).toBe(true);
  });

  it('throws PATH_NOT_FOUND when target does not exist', async () => {
    await expect(
      handleInit({ path: path.join(tmpDir, 'nonexistent') }),
    ).rejects.toThrow('PATH_NOT_FOUND');
  });

  it('throws NESTED_CREWX_PROJECT when parent has crewx.yaml', async () => {
    // Parent has crewx.yaml
    fs.writeFileSync(path.join(tmpDir, 'crewx.yaml'), 'agents: []', 'utf-8');
    const child = path.join(tmpDir, 'child');
    fs.mkdirSync(child);

    await expect(handleInit({ path: child })).rejects.toThrow('NESTED_CREWX_PROJECT');
  });
});
