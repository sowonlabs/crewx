import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCommonFlags, parseMetadata } from '../../src/commands/parse-common-flags';

describe('parseCommonFlags', () => {
  it('returns empty defaults for empty args', () => {
    const result = parseCommonFlags([]);
    expect(result).toMatchObject({
      thread: undefined,
      provider: undefined,
      metadata: undefined,
      verbose: false,
      config: undefined,
      outputFormat: undefined,
      effort: undefined,
      rest: [],
    });
  });

  it('parses --thread value', () => {
    const { thread, rest } = parseCommonFlags(['@claude', '안녕', '--thread', 'my-thread']);
    expect(thread).toBe('my-thread');
    expect(rest).toEqual(['@claude', '안녕']);
  });

  it('parses --thread=value form', () => {
    const { thread, rest } = parseCommonFlags(['@claude', '안녕', '--thread=abc']);
    expect(thread).toBe('abc');
    expect(rest).toEqual(['@claude', '안녕']);
  });

  it('parses --provider value', () => {
    const { provider } = parseCommonFlags(['--provider', 'cli/gemini']);
    expect(provider).toBe('cli/gemini');
  });

  it('parses --metadata value', () => {
    const { metadata } = parseCommonFlags(['--metadata', '{"key":"val"}']);
    expect(metadata).toBe('{"key":"val"}');
  });

  it('parses --verbose boolean', () => {
    const { verbose } = parseCommonFlags(['--verbose']);
    expect(verbose).toBe(true);
  });

  it('verbose is false when not present', () => {
    const { verbose } = parseCommonFlags(['@claude', 'hi']);
    expect(verbose).toBe(false);
  });

  it('parses --config value', () => {
    const { config } = parseCommonFlags(['--config', '/my/crewx.yaml']);
    expect(config).toBe('/my/crewx.yaml');
  });

  it('parses -c short flag for config', () => {
    const { config } = parseCommonFlags(['-c', '/my/crewx.yaml']);
    expect(config).toBe('/my/crewx.yaml');
  });

  it('parses --output-format value', () => {
    const { outputFormat } = parseCommonFlags(['--output-format', 'json']);
    expect(outputFormat).toBe('json');
  });

  it('parses --effort value', () => {
    const { effort } = parseCommonFlags(['--effort', 'high']);
    expect(effort).toBe('high');
  });

  it('rest contains non-flag args', () => {
    const { rest } = parseCommonFlags(['@claude', '안녕', '--verbose', '--thread', 't1']);
    expect(rest).toEqual(['@claude', '안녕']);
  });

  it('handles multiple flags together', () => {
    const result = parseCommonFlags([
      '@agent',
      'message text',
      '--thread', 'my-thread',
      '--provider', 'cli/claude',
      '--verbose',
      '--effort', 'high',
    ]);
    expect(result.thread).toBe('my-thread');
    expect(result.provider).toBe('cli/claude');
    expect(result.verbose).toBe(true);
    expect(result.effort).toBe('high');
    expect(result.rest).toEqual(['@agent', 'message text']);
  });
});

describe('parseMetadata', () => {
  it('returns empty object for undefined', () => {
    expect(parseMetadata(undefined)).toEqual({});
  });

  it('parses valid JSON object', () => {
    expect(parseMetadata('{"foo":"bar","n":42}')).toEqual({ foo: 'bar', n: 42 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseMetadata('not-json')).toThrow(
      '--metadata must be valid JSON (double-quoted). Got: not-json',
    );
  });

  it('throws on JSON array (not object)', () => {
    expect(() => parseMetadata('[1,2,3]')).toThrow(
      '--metadata must be a JSON object. Got: [1,2,3]',
    );
  });

  it('throws on JSON string', () => {
    expect(() => parseMetadata('"hello"')).toThrow(
      '--metadata must be a JSON object. Got: "hello"',
    );
  });

  it('throws on single-quoted JSON', () => {
    expect(() => parseMetadata("{'h':'1'}")).toThrow(
      "--metadata must be valid JSON (double-quoted). Got: {'h':'1'}",
    );
  });
});
