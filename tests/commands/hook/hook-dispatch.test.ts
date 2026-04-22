import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { handleHookDispatch } from '../../../src/commands/hook-dispatch';

function createTmpProject(yamlContent: string): string {
  const dir = join(tmpdir(), `crewx-dispatch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'crewx.yaml'), yamlContent, 'utf8');
  return dir;
}

const CODEX_YAML_WITH_GUIDE = `
agents:
  - id: test-agent
    name: Test Agent
    provider: cli/opencode
hooks:
  - name: codex-guide
    provider: codex
    when: [Bash]
    guide:
      say: "Always use tsserver for symbol search"
`;

const CLAUDE_YAML_WITH_GUIDE = `
agents:
  - id: test-agent
    name: Test Agent
    provider: cli/opencode
hooks:
  - name: claude-guide
    provider: claude
    when: [Bash]
    guide:
      say: "Always use tsserver for symbol search"
`;

const SAMPLE_STDIN = JSON.stringify({
  session_id: 'sess_001',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: '',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'ls' },
  tool_use_id: 'tu_001',
});

describe('handleHookDispatch — codex provider inject detection', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutWriteSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any;
  let stdinHandlers: Record<string, Function[]>;

  beforeEach(() => {
    stdinHandlers = {};

    vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: Function) => {
      if (!stdinHandlers[event]) stdinHandlers[event] = [];
      stdinHandlers[event].push(handler);
      return process.stdin;
    });
    vi.spyOn(process.stdin, 'setEncoding').mockReturnValue(process.stdin);

    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit:${code}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function fireStdin(data: string) {
    process.stdin.setEncoding('utf8');
    const dataHandlers = stdinHandlers['data'] || [];
    for (const h of dataHandlers) h(data);
    const endHandlers = stdinHandlers['end'] || [];
    for (const h of endHandlers) h();
  }

  it('codex provider returns systemMessage in output', async () => {
    tmpDir = createTmpProject(CODEX_YAML_WITH_GUIDE);
    const stdin = JSON.stringify({ ...JSON.parse(SAMPLE_STDIN), cwd: tmpDir });

    const dispatchPromise = handleHookDispatch(['--provider', 'codex']);

    setTimeout(() => fireStdin(stdin), 10);

    try {
      await dispatchPromise;
    } catch (e: any) {
      expect(e.message).toMatch(/process\.exit:0/);
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0] as string);
    expect(output.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(output.hookSpecificOutput.systemMessage).toBe('Always use tsserver for symbol search');
    expect(output.hookSpecificOutput.additionalContext).toBeUndefined();
  });

  it('claude provider returns additionalContext in output', async () => {
    tmpDir = createTmpProject(CLAUDE_YAML_WITH_GUIDE);
    const stdin = JSON.stringify({ ...JSON.parse(SAMPLE_STDIN), cwd: tmpDir });

    const dispatchPromise = handleHookDispatch(['--provider', 'claude']);

    setTimeout(() => fireStdin(stdin), 10);

    try {
      await dispatchPromise;
    } catch (e: any) {
      expect(e.message).toMatch(/process\.exit:0/);
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0] as string);
    expect(output.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(output.hookSpecificOutput.additionalContext).toBe('Always use tsserver for symbol search');
    expect(output.hookSpecificOutput.systemMessage).toBeUndefined();
  });
});
