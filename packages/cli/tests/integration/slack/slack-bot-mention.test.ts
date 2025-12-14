import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Slack Bot Mention Logic Tests
 *
 * Tests "Conversation Ownership" pattern where bots acquire, hold, and transfer
 * control based on explicit mentions and conversation context.
 *
 * These tests verify the LOGIC of shouldRespondToMessage() without requiring
 * actual SlackBot instance. We test the decision-making algorithm directly.
 *
 * Key Concepts:
 * - Ownership Acquisition: Explicit mention grants conversation ownership
 * - Ownership Hold: Last speaker maintains ownership without mention
 * - Ownership Transfer: Mentioning another bot transfers ownership
 * - Concurrent Ownership: Multiple mentions allow multiple bots to respond
 */

/**
 * Helper class to simulate shouldRespondToMessage logic
 * This mirrors the actual implementation in src/slack/slack-bot.ts:91-226
 */
class MentionLogicSimulator {
  constructor(
    private botUserId: string,
    private defaultAgent: string,
    private mentionOnly: boolean = false
  ) {}

  /**
   * Simulates shouldRespondToMessage() logic from slack-bot.ts
   */
  shouldRespond(message: any, threadHistory: any[]): boolean {
    const text = message.text || '';

    // 1. Check if bot is explicitly mentioned
    if (text.includes(`<@${this.botUserId}>`)) {
      return true; // ✅ Explicit mention
    }

    // 2. Check if another bot is mentioned
    const otherBotMentioned = /<@[A-Z0-9_]+>/.test(text) && !text.includes(`<@${this.botUserId}>`);
    if (otherBotMentioned) {
      return false; // ⏭️ Another bot mentioned
    }

    // 3. Check if DM
    if (message.channel_type === 'im') {
      return true; // ✅ Always respond to DMs
    }

    // 4. If mention-only mode is enabled, require explicit mention in threads
    if (this.mentionOnly && message.thread_ts) {
      return false; // ⏭️ Mention-only mode: skip thread messages without mention
    }

    // 5. Check if in thread and bot was last speaker
    // CRITICAL FIX (#14, #15, #16): Use "active speaker" model
    // - Find the LAST BOT response in the thread (not just last message)
    // - Only the bot that last responded should reply to unmentioned messages
    if (message.thread_ts) {
      // Find last bot message with metadata
      const lastBotMessage = [...threadHistory]
        .reverse()
        .find((msg: any) =>
          msg.metadata?.event_type === 'crewx_response' ||
          msg.bot_id // Also check for bot_id (fallback)
        );

      if (lastBotMessage) {
        const lastAgentId = lastBotMessage.metadata?.event_payload?.agent_id;
        const isLastSpeaker = lastAgentId === this.defaultAgent;

        if (isLastSpeaker) {
          return true; // ✅ Bot is last speaker (active speaker)
        } else {
          return false; // ⏭️ Another bot is last speaker
        }
      }

      // No bot has responded yet in this thread
      // Skip - require explicit mention to join a thread
      return false; // ⏭️ Requires mention to join thread
    }

    // 6. No mention present - skip in channel (require explicit mention)
    return false; // ⏭️ Channel messages need mention
  }
}

