import { describe, it, expect, vi, afterEach } from 'vitest';
import { BUILTIN_COMMANDS } from '../src/builtin';

describe('builtin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BUILTIN_COMMANDS contains expected built-in tool names', () => {
    expect(BUILTIN_COMMANDS.has('memory')).toBe(true);
    expect(BUILTIN_COMMANDS.has('search')).toBe(true);
    expect(BUILTIN_COMMANDS.has('doc')).toBe(true);
    expect(BUILTIN_COMMANDS.has('wbs')).toBe(true);
    expect(BUILTIN_COMMANDS.has('cron')).toBe(true);
    expect(BUILTIN_COMMANDS.has('workflow')).toBe(true);
    // @crewx/skill has no /cli export — handled separately
    expect(BUILTIN_COMMANDS.has('skill')).toBe(false);
  });

  it('does not contain non-builtin commands', () => {
    expect(BUILTIN_COMMANDS.has('query')).toBe(false);
    expect(BUILTIN_COMMANDS.has('execute')).toBe(false);
  });
});
