import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Last Speaker Detection Unit Tests
 *
 * These tests verify the "active speaker" detection logic that determines
 * which bot should respond to unmentioned messages in Slack threads.
 *
 * Key regression prevention:
 * - Bug: mentionOnly=false but last speaker not auto-responding
 * - Root cause: findActiveSpeaker() returning null or wrong agent
 * - This test suite ensures the logic is correct for various scenarios
 *
 * Test Coverage:
 * 1. mentionOnly=false: Last speaker should auto-respond
 * 2. mentionOnly=true: Always require explicit mention
 * 3. Active speaker detection via metadata
 * 4. Active speaker detection via text pattern fallback
 * 5. Active speaker detection via bot_id fallback
 */

/**
 * Simulates the findActiveSpeaker logic from slack-bot.ts
 * This should match the actual implementation exactly
 */
function findActiveSpeaker(
  messages: any[],
  botId: string,
  defaultAgent: string
): string | null {
  // Sort messages by timestamp (newest first) to find the LAST bot response
  const sortedMessages = [...messages].sort((a, b) =>
    parseFloat(b.ts) - parseFloat(a.ts)
  );

  // Find the last bot message (active speaker)
  for (const msg of sortedMessages) {
    const isBot = !!msg.bot_id || msg.metadata?.event_type === 'crewx_response';

    if (isBot) {
      // Try to get agent_id from metadata first (most reliable)
      let agentId = msg.metadata?.event_payload?.agent_id;

      // FALLBACK 1: Parse agent ID from message text
      // Message format: "✅ Completed! (@agent_name)" or "❌ Error (@agent_name)"
      if (!agentId && msg.text) {
        const agentMatch = msg.text.match(/@([a-zA-Z0-9_]+)\)/);
        if (agentMatch) {
          agentId = agentMatch[1];
        }
      }

      // FALLBACK 2: If this is OUR bot (bot_id matches) and no agent_id found,
      // assume it's this instance's defaultAgent.
      if (!agentId && msg.bot_id === botId) {
        agentId = defaultAgent;
      }

      if (agentId) {
        return agentId;
      }
    }
  }

  return null; // No bot has responded in this thread yet
}

/**
 * Simulates shouldRespondToMessage logic for thread messages
 * Simplified version focusing on the active speaker check
 */
function shouldRespondInThread(
  messages: any[],
  currentMessage: any,
  options: {
    botUserId: string;
    botId: string;
    defaultAgent: string;
    mentionOnly: boolean;
  }
): { shouldRespond: boolean; reason: string } {
  const { botUserId, botId, defaultAgent, mentionOnly } = options;
  const text = currentMessage.text || '';

  // 1. Check if bot is explicitly mentioned
  if (text.includes(`<@${botUserId}>`)) {
    return { shouldRespond: true, reason: 'explicit_mention' };
  }

  // 2. Check if another bot is mentioned
  const otherBotMentioned = /<@[A-Z0-9_]+>/.test(text) && !text.includes(`<@${botUserId}>`);
  if (otherBotMentioned) {
    return { shouldRespond: false, reason: 'other_bot_mentioned' };
  }

  // 3. Check if DM
  if (currentMessage.channel_type === 'im') {
    return { shouldRespond: true, reason: 'direct_message' };
  }

  // 4. If mention-only mode is enabled, require explicit mention in threads
  if (mentionOnly && currentMessage.thread_ts) {
    return { shouldRespond: false, reason: 'mention_only_mode' };
  }

  // 5. Check active speaker in thread
  if (currentMessage.thread_ts) {
    // Filter out current message
    const previousMessages = messages.filter((msg) => msg.ts !== currentMessage.ts);

    // Filter out file-only uploads
    const validMessages = previousMessages.filter((msg) => {
      if (msg.bot_id || msg.metadata?.event_type === 'crewx_response') return true;
      return msg.text && msg.text.trim();
    });

    if (validMessages.length === 0) {
      return { shouldRespond: false, reason: 'no_previous_messages' };
    }

    const activeSpeaker = findActiveSpeaker(validMessages, botId, defaultAgent);

    if (activeSpeaker) {
      if (activeSpeaker === defaultAgent) {
        return { shouldRespond: true, reason: 'is_active_speaker' };
      } else {
        return { shouldRespond: false, reason: `other_active_speaker:${activeSpeaker}` };
      }
    }

    return { shouldRespond: false, reason: 'no_active_speaker' };
  }

  return { shouldRespond: false, reason: 'channel_no_mention' };
}

