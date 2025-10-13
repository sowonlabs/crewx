import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { CliConversationHistoryProvider } from '../../src/conversation/cli-conversation-history.provider';

const THREAD_ID = 'vitest-agent-metadata';
const CONVERSATION_FILE = join(
  process.cwd(),
  '.crewx',
  'conversations',
  `${THREAD_ID}.json`,
);

async function removeConversationFile() {
  try {
    await fs.unlink(CONVERSATION_FILE);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

describe('CliConversationHistoryProvider metadata persistence', () => {
  let provider: CliConversationHistoryProvider;

  beforeEach(async () => {
    provider = new CliConversationHistoryProvider();
    await provider.initialize();
    await removeConversationFile();
  });

  afterEach(async () => {
    await removeConversationFile();
  });

  it('persists agent metadata when assistant response specifies an agent id', async () => {
    await provider.addMessage(THREAD_ID, 'tester', 'hello', false);
    await provider.addMessage(THREAD_ID, 'crewx', 'response', true, 'test_agent:demo');

    const raw = await fs.readFile(CONVERSATION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const assistantMessage = data.messages[data.messages.length - 1];

    expect(assistantMessage.isAssistant).toBe(true);
    expect(assistantMessage.metadata).toBeDefined();
    expect(assistantMessage.metadata.agent_id).toBe('test_agent:demo');
  });

  it('omits metadata when agent id is absent or blank', async () => {
    await provider.addMessage(THREAD_ID, 'tester', 'hi', false);
    await provider.addMessage(THREAD_ID, 'crewx', 'response', true);
    const raw = await fs.readFile(CONVERSATION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const assistantMessage = data.messages[data.messages.length - 1];

    expect(assistantMessage.isAssistant).toBe(true);
    expect(assistantMessage.metadata).toBeUndefined();
  });

  it('normalizes agent id by trimming whitespace before persisting', async () => {
    await provider.addMessage(THREAD_ID, 'tester', 'second run', false);
    await provider.addMessage(THREAD_ID, 'crewx', 'response', true, '  spaced-agent ');
    const raw = await fs.readFile(CONVERSATION_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const assistantMessage = data.messages[data.messages.length - 1];

    expect(assistantMessage.metadata.agent_id).toBe('spaced-agent');
  });
});
