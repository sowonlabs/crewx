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
 * This mirrors the actual implementation in src/slack/slack-bot.ts:118-213
 *
 * Issue #10 v0.7.8-rc.3 Fix:
 * - Filter out file-only uploads (user messages with no text)
 * - Do NOT auto-respond if no bot has responded yet (require explicit mention)
 * - Use thread ownership (first bot responder) for subsequent responses
 */
class MentionLogicSimulator {
  constructor(
    private botUserId: string,
    private defaultAgent: string,
    private mentionOnly: boolean = false,
    private botId: string = 'B_BOT_ID' // For bot_id matching fallback
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

    // 5. Check if in thread - apply Thread Ownership logic
    if (message.thread_ts) {
      // Get previous messages (exclude current message)
      const previousMessages = threadHistory.filter(
        (msg: any) => msg.ts !== message.ts
      );

      // FIX (Issue #10 v0.7.8-rc.3): Filter out file-only uploads
      // User messages with only files (no text) should not be considered as conversation turns
      const validMessages = previousMessages.filter((msg: any) => {
        // Bot messages are always valid conversation turns
        if (msg.bot_id || msg.metadata?.event_type === 'crewx_response') return true;
        // User messages must have actual text content to be a valid turn
        return msg.text && msg.text.trim();
      });

      if (validMessages.length === 0) {
        // No valid previous messages - this is the first real message in thread
        // CRITICAL FIX: Do NOT auto-respond here! Require explicit mention to become owner.
        return false; // ⏭️ Require mention to become owner
      }

      // Find thread owner (first bot that responded in the thread)
      const threadOwner = this.findThreadOwner(validMessages);

      if (threadOwner) {
        const isOwner = threadOwner === this.defaultAgent;
        if (isOwner) {
          return true; // ✅ This bot owns the thread
        } else {
          return false; // ⏭️ Another bot owns this thread
        }
      }

      // No bot has responded yet - CRITICAL FIX: Do NOT auto-respond
      // Bots can only "become owner" by being explicitly mentioned first
      return false; // ⏭️ Require explicit mention
    }

    // 6. No mention present - skip in channel (require explicit mention)
    return false; // ⏭️ Channel messages need mention
  }