describe('Last Speaker Detection - Regression Prevention Tests', () => {
  const BOT_USER_ID = 'U_BOT_CREWX';
  const BOT_ID = 'B_CREWX_APP';
  const DEFAULT_AGENT = 'claude';

  /**
   * Helper: Create a user message
   */
  function createUserMessage(text: string, ts: string, threadTs?: string) {
    return {
      text,
      user: 'U_USER_1',
      ts,
      thread_ts: threadTs,
      channel_type: 'channel',
    };
  }

  /**
   * Helper: Create a bot message with full metadata (ideal case)
   */
  function createBotMessageWithMetadata(agentId: string, ts: string) {
    return {
      text: `✅ Completed! (@${agentId})`,
      user: BOT_USER_ID,
      ts,
      bot_id: BOT_ID,
      metadata: {
        event_type: 'crewx_response',
        event_payload: {
          agent_id: agentId,
          provider: agentId,
          task_id: 'test-task',
        },
      },
    };
  }

  /**
   * Helper: Create a bot message without metadata (fallback to text pattern)
   */
  function createBotMessageWithTextPattern(agentId: string, ts: string) {
    return {
      text: `✅ Completed! (@${agentId})`,
      user: BOT_USER_ID,
      ts,
      bot_id: BOT_ID,
      // No metadata - should fallback to text pattern
    };
  }

  /**
   * Helper: Create a bot message without metadata or text pattern (fallback to bot_id)
   */
  function createBotMessageWithOnlyBotId(ts: string) {
    return {
      text: 'Bot response without pattern',
      user: BOT_USER_ID,
      ts,
      bot_id: BOT_ID,
      // No metadata, no text pattern
    };
  }

  describe('CRITICAL: mentionOnly=false should auto-respond when bot is active speaker', () => {
    it('should respond when bot has metadata.agent_id matching defaultAgent', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        createUserMessage('tell me more', '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });

    it('should respond when bot message uses text pattern (@claude)', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithTextPattern('claude', '1000.002'),
        createUserMessage('tell me more', '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });

    it('should respond when bot_id matches and no other identification available', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithOnlyBotId('1000.002'),
        createUserMessage('tell me more', '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });

    it('should continue responding to multiple follow-up messages', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        createUserMessage('first follow-up', '1000.003', '1000.001'),
        createBotMessageWithMetadata('claude', '1000.004'),
        createUserMessage('second follow-up', '1000.005', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[4], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });
  });

  describe('CRITICAL: mentionOnly=true should require explicit mention', () => {
    it('should NOT respond without mention even when bot is active speaker', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        createUserMessage('tell me more', '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: true, // <-- This should block auto-response
      });

      expect(result.shouldRespond).toBe(false);
      expect(result.reason).toBe('mention_only_mode');
    });

    it('should respond with explicit mention in mentionOnly mode', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> hello`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        createUserMessage(`<@${BOT_USER_ID}> tell me more`, '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: true,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('explicit_mention');
    });
  });

  describe('Active speaker detection with different agent scenarios', () => {
    it('should NOT respond when different agent is active speaker', () => {
      const messages = [
        createUserMessage(`<@OTHER_BOT> hello`, '1000.001'),
        createBotMessageWithMetadata('gemini', '1000.002'), // Gemini is active speaker
        createUserMessage('tell me more', '1000.003', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[2], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude', // We are Claude, but Gemini is active
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(false);
      expect(result.reason).toBe('other_active_speaker:gemini');
    });

    it('should respect active speaker transfer when user mentions different bot', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> start`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        createUserMessage('continue', '1000.003', '1000.001'),
        createBotMessageWithMetadata('claude', '1000.004'),
        createUserMessage(`<@OTHER_BOT> your turn`, '1000.005', '1000.001'), // Switch to other bot
        createBotMessageWithMetadata('gemini', '1000.006'), // Gemini becomes active speaker
        createUserMessage('continue', '1000.007', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[6], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(false);
      expect(result.reason).toBe('other_active_speaker:gemini');
    });

    it('should use LAST bot response as active speaker (not first)', () => {
      const messages = [
        createUserMessage('compare', '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'), // Claude first
        createBotMessageWithMetadata('gemini', '1000.003'), // Gemini LAST
        createUserMessage('thanks', '1000.004', '1000.001'),
      ];

      // Claude perspective
      const claudeResult = shouldRespondInThread(messages, messages[3], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(claudeResult.shouldRespond).toBe(false);
      expect(claudeResult.reason).toBe('other_active_speaker:gemini');

      // Gemini perspective (if we were the Gemini instance)
      const geminiResult = shouldRespondInThread(messages, messages[3], {
        botUserId: 'U_BOT_GEMINI',
        botId: BOT_ID,
        defaultAgent: 'gemini',
        mentionOnly: false,
      });

      expect(geminiResult.shouldRespond).toBe(true);
      expect(geminiResult.reason).toBe('is_active_speaker');
    });
  });

  describe('Edge cases for active speaker detection', () => {
    it('should NOT auto-respond if no bot has responded yet', () => {
      const messages = [
        createUserMessage('hello', '1000.001'),
        createUserMessage('anyone there?', '1000.002', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[1], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(false);
      expect(result.reason).toBe('no_active_speaker');
    });

    it('should filter out file-only uploads when detecting active speaker', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> analyze`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        {
          // File-only upload (no text)
          text: '',
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          files: [{ id: 'F123', name: 'image.png' }],
        },
        createUserMessage('what do you think?', '1000.004', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[3], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      // Claude should still be active speaker (file upload doesn't change it)
      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });

    it('should handle messages with file AND text (valid conversation turn)', () => {
      const messages = [
        createUserMessage(`<@${BOT_USER_ID}> start`, '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'),
        {
          // File with text (should be valid)
          text: 'here is the file',
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          files: [{ id: 'F456', name: 'data.csv' }],
        },
        createUserMessage('analyze it', '1000.004', '1000.001'),
      ];

      const result = shouldRespondInThread(messages, messages[3], {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });

      expect(result.shouldRespond).toBe(true);
      expect(result.reason).toBe('is_active_speaker');
    });
  });

  describe('findActiveSpeaker function unit tests', () => {
    it('should return agent_id from metadata when available', () => {
      const messages = [
        createBotMessageWithMetadata('gemini', '1000.001'),
        createBotMessageWithMetadata('claude', '1000.002'), // Last
      ];

      const result = findActiveSpeaker(messages, BOT_ID, 'claude');
      expect(result).toBe('claude'); // Last bot message
    });

    it('should fallback to text pattern when metadata missing', () => {
      const messages = [
        createBotMessageWithTextPattern('claude', '1000.001'),
      ];

      const result = findActiveSpeaker(messages, BOT_ID, 'gemini');
      expect(result).toBe('claude'); // Extracted from text
    });

    it('should fallback to defaultAgent when bot_id matches and no other identification', () => {
      const messages = [
        createBotMessageWithOnlyBotId('1000.001'),
      ];

      const result = findActiveSpeaker(messages, BOT_ID, 'claude');
      expect(result).toBe('claude'); // Fallback to defaultAgent
    });

    it('should return null when no bot messages exist', () => {
      const messages = [
        createUserMessage('hello', '1000.001'),
        createUserMessage('world', '1000.002'),
      ];

      const result = findActiveSpeaker(messages, BOT_ID, 'claude');
      expect(result).toBe(null);
    });

    it('should return null when bot message has different bot_id and no pattern', () => {
      const messages = [
        {
          text: 'Some bot response',
          user: 'U_OTHER_BOT',
          ts: '1000.001',
          bot_id: 'B_OTHER_APP', // Different bot
        },
      ];

      const result = findActiveSpeaker(messages, BOT_ID, 'claude');
      expect(result).toBe(null); // Cannot determine
    });
  });

  describe('DM behavior (always respond)', () => {
    it('should always respond to DMs regardless of mentionOnly setting', () => {
      const dmMessage = {
        text: 'hello',
        user: 'U_USER_1',
        ts: '1000.001',
        channel_type: 'im',
      };

      // mentionOnly=false
      const result1 = shouldRespondInThread([dmMessage], dmMessage, {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: false,
      });
      expect(result1.shouldRespond).toBe(true);
      expect(result1.reason).toBe('direct_message');

      // mentionOnly=true
      const result2 = shouldRespondInThread([dmMessage], dmMessage, {
        botUserId: BOT_USER_ID,
        botId: BOT_ID,
        defaultAgent: 'claude',
        mentionOnly: true,
      });
      expect(result2.shouldRespond).toBe(true);
      expect(result2.reason).toBe('direct_message');
    });
  });
});
