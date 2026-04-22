import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let capturedOnInbound: ((msg: any) => Promise<any>) | undefined;
let activeShutdown: Promise<void> | undefined;

const mockRegisterChannelAdapter = vi.fn().mockImplementation(async (reg: any) => {
  capturedOnInbound = reg.onInbound;
});
const mockQuery = vi.fn().mockResolvedValue({
  ok: true,
  data: 'Hello **world** and [link](https://example.com)',
  meta: { agentId: 'test-agent', provider: 'cli/opencode', durationMs: 100 },
});
const mockExecute = vi.fn().mockResolvedValue({
  ok: true,
  data: 'Executed **bold** result',
  meta: { agentId: 'test-agent', provider: 'cli/opencode', durationMs: 200 },
});
const mockStopAllAdapters = vi.fn().mockResolvedValue(undefined);

function buildCrewxInstance() {
  return {
    registerChannelAdapter: mockRegisterChannelAdapter,
    query: mockQuery,
    execute: mockExecute,
    stopAllAdapters: mockStopAllAdapters,
  };
}

vi.mock('../../src/bootstrap/crewx-cli', () => ({
  createCliCrewx: vi.fn().mockResolvedValue(buildCrewxInstance()),
}));

vi.mock('@crewx/adapter-slack', () => ({
  SlackAdapter: class SlackAdapter {
    manifest = { platform: 'slack' };
  },
}));

vi.mock('../../src/slack/file-download', () => ({
  downloadInboundFiles: vi.fn().mockResolvedValue([]),
}));

import { downloadInboundFiles } from '../../src/slack/file-download';
import { markdownToMrkdwn } from '../../src/slack/markdown';

let tmpDir: string;
let origCwd: string;
let origExit: (code?: number) => never;

beforeEach(() => {
  origCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crewx-slack-bot-test-'));
  process.chdir(tmpDir);
  origExit = process.exit;
  process.exit = ((code?: number) => { throw new Error(`process.exit(${code ?? 0})`); }) as any;
  capturedOnInbound = undefined;
  activeShutdown = undefined;
  vi.clearAllMocks();
});

afterEach(() => {
  process.exit = origExit;
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createMockYaml() {
  const yamlPath = path.join(tmpDir, 'crewx.yaml');
  fs.writeFileSync(yamlPath, 'agents: []\n');
  return yamlPath;
}

async function setupBotMode(mode: string = 'query', agent: string = 'test-agent') {
  createMockYaml();
  process.env.SLACK_BOT_TOKEN = 'xoxb-test';
  process.env.SLACK_APP_TOKEN = 'xapp-test';
  process.env.CREWX_CONFIG = path.join(tmpDir, 'crewx.yaml');

  const { handleSlack } = await import('../../src/commands/slack');
  activeShutdown = handleSlack(['--mode', mode, '--agent', agent]).catch(() => {});
  await new Promise((r) => setTimeout(r, 200));
}

async function teardownBotMode() {
  process.emit('SIGINT' as any);
  if (activeShutdown) await activeShutdown.catch(() => {});
  delete process.env.SLACK_BOT_TOKEN;
  delete process.env.SLACK_APP_TOKEN;
  delete process.env.CREWX_CONFIG;
}

describe('slack bot mode — onInbound callback', () => {
  it('registers onInbound callback via registerChannelAdapter', async () => {
    await setupBotMode();
    expect(capturedOnInbound).toBeDefined();
    await teardownBotMode();
  });

  it('calls downloadInboundFiles when message has attachments', async () => {
    await setupBotMode();

    const result = await capturedOnInbound!({
      id: 'msg-1',
      threadId: '1234.5678',
      userId: 'U123',
      text: 'hello agent',
      receivedAt: Date.now(),
      attachments: [
        { url: 'https://files.slack.com/test.pdf', mimeType: 'application/pdf', name: 'report.pdf' },
        { url: 'https://files.slack.com/img.png', name: 'screenshot.png' },
      ],
    });

    expect(downloadInboundFiles).toHaveBeenCalledWith(
      'xoxb-test',
      [
        { url_private: 'https://files.slack.com/test.pdf', mimetype: 'application/pdf', name: 'report.pdf' },
        { url_private: 'https://files.slack.com/img.png', mimetype: 'application/octet-stream', name: 'screenshot.png' },
      ],
      '1234.5678',
    );

    expect(result.accepted).toBe(true);
    const expected = markdownToMrkdwn('Hello **world** and [link](https://example.com)');
    expect(result.output).toBe(expected);
    expect(result.output).toContain('<https://example.com|link>');

    await teardownBotMode();
  });

  it('does not call downloadInboundFiles when no attachments', async () => {
    await setupBotMode();

    const result = await capturedOnInbound!({
      id: 'msg-2',
      threadId: 'thread-1',
      userId: 'U456',
      text: 'no files here',
      receivedAt: Date.now(),
    });

    expect(downloadInboundFiles).not.toHaveBeenCalled();
    expect(result.accepted).toBe(true);
    expect(result.output).toBe(markdownToMrkdwn('Hello **world** and [link](https://example.com)'));

    await teardownBotMode();
  });

  it('transforms markdown output to mrkdwn format', async () => {
    await setupBotMode();

    const result = await capturedOnInbound!({
      id: 'msg-3',
      threadId: 'thread-2',
      userId: 'U789',
      text: 'test',
      receivedAt: Date.now(),
    });

    expect(result.output).not.toContain('**world**');
    expect(result.output).not.toContain('[link](https://example.com)');
    expect(result.output).toContain('<https://example.com|link>');

    await teardownBotMode();
  });

  it('uses crewx.execute in execute mode', async () => {
    await setupBotMode('execute');

    await capturedOnInbound!({
      id: 'msg-4',
      threadId: 'thread-3',
      userId: 'U000',
      text: 'do something',
      receivedAt: Date.now(),
    });

    expect(mockExecute).toHaveBeenCalledWith('@test-agent', 'do something', expect.objectContaining({ threadId: 'thread-3' }));
    expect(mockQuery).not.toHaveBeenCalled();

    await teardownBotMode();
  });

  it('handles file download failure gracefully', async () => {
    (downloadInboundFiles as any).mockRejectedValueOnce(new Error('Network error'));

    await setupBotMode();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await capturedOnInbound!({
      id: 'msg-5',
      threadId: 'thread-4',
      userId: 'U111',
      text: 'with failing file',
      receivedAt: Date.now(),
      attachments: [{ url: 'https://files.slack.com/bad.pdf', mimeType: 'application/pdf', name: 'bad.pdf' }],
    });

    expect(errorSpy).toHaveBeenCalledWith('File download failed:', 'Network error');
    expect(result.accepted).toBe(true);
    expect(result.output).toBeDefined();

    errorSpy.mockRestore();
    await teardownBotMode();
  });
});