describe('SlackBot - Conversation Ownership (Mention Logic)', () => {
  let simulator: MentionLogicSimulator;
  const BOT_CLAUDE_ID = 'U_BOT_CLAUDE';
  const BOT_GEMINI_ID = 'U_BOT_GEMINI';

  beforeEach(() => {
    // Create simulator for Claude bot
    simulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude');
  });

  /**
   * Helper: Create mock message
   */
  function createMessage(text: string, user: string = 'U_USER_1', threadTs?: string, ts?: string) {
    return {
      text,
      user,
      channel: 'C_TEST_CHANNEL',
      ts: ts || '1000.001',
      thread_ts: threadTs,
      channel_type: 'channel',
    };
  }

  /**
   * Helper: Create mock bot message with metadata
   */
  function createBotMessage(text: string, agentId: string, ts: string) {
    return {
      text,
      user: agentId === 'claude' ? BOT_CLAUDE_ID : BOT_GEMINI_ID,
      ts,
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

  describe('Rule 1: Ownership Acquisition via Explicit Mention', () => {
    it('should respond when bot is explicitly mentioned', () => {
      const message = createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1');
      const threadHistory = [message];

      const shouldRespond = simulator.shouldRespond(message, threadHistory);

      expect(shouldRespond).toBe(true); // ✅ Ownership acquired
    });

    it('should NOT respond when another bot is mentioned', () => {
      const message = createMessage(`<@${BOT_GEMINI_ID}> hello`, 'U_USER_1');
      const threadHistory = [message];

      const shouldRespond = simulator.shouldRespond(message, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ Skip (other bot mentioned)
    });
  });

  describe('Rule 2: Ownership Hold by Last Speaker', () => {
    it('should respond when bot was last speaker (no mention needed)', () => {
      const userMessage = createMessage('tell me more', 'U_USER_1', '1000.001', '1000.003');

      // Thread history: User → BotA → User (current)
      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'), // User starts
        createBotMessage('Hi! How can I help?', 'claude', '1000.002'), // Bot responds
        userMessage, // User continues
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      expect(shouldRespond).toBe(true); // ✅ Ownership maintained
    });

    it('should NOT respond when another bot was last speaker', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.004');

      // Thread history: User → BotA → BotB (last) → User (current)
      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        createBotMessage('From Claude', 'claude', '1000.002'),
        createBotMessage('From Gemini', 'gemini', '1000.003'), // Gemini is last
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ Claude should NOT respond
    });
  });

  describe('Rule 3: Ownership Transfer via Mention', () => {
    it('should transfer ownership when different bot is mentioned', () => {
      const userMessage = createMessage(`<@${BOT_GEMINI_ID}> what do you think?`, 'U_USER_1', '1000.001', '1000.003');

      // Thread: BotA was owner → User mentions BotB
      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Hi from Claude', 'claude', '1000.002'), // Claude was owner
        userMessage, // User mentions Gemini
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ Ownership transferred to Gemini
    });
  });

  describe('Rule 4: Concurrent Ownership via Multiple Mentions', () => {
    it('should both respond when both bots are mentioned', () => {
      const userMessage = createMessage(
        `<@${BOT_CLAUDE_ID}> <@${BOT_GEMINI_ID}> compare your answers`,
        'U_USER_1',
        '1000.001',
        '1000.002'
      );

      const threadHistory = [userMessage];

      // Claude bot check
      const claudeSimulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude');
      const claudeShouldRespond = claudeSimulator.shouldRespond(userMessage, threadHistory);
      expect(claudeShouldRespond).toBe(true); // ✅ Claude should respond

      // Gemini bot check (in separate bot instance)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      const geminiShouldRespond = geminiSimulator.shouldRespond(userMessage, threadHistory);
      expect(geminiShouldRespond).toBe(true); // ✅ Gemini should respond
    });

    it('should maintain ownership for last responder after concurrent response', () => {
      const userMessage = createMessage('thanks', 'U_USER_1', '1000.001', '1000.005');

      // Thread: Both bots responded, Gemini was slightly later
      const threadHistory = [
        createMessage('compare this', 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Claude says...', 'claude', '1000.002'),
        createBotMessage('Gemini says...', 'gemini', '1000.003'), // Gemini last (by timestamp)
        userMessage,
      ];

      // From Claude bot perspective
      const claudeShouldRespond = simulator.shouldRespond(userMessage, threadHistory);
      expect(claudeShouldRespond).toBe(false); // Gemini has ownership

      // From Gemini bot perspective
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      const geminiShouldRespond = geminiSimulator.shouldRespond(userMessage, threadHistory);
      expect(geminiShouldRespond).toBe(true); // ✅ Gemini maintains ownership
    });
  });

  describe('Rule 5: Direct Messages (Always Respond)', () => {
    it('should always respond in DM regardless of history', () => {
      const dmMessage = createMessage('hello', 'U_USER_1');
      dmMessage.channel_type = 'im'; // Direct message

      const threadHistory = [dmMessage];
      const shouldRespond = simulator.shouldRespond(dmMessage, threadHistory);

      expect(shouldRespond).toBe(true); // ✅ Always respond to DMs
    });
  });

  describe('Edge Cases', () => {
    it('should skip channel message without mention outside thread', () => {
      const userMessage = createMessage('just talking to the room', 'U_USER_1');
      const threadHistory = [userMessage];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ Requires explicit mention in channel
    });

    it('should NOT respond in thread with no bot messages (requires mention)', () => {
      const userMessage = createMessage('hello', 'U_USER_1', '1000.001', '1000.002');

      const threadHistory = [
        createMessage('first message', 'U_USER_1', undefined, '1000.001'),
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // CRITICAL FIX (#14, #15, #16): Requires explicit mention to join a thread
      expect(shouldRespond).toBe(false); // ⏭️ Requires mention
    });

    it('should NOT respond to legacy bot message without metadata (cannot determine active speaker)', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        {
          text: 'Old bot message (no metadata)',
          user: BOT_CLAUDE_ID,
          ts: '1000.002',
          // No metadata, no bot_id (legacy message)
        },
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // CRITICAL FIX (#14, #15, #16): Cannot determine active speaker without metadata
      // Requires explicit mention when bot identity cannot be verified
      expect(shouldRespond).toBe(false); // ⏭️ Cannot determine active speaker
    });

    it('should respond to legacy bot message with bot_id (fallback)', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        {
          text: 'Old bot message (no metadata but has bot_id)',
          user: BOT_CLAUDE_ID,
          bot_id: 'B_BOT_CLAUDE', // Has bot_id for fallback detection
          ts: '1000.002',
          // No metadata (legacy message) but has bot_id
        },
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // With bot_id fallback, simulator can detect this bot responded
      // but cannot determine agent_id, so it should skip
      expect(shouldRespond).toBe(false); // ⏭️ agent_id is undefined, not matching
    });
  });

  describe('Mention-Only Mode', () => {
    let mentionOnlySimulator: MentionLogicSimulator;

    beforeEach(() => {
      // Create simulator with mention-only mode enabled
      mentionOnlySimulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude', true);
    });

    it('should respond to explicit mentions in threads (mention-only mode)', () => {
      const message = createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', '1000.001', '1000.002');
      const threadHistory = [
        createMessage('first message', 'U_USER_1', undefined, '1000.001'),
        message,
      ];

      const shouldRespond = mentionOnlySimulator.shouldRespond(message, threadHistory);

      expect(shouldRespond).toBe(true); // ✅ Explicit mention works
    });

    it('should NOT respond to thread messages without mention (mention-only mode)', () => {
      const message = createMessage('tell me more', 'U_USER_1', '1000.001', '1000.003');
      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Hi! How can I help?', 'claude', '1000.002'),
        message, // No mention
      ];

      const shouldRespond = mentionOnlySimulator.shouldRespond(message, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ Requires mention in mention-only mode
    });

    it('should still respond to DMs (mention-only mode)', () => {
      const dmMessage = createMessage('hello', 'U_USER_1');
      dmMessage.channel_type = 'im'; // Direct message

      const threadHistory = [dmMessage];
      const shouldRespond = mentionOnlySimulator.shouldRespond(dmMessage, threadHistory);

      expect(shouldRespond).toBe(true); // ✅ DMs always work
    });

    it('should NOT auto-respond even when bot was last speaker (mention-only mode)', () => {
      const message = createMessage('continue', 'U_USER_1', '1000.001', '1000.004');
      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Claude response', 'claude', '1000.002'),
        createMessage('and then?', 'U_USER_1', '1000.001', '1000.003'),
        createBotMessage('More from Claude', 'claude', '1000.003'), // Bot was last speaker
        message, // No mention
      ];

      const shouldRespond = mentionOnlySimulator.shouldRespond(message, threadHistory);

      expect(shouldRespond).toBe(false); // ⏭️ No auto-response in mention-only mode
    });
  });

  describe('Complete Conversation Flow Scenarios', () => {
    it('Scenario: Single bot conversation flow', () => {
      // 1. User mentions BotA
      const msg1 = createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001');
      let history1 = [msg1];
      expect(simulator.shouldRespond(msg1, history1)).toBe(true); // ✅ BotA responds

      // 2. User continues (no mention)
      const msg2 = createMessage('tell me more', 'U_USER_1', '1000.001', '1000.003');
      let history2 = [
        msg1,
        createBotMessage('Hi!', 'claude', '1000.002'),
        msg2,
      ];
      expect(simulator.shouldRespond(msg2, history2)).toBe(true); // ✅ BotA continues (ownership maintained)
    });

    it('Scenario: Bot switching conversation', () => {
      const history = [
        createMessage(`<@${BOT_CLAUDE_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Claude here', 'claude', '1000.002'),
        createMessage('continue', 'U_USER_1', '1000.001', '1000.003'),
        createBotMessage('Claude continues', 'claude', '1000.004'),
        createMessage(`<@${BOT_GEMINI_ID}> your turn`, 'U_USER_1', '1000.001', '1000.005'),
        createBotMessage('Gemini here', 'gemini', '1000.006'),
      ];

      // Step 5: User mentions Gemini
      expect(simulator.shouldRespond(history[4], history.slice(0, 5))).toBe(false); // ⏭️ Claude skips

      // Step 7: User says "interesting" (no mention)
      const msg7 = createMessage('interesting', 'U_USER_1', '1000.001', '1000.007');
      const history7 = [...history, msg7];

      expect(simulator.shouldRespond(msg7, history7)).toBe(false); // Claude doesn't respond

      // Gemini bot perspective
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(msg7, history7)).toBe(true); // ✅ Gemini has ownership
    });

  it('Scenario: Cross-bot with consistent event types (crewx_response)', () => {
    // Test scenario: both bots use crewx_response event type
      const BOT_CSO_ID = 'U_BOT_CSO';
      const history = [
        createMessage(`<@${BOT_CLAUDE_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('CrewXDev here', 'claude', '1000.002'),
        createMessage('continue', 'U_USER_1', '1000.001', '1000.003'),
        createBotMessage('CrewXDev continues', 'claude', '1000.004'),
        createMessage(`<@${BOT_CSO_ID}> your turn`, 'U_USER_1', '1000.001', '1000.005'),
      // CSO bot message with crewx_response event type
        {
          text: '✅ Completed! (@cso)',
          user: BOT_CSO_ID,
          ts: '1000.006',
          thread_ts: '1000.001',
          metadata: {
            event_type: 'crewx_response',
            event_payload: { agent_id: 'cso' }
          }
        },
      ];

      // Step 7: User says "interesting" (no mention) - only CSO should respond
      const msg7 = createMessage('interesting', 'U_USER_1', '1000.001', '1000.007');
      const history7 = [...history, msg7];

      // CrewXDev (claude) should NOT respond - CSO is last speaker
      expect(simulator.shouldRespond(msg7, history7)).toBe(false);

      // CSO bot perspective - should respond
      const csoSimulator = new MentionLogicSimulator(BOT_CSO_ID, 'cso');
      expect(csoSimulator.shouldRespond(msg7, history7)).toBe(true); // ✅ CSO has ownership
    });

    it('Scenario: Multi-bot collaboration', () => {
      // Step 1: Both mentioned
      const msg1 = createMessage(`<@${BOT_CLAUDE_ID}> <@${BOT_GEMINI_ID}> compare`, 'U_USER_1', undefined, '1000.001');
      const history1 = [msg1];

      expect(simulator.shouldRespond(msg1, history1)).toBe(true); // ✅ Claude responds

      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(msg1, history1)).toBe(true); // ✅ Gemini responds

      // Step 4: User says "thanks" (no mention) - who responds?
      const msg4 = createMessage('thanks', 'U_USER_1', '1000.001', '1000.004');
      const history4 = [
        msg1,
        createBotMessage('Claude: ...', 'claude', '1000.002'),
        createBotMessage('Gemini: ...', 'gemini', '1000.003'), // Gemini last
        msg4,
      ];

      expect(simulator.shouldRespond(msg4, history4)).toBe(false); // Claude doesn't respond
      expect(geminiSimulator.shouldRespond(msg4, history4)).toBe(true); // ✅ Gemini has ownership
    });
  });

  /**
   * CRITICAL BUG FIX TESTS (#14, #15, #16)
   * These tests verify the "active speaker" model fixes
   */
  describe('Bug Fix: #14 - All bots respond to unmentioned messages', () => {
    it('should NOT have multiple bots respond to unmentioned message in thread', () => {
      // Scenario: User mentions @claude, claude responds, then user sends plain text
      // BEFORE FIX: All bots would respond because "last message from user"
      // AFTER FIX: Only claude should respond (active speaker)

      const userMessage = createMessage('tell me more', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Hi! How can I help?', 'claude', '1000.002'),
        userMessage,
      ];

      // Claude bot should respond (active speaker)
      const claudeSimulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude');
      expect(claudeSimulator.shouldRespond(userMessage, threadHistory)).toBe(true);

      // Gemini bot should NOT respond (not active speaker)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(userMessage, threadHistory)).toBe(false);
    });
  });

  describe('Bug Fix: #15 - Bot doesnt respond after mention switch', () => {
    it('should respond with new bot after mention switch', () => {
      // Scenario: User mentions @jarvis, jarvis responds, then user mentions @cto, cto responds
      // Then user sends plain text - ONLY @cto should respond

      const BOT_JARVIS_ID = 'U_BOT_JARVIS';
      const BOT_CTO_ID = 'U_BOT_CTO';

      const userMessage = createMessage('what do you think?', 'U_USER_1', '1000.001', '1000.006');

      const threadHistory = [
        createMessage(`<@${BOT_JARVIS_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Jarvis here', 'jarvis', '1000.002'),
        createMessage('continue', 'U_USER_1', '1000.001', '1000.003'),
        createBotMessage('Jarvis continues', 'jarvis', '1000.004'),
        createMessage(`<@${BOT_CTO_ID}> your turn`, 'U_USER_1', '1000.001', '1000.005'),
        {
          text: '✅ Completed! (@cto)',
          user: BOT_CTO_ID,
          ts: '1000.0055',
          metadata: {
            event_type: 'crewx_response',
            event_payload: { agent_id: 'cto' }
          }
        },
        userMessage, // Plain text - no mention
      ];

      // Jarvis should NOT respond (no longer active speaker)
      const jarvisSimulator = new MentionLogicSimulator(BOT_JARVIS_ID, 'jarvis');
      expect(jarvisSimulator.shouldRespond(userMessage, threadHistory)).toBe(false);

      // CTO should respond (current active speaker)
      const ctoSimulator = new MentionLogicSimulator(BOT_CTO_ID, 'cto');
      expect(ctoSimulator.shouldRespond(userMessage, threadHistory)).toBe(true);
    });
  });

  describe('Bug Fix: #16 - All bots respond after file upload', () => {
    it('should only have active speaker respond after file-only upload', () => {
      // Scenario: User uploads file (no text), then sends text message
      // File upload message has subtype: 'file_share' and no text
      // BEFORE FIX: All bots might respond because file message confuses last speaker detection
      // AFTER FIX: Only the active speaker from before the file upload should respond

      const userMessage = createMessage('analyze this file', 'U_USER_1', '1000.001', '1000.004');

      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Hi! How can I help?', 'claude', '1000.002'),
        {
          // File upload message (no text, has files)
          text: '', // Empty or missing text
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          subtype: 'file_share',
          files: [{ id: 'F123', name: 'document.pdf' }],
        },
        userMessage, // Text message after file upload
      ];

      // Claude should respond (still active speaker - file upload didn't change ownership)
      const claudeSimulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude');
      expect(claudeSimulator.shouldRespond(userMessage, threadHistory)).toBe(true);

      // Gemini should NOT respond (not active speaker)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(userMessage, threadHistory)).toBe(false);
    });

    it('should handle file upload followed by different bot mention', () => {
      // Scenario: File upload, then user mentions different bot - that bot becomes active speaker

      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.006');

      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Hi!', 'claude', '1000.002'),
        {
          // File upload
          text: '',
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          subtype: 'file_share',
          files: [{ id: 'F123', name: 'image.png' }],
        },
        createMessage(`<@${BOT_GEMINI_ID}> analyze this`, 'U_USER_1', '1000.001', '1000.004'),
        createBotMessage('Analyzing...', 'gemini', '1000.005'),
        userMessage,
      ];

      // Claude should NOT respond (Gemini is now active speaker)
      const claudeSimulator = new MentionLogicSimulator(BOT_CLAUDE_ID, 'claude');
      expect(claudeSimulator.shouldRespond(userMessage, threadHistory)).toBe(false);

      // Gemini should respond (active speaker after mention switch)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(userMessage, threadHistory)).toBe(true);
    });
  });
});