  /**
   * Find the thread owner (first bot that responded in the thread)
   * Returns the agent_id of the first bot response, or null if no bot has responded
   */
  private findThreadOwner(messages: any[]): string | null {
    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) =>
      parseFloat(a.ts) - parseFloat(b.ts)
    );

    // Find the first bot message (thread owner)
    for (const msg of sortedMessages) {
      const isBot = !!msg.bot_id || msg.metadata?.event_type === 'crewx_response';

      if (isBot) {
        // Try to get agent_id from metadata first
        let agentId = msg.metadata?.event_payload?.agent_id;

        // FALLBACK 1: Parse agent ID from message text
        // Message format: "✅ Completed! (@agent_name)" or "❌ Error (@agent_name)"
        if (!agentId && msg.text) {
          const agentMatch = msg.text.match(/@([a-zA-Z0-9_]+)\)/);
          if (agentMatch) {
            agentId = agentMatch[1];
          }
        }

        // FALLBACK 2: Check bot_id matches this bot
        if (!agentId && msg.bot_id === this.botId) {
          agentId = this.defaultAgent;
        }

        if (agentId) {
          return agentId;
        }
      }
    }

    return null; // No bot has responded in this thread yet
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

    it('should respond when this bot is thread owner even if another bot responded later', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.004');

      // Thread history: User → BotA (first/owner) → BotB (second) → User (current)
      // Issue #10 v0.7.8-rc.3: Thread OWNER (first responder) maintains ownership
      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        createBotMessage('From Claude', 'claude', '1000.002'), // Claude is FIRST = owner
        createBotMessage('From Gemini', 'gemini', '1000.003'), // Gemini responded second
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // Claude is the thread OWNER (first bot to respond), so it should respond
      expect(shouldRespond).toBe(true); // ✅ Claude is thread owner
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

    it('should maintain ownership for FIRST responder after concurrent response', () => {
      const userMessage = createMessage('thanks', 'U_USER_1', '1000.001', '1000.005');

      // Thread: Both bots responded, Claude was FIRST (thread owner)
      // Issue #10 v0.7.8-rc.3: Uses thread OWNER (first responder), not last speaker
      const threadHistory = [
        createMessage('compare this', 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Claude says...', 'claude', '1000.002'), // Claude FIRST = owner
        createBotMessage('Gemini says...', 'gemini', '1000.003'), // Gemini second
        userMessage,
      ];

      // From Claude bot perspective - Claude is the thread owner (first responder)
      const claudeShouldRespond = simulator.shouldRespond(userMessage, threadHistory);
      expect(claudeShouldRespond).toBe(true); // ✅ Claude is thread owner

      // From Gemini bot perspective - not the owner
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      const geminiShouldRespond = geminiSimulator.shouldRespond(userMessage, threadHistory);
      expect(geminiShouldRespond).toBe(false); // ⏭️ Not the thread owner
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

    it('should NOT respond to thread with no bot messages (Issue #10 fix: require mention)', () => {
      const userMessage = createMessage('hello', 'U_USER_1', '1000.001', '1000.002');

      const threadHistory = [
        createMessage('first message', 'U_USER_1', undefined, '1000.001'),
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // Issue #10 v0.7.8-rc.3 FIX: Do NOT auto-respond if no bot has responded yet
      // Bots can only "become owner" by being explicitly mentioned first
      // This prevents ALL bots from responding simultaneously to non-mentioned messages
      expect(shouldRespond).toBe(false); // ⏭️ Require explicit mention to become owner
    });

    it('should handle bot message without metadata but with bot_id (fallback)', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        {
          text: '✅ Completed! (@claude)', // Format matches the fallback regex
          user: BOT_CLAUDE_ID,
          ts: '1000.002',
          bot_id: 'B_BOT_ID', // Has bot_id but no metadata
          // No metadata (legacy message)
        },
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // Issue #10 v0.7.8-rc.3: Uses text parsing fallback to extract agent ID
      expect(shouldRespond).toBe(true); // ✅ Extracted owner from message text
    });

    it('should NOT respond when bot message has no metadata and no matching text pattern', () => {
      const userMessage = createMessage('continue', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage('hello', 'U_USER_1', undefined, '1000.001'),
        {
          text: 'Old bot message (no pattern)', // No @agent_name) pattern
          user: BOT_CLAUDE_ID,
          ts: '1000.002',
          bot_id: 'B_OTHER_BOT', // Different bot_id
          // No metadata
        },
        userMessage,
      ];

      const shouldRespond = simulator.shouldRespond(userMessage, threadHistory);

      // Issue #10 v0.7.8-rc.3: Cannot determine owner, skip to be safe
      expect(shouldRespond).toBe(false); // ⏭️ Unknown owner, require explicit mention
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

    it('Scenario: Bot switching conversation (thread owner perspective)', () => {
      // Issue #10 v0.7.8-rc.3: Thread owner (FIRST responder) maintains ownership
      // Even if another bot responds later via mention, FIRST responder remains owner
      const history = [
        createMessage(`<@${BOT_CLAUDE_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Claude here', 'claude', '1000.002'), // Claude FIRST = owner
        createMessage('continue', 'U_USER_1', '1000.001', '1000.003'),
        createBotMessage('Claude continues', 'claude', '1000.004'),
        createMessage(`<@${BOT_GEMINI_ID}> your turn`, 'U_USER_1', '1000.001', '1000.005'),
        createBotMessage('Gemini here', 'gemini', '1000.006'),
      ];

      // Step 5: User mentions Gemini - Claude skips because another bot mentioned
      expect(simulator.shouldRespond(history[4], history.slice(0, 5))).toBe(false); // ⏭️ Claude skips

      // Step 7: User says "interesting" (no mention)
      // Thread owner (Claude - first responder) should respond
      const msg7 = createMessage('interesting', 'U_USER_1', '1000.001', '1000.007');
      const history7 = [...history, msg7];

      // Claude is thread OWNER (first bot to respond)
      expect(simulator.shouldRespond(msg7, history7)).toBe(true); // ✅ Claude is thread owner

      // Gemini is NOT the owner (responded second)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(msg7, history7)).toBe(false); // ⏭️ Not thread owner
    });

    it('Scenario: Cross-bot with consistent event types (thread owner)', () => {
      // Test scenario: both bots use crewx_response event type
      // Issue #10 v0.7.8-rc.3: Thread owner (FIRST responder) maintains ownership
      const BOT_CSO_ID = 'U_BOT_CSO';
      const history = [
        createMessage(`<@${BOT_CLAUDE_ID}> start`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('CrewXDev here', 'claude', '1000.002'), // Claude FIRST = owner
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

      // Step 7: User says "interesting" (no mention)
      // Thread owner (Claude - first responder) should respond
      const msg7 = createMessage('interesting', 'U_USER_1', '1000.001', '1000.007');
      const history7 = [...history, msg7];

      // CrewXDev (claude) is thread OWNER (first responder)
      expect(simulator.shouldRespond(msg7, history7)).toBe(true); // ✅ Claude is thread owner

      // CSO is NOT the owner
      const csoSimulator = new MentionLogicSimulator(BOT_CSO_ID, 'cso');
      expect(csoSimulator.shouldRespond(msg7, history7)).toBe(false); // ⏭️ Not thread owner
    });

    it('Scenario: Multi-bot collaboration (first responder wins)', () => {
      // Step 1: Both mentioned
      const msg1 = createMessage(`<@${BOT_CLAUDE_ID}> <@${BOT_GEMINI_ID}> compare`, 'U_USER_1', undefined, '1000.001');
      const history1 = [msg1];

      expect(simulator.shouldRespond(msg1, history1)).toBe(true); // ✅ Claude responds

      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      expect(geminiSimulator.shouldRespond(msg1, history1)).toBe(true); // ✅ Gemini responds

      // Step 4: User says "thanks" (no mention) - who responds?
      // Issue #10 v0.7.8-rc.3: Thread owner (FIRST responder) maintains ownership
      const msg4 = createMessage('thanks', 'U_USER_1', '1000.001', '1000.004');
      const history4 = [
        msg1,
        createBotMessage('Claude: ...', 'claude', '1000.002'), // Claude FIRST = owner
        createBotMessage('Gemini: ...', 'gemini', '1000.003'), // Gemini second
        msg4,
      ];

      // Claude is thread OWNER (first responder)
      expect(simulator.shouldRespond(msg4, history4)).toBe(true); // ✅ Claude is thread owner
      // Gemini is NOT the owner
      expect(geminiSimulator.shouldRespond(msg4, history4)).toBe(false); // ⏭️ Not thread owner
    });
  });

  describe('Issue #10 v0.7.8-rc.3 Fix: File-only Upload Scenario', () => {
    /**
     * This test covers the bug scenario:
     * 1. Bot A responds in thread
     * 2. User uploads file only (no text, text: "")
     * 3. User sends text message
     * Expected: Only Bot A responds (maintains ownership)
     * Bug: ALL bots responded because file-only upload was treated as a "conversation turn"
     */
    it('should filter out file-only uploads and maintain thread ownership', () => {
      const userTextMessage = createMessage('what do you think?', 'U_USER_1', '1000.001', '1000.004');

      // Thread history: User mentions Bot → Bot responds → User uploads file (no text) → User sends text
      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> hello`, 'U_USER_1', undefined, '1000.001'), // User mentions bot
        createBotMessage('Hi! How can I help?', 'claude', '1000.002'), // Bot responds
        {
          // File-only upload (no text)
          text: '',
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          files: [{ id: 'F123', name: 'image.png' }],
          channel_type: 'channel',
        },
        userTextMessage, // User sends text (current message)
      ];

      // Claude (thread owner) should respond
      const claudeShouldRespond = simulator.shouldRespond(userTextMessage, threadHistory);
      expect(claudeShouldRespond).toBe(true); // ✅ Claude maintains ownership

      // Gemini should NOT respond (not the thread owner)
      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      const geminiShouldRespond = geminiSimulator.shouldRespond(userTextMessage, threadHistory);
      expect(geminiShouldRespond).toBe(false); // ⏭️ Not the owner
    });

    it('should NOT all bots respond to non-mentioned message in new thread (Bug #1)', () => {
      // Scenario: User sends "111111" then "22222" without any mentions
      // Expected: NO bots respond (they require explicit mention)
      // Bug: ALL bots responded

      const userMessage2 = createMessage('22222', 'U_USER_1', '1000.001', '1000.002');

      const threadHistory = [
        createMessage('111111', 'U_USER_1', undefined, '1000.001'), // First message (no mention)
        userMessage2, // Second message (no mention)
      ];

      // All bots should skip - no one has been mentioned
      const claudeShouldRespond = simulator.shouldRespond(userMessage2, threadHistory);
      expect(claudeShouldRespond).toBe(false); // ⏭️ Require explicit mention

      const geminiSimulator = new MentionLogicSimulator(BOT_GEMINI_ID, 'gemini');
      const geminiShouldRespond = geminiSimulator.shouldRespond(userMessage2, threadHistory);
      expect(geminiShouldRespond).toBe(false); // ⏭️ Require explicit mention
    });

    it('should correctly identify thread owner via metadata (Bug #2 - wrong agent selected)', () => {
      // Scenario: User mentions @crewx_dev_lead but @cso responds instead
      // This tests that the metadata agent_id is correctly used for ownership

      const BOT_DEV_LEAD_ID = 'U_BOT_DEV_LEAD';
      const BOT_CSO_ID = 'U_BOT_CSO';

      const userFollowUp = createMessage('what else?', 'U_USER_1', '1000.001', '1000.003');

      const threadHistory = [
        createMessage(`<@${BOT_DEV_LEAD_ID}> hello`, 'U_USER_1', undefined, '1000.001'),
        {
          text: '✅ Completed! (@crewx_dev_lead)',
          user: BOT_DEV_LEAD_ID,
          ts: '1000.002',
          thread_ts: '1000.001',
          bot_id: 'B_DEV_LEAD',
          metadata: {
            event_type: 'crewx_response',
            event_payload: { agent_id: 'crewx_dev_lead' }, // Correct metadata
          },
        },
        userFollowUp,
      ];

      // Dev Lead should respond (thread owner)
      const devLeadSimulator = new MentionLogicSimulator(BOT_DEV_LEAD_ID, 'crewx_dev_lead');
      expect(devLeadSimulator.shouldRespond(userFollowUp, threadHistory)).toBe(true);

      // CSO should NOT respond
      const csoSimulator = new MentionLogicSimulator(BOT_CSO_ID, 'cso');
      expect(csoSimulator.shouldRespond(userFollowUp, threadHistory)).toBe(false);
    });

    it('should handle empty text messages with files correctly', () => {
      // File + text upload should count as valid conversation turn
      const userFollowUp = createMessage('what is this?', 'U_USER_1', '1000.001', '1000.004');

      const threadHistory = [
        createMessage(`<@${BOT_CLAUDE_ID}> analyze`, 'U_USER_1', undefined, '1000.001'),
        createBotMessage('Sure, upload a file', 'claude', '1000.002'),
        {
          // File WITH text (should be valid)
          text: 'here is the file',
          user: 'U_USER_1',
          ts: '1000.003',
          thread_ts: '1000.001',
          files: [{ id: 'F456', name: 'data.csv' }],
          channel_type: 'channel',
        },
        userFollowUp,
      ];

      // Claude (thread owner) should respond
      expect(simulator.shouldRespond(userFollowUp, threadHistory)).toBe(true);
    });
  });
});
