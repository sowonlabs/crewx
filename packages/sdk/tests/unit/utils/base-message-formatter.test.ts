/**
 * Tests for BaseMessageFormatter
 *
 * Covers:
 * - CLI scenarios (basic message array formatting)
 * - Slack scenarios (emoji, username inclusion)
 * - Edge cases (empty arrays, null fields, long messages)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseMessageFormatter,
  DefaultMessageFormatter,
  StructuredMessage,
  FormatterOptions,
} from '../../../src/utils/base-message-formatter';

describe('BaseMessageFormatter', () => {
  let formatter: BaseMessageFormatter;

  beforeEach(() => {
    formatter = new DefaultMessageFormatter();
  });

  describe('formatHistory', () => {
    it('should format basic message array', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Hello, how can I help?',
          isAssistant: false,
          userId: 'user123',
        },
        {
          text: 'Please analyze the codebase',
          isAssistant: true,
          userId: 'assistant',
        },
      ];

      const result = formatter.formatHistory(messages);

      expect(result).toContain('👤 User');
      expect(result).toContain('🤖 Assistant');
      expect(result).toContain('Hello, how can I help?');
      expect(result).toContain('Please analyze the codebase');
      expect(result).toContain('user123');
      expect(result).toContain('assistant');
    });

    it('should handle empty message array', () => {
      const result = formatter.formatHistory([]);
      expect(result).toBe('');
    });

    it('should handle null/undefined messages array', () => {
      const result1 = formatter.formatHistory(null as any);
      const result2 = formatter.formatHistory(undefined as any);

      expect(result1).toBe('');
      expect(result2).toBe('');
    });

    it('should respect includeUserId option', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Test message',
          isAssistant: false,
          userId: 'user123',
        },
      ];

      const withUserId = formatter.formatHistory(messages, {
        includeUserId: true,
      });
      const withoutUserId = formatter.formatHistory(messages, {
        includeUserId: false,
      });

      expect(withUserId).toContain('user123');
      expect(withoutUserId).not.toContain('user123');
    });

    it('should respect includeTimestamp option', () => {
      const timestamp = new Date('2025-01-15T10:00:00Z');
      const messages: StructuredMessage[] = [
        {
          text: 'Test message',
          isAssistant: false,
          timestamp,
        },
      ];

      const withTimestamp = formatter.formatHistory(messages, {
        includeTimestamp: true,
      });
      const withoutTimestamp = formatter.formatHistory(messages, {
        includeTimestamp: false,
      });

      expect(withTimestamp).toContain('2025-01-15');
      expect(withoutTimestamp).not.toContain('2025-01-15');
    });

    it('should handle custom prefixes', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'User message',
          isAssistant: false,
        },
        {
          text: 'Assistant message',
          isAssistant: true,
        },
      ];

      const result = formatter.formatHistory(messages, {
        userPrefix: ':bust_in_silhouette: Human',
        assistantPrefix: ':robot_face: Bot',
      });

      expect(result).toContain(':bust_in_silhouette: Human');
      expect(result).toContain(':robot_face: Bot');
    });
  });

  describe('formatMessage', () => {
    it('should format single message', () => {
      const message: StructuredMessage = {
        text: 'Test message content',
        isAssistant: false,
        userId: 'user123',
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('👤 User');
      expect(result).toContain('user123');
      expect(result).toContain('Test message content');
    });

    it('should handle message with metadata', () => {
      const message: StructuredMessage = {
        text: 'Message with metadata',
        isAssistant: true,
        userId: 'bot',
        metadata: {
          channel: 'general',
          platform: 'slack',
        },
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('Message with metadata');
      expect(result).toContain('bot');
    });

    it('should handle empty or null text', () => {
      const emptyMessage: StructuredMessage = {
        text: '',
        isAssistant: false,
      };
      const nullMessage: StructuredMessage = {
        text: null as any,
        isAssistant: false,
      };

      expect(formatter.formatMessage(emptyMessage)).toBe('');
      expect(formatter.formatMessage(nullMessage)).toBe('');
    });

    it('should handle message without userId', () => {
      const message: StructuredMessage = {
        text: 'Anonymous message',
        isAssistant: false,
      };

      const result = formatter.formatMessage(message, { includeUserId: true });

      expect(result).toContain('Anonymous message');
      expect(result).not.toContain('undefined');
    });
  });

  describe('buildContext', () => {
    it('should build context from structured payload', () => {
      const payload = {
        prompt: 'Analyze the codebase',
        context: 'Working directory: /project',
        messages: [
          {
            text: 'Previous question',
            isAssistant: false,
            userId: 'user',
          },
          {
            text: 'Previous answer',
            isAssistant: true,
            userId: 'bot',
          },
        ],
        metadata: {
          platform: 'cli',
          threadId: 'test-123',
        },
      };

      const result = formatter.buildContext(payload);

      expect(result).toContain('**Prompt:**');
      expect(result).toContain('Analyze the codebase');
      expect(result).toContain('**Context:**');
      expect(result).toContain('Working directory: /project');
      expect(result).toContain('**Conversation History:**');
      expect(result).toContain('Previous question');
      expect(result).toContain('Previous answer');
      expect(result).toContain('**Metadata:**');
      expect(result).toContain('platform: cli');
    });

    it('should handle payload with only prompt', () => {
      const payload = {
        prompt: 'Simple query',
      };

      const result = formatter.buildContext(payload);

      expect(result).toContain('**Prompt:**');
      expect(result).toContain('Simple query');
      expect(result).not.toContain('**Context:**');
      expect(result).not.toContain('**Conversation History:**');
    });

    it('should handle null or undefined payload', () => {
      expect(formatter.buildContext(null)).toBe('');
      expect(formatter.buildContext(undefined)).toBe('');
    });

    it('should handle empty messages array', () => {
      const payload = {
        prompt: 'Test',
        messages: [],
      };

      const result = formatter.buildContext(payload);

      expect(result).toContain('**Prompt:**');
      expect(result).not.toContain('**Conversation History:**');
    });
  });

  describe('Edge Cases', () => {
    it('should truncate very long messages', () => {
      const longText = 'a'.repeat(10000);
      const message: StructuredMessage = {
        text: longText,
        isAssistant: false,
      };

      const result = formatter.formatMessage(message, { maxLength: 1000 });

      expect(result.length).toBeLessThan(longText.length);
      expect(result).toContain('[truncated');
    });

    it('should handle messages with special characters', () => {
      const message: StructuredMessage = {
        text: 'Message with \n newlines \t tabs and "quotes"',
        isAssistant: false,
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('newlines');
      expect(result).toContain('tabs');
      expect(result).toContain('quotes');
    });

    it('should handle invalid timestamp formats', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Test',
          isAssistant: false,
          timestamp: 'invalid-date' as any,
        },
        {
          text: 'Test 2',
          isAssistant: false,
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
      ];

      const result = formatter.formatHistory(messages, {
        includeTimestamp: true,
      });

      expect(result).toContain('Test');
      expect(result).toContain('Test 2');
    });

    it('should handle messages with null metadata fields', () => {
      const message: StructuredMessage = {
        text: 'Test message',
        isAssistant: true,
        userId: null as any,
        timestamp: null as any,
        metadata: {
          key1: null,
          key2: undefined,
          key3: 'valid',
        },
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('Test message');
    });
  });

  describe('Slack Scenarios', () => {
    it('should support emoji in custom prefixes', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Hello from Slack!',
          isAssistant: false,
          userId: 'john.doe',
        },
      ];

      const result = formatter.formatHistory(messages, {
        userPrefix: ':bust_in_silhouette:',
        assistantPrefix: ':robot_face:',
      });

      expect(result).toContain(':bust_in_silhouette:');
      expect(result).toContain('john.doe');
      expect(result).toContain('Hello from Slack!');
    });

    it('should handle Slack metadata (channel, ts)', () => {
      const message: StructuredMessage = {
        text: 'Slack message',
        isAssistant: true,
        metadata: {
          channel: 'C12345',
          ts: '1234567890.123456',
          thread_ts: '1234567890.123456',
        },
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('Slack message');
    });

    it('should format Slack thread with multiple users', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Question from Alice',
          isAssistant: false,
          userId: 'U001',
          metadata: { realName: 'Alice Smith' },
        },
        {
          text: 'Response from bot',
          isAssistant: true,
          userId: 'BOT',
        },
        {
          text: 'Follow-up from Bob',
          isAssistant: false,
          userId: 'U002',
          metadata: { realName: 'Bob Jones' },
        },
      ];

      const result = formatter.formatHistory(messages);

      expect(result).toContain('Alice Smith');
      expect(result).toContain('Bob Jones');
      expect(result).toContain('Question from Alice');
      expect(result).toContain('Follow-up from Bob');
    });
  });

  describe('CLI Scenarios', () => {
    it('should format CLI conversation with timestamps', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'CLI query',
          isAssistant: false,
          userId: 'developer',
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
        {
          text: 'CLI response',
          isAssistant: true,
          userId: 'crewx',
          timestamp: new Date('2025-01-15T10:00:05Z'),
        },
      ];

      const result = formatter.formatHistory(messages, {
        platform: 'cli',
        includeTimestamp: true,
      });

      expect(result).toContain('developer');
      expect(result).toContain('crewx');
      expect(result).toContain('2025-01-15');
    });

    it('should handle CLI context building', () => {
      const payload = {
        version: '1.0',
        agent: {
          id: 'codex',
          provider: 'cli',
          mode: 'query',
        },
        prompt: 'Analyze files',
        context: 'Working dir: /project',
        messages: [
          {
            text: 'Previous context',
            isAssistant: false,
            userId: 'user',
          },
        ],
      };

      const result = formatter.buildContext(payload);

      expect(result).toContain('Analyze files');
      expect(result).toContain('Working dir: /project');
      expect(result).toContain('Previous context');
    });
  });

  describe('convertToStructured', () => {
    it('should convert ConversationMessage to StructuredMessage', () => {
      const convMsg = {
        id: 'msg-123',
        userId: 'user',
        text: 'Test message',
        timestamp: new Date(),
        isAssistant: false,
        metadata: { channel: 'general' },
      };

      const structured = formatter.convertToStructured(convMsg);

      expect(structured.id).toBe('msg-123');
      expect(structured.userId).toBe('user');
      expect(structured.text).toBe('Test message');
      expect(structured.isAssistant).toBe(false);
      expect(structured.metadata?.channel).toBe('general');
    });

    it('should convert array of ConversationMessages', () => {
      const convMsgs = [
        {
          id: '1',
          userId: 'user1',
          text: 'Message 1',
          timestamp: new Date(),
          isAssistant: false,
        },
        {
          id: '2',
          userId: 'bot',
          text: 'Message 2',
          timestamp: new Date(),
          isAssistant: true,
        },
      ];

      const structured = formatter.convertToStructuredArray(convMsgs);

      expect(structured).toHaveLength(2);
      expect(structured[0].id).toBe('1');
      expect(structured[1].id).toBe('2');
    });

    it('should handle empty array conversion', () => {
      const result = formatter.convertToStructuredArray([]);
      expect(result).toEqual([]);
    });
  });
});
