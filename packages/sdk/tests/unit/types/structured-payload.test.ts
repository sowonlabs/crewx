/**
 * Tests for structured payload types and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isStructuredPayload,
  parseStructuredPayload,
  createStructuredPayload,
  type StructuredPayload,
  type StructuredMessage,
} from '../../../src/types/structured-payload.types';

describe('StructuredPayload Types', () => {
  describe('isStructuredPayload', () => {
    it('should return true for valid payload', () => {
      const payload: StructuredPayload = {
        version: '1.0',
        agent: {
          id: 'test-agent',
          provider: 'claude',
          mode: 'query',
        },
        prompt: 'Test prompt',
        messages: [],
        metadata: {
          generatedAt: '2025-10-17T00:00:00.000Z',
          messageCount: 0,
          platform: 'cli',
        },
      };

      expect(isStructuredPayload(payload)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isStructuredPayload(null)).toBe(false);
      expect(isStructuredPayload(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isStructuredPayload('string')).toBe(false);
      expect(isStructuredPayload(123)).toBe(false);
      expect(isStructuredPayload(true)).toBe(false);
    });

    it('should return false for invalid payload structure', () => {
      const invalid = {
        version: '1.0',
        // missing agent
        prompt: 'test',
      };

      expect(isStructuredPayload(invalid)).toBe(false);
    });

    it('should return false for invalid agent mode', () => {
      const invalid = {
        version: '1.0',
        agent: {
          id: 'test',
          provider: 'claude',
          mode: 'invalid-mode', // not 'query' or 'execute'
        },
        prompt: 'test',
        messages: [],
        metadata: {},
      };

      expect(isStructuredPayload(invalid)).toBe(false);
    });
  });

  describe('parseStructuredPayload', () => {
    it('should parse valid JSON payload', () => {
      const json = JSON.stringify({
        version: '1.0',
        agent: {
          id: 'test-agent',
          provider: 'claude',
          mode: 'query',
        },
        prompt: 'Test prompt',
        messages: [],
        metadata: {
          generatedAt: '2025-10-17T00:00:00.000Z',
          messageCount: 0,
          platform: 'cli',
        },
      });

      const result = parseStructuredPayload(json);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0');
      expect(result?.agent.id).toBe('test-agent');
      expect(result?.prompt).toBe('Test prompt');
    });

    it('should return null for null or undefined input', () => {
      expect(parseStructuredPayload(null)).toBeNull();
      expect(parseStructuredPayload(undefined)).toBeNull();
    });

    it('should return null for non-JSON strings', () => {
      expect(parseStructuredPayload('not json')).toBeNull();
      expect(parseStructuredPayload('{ invalid json')).toBeNull();
    });

    it('should return null for invalid payload structure', () => {
      const json = JSON.stringify({
        version: '1.0',
        // missing required fields
      });

      expect(parseStructuredPayload(json)).toBeNull();
    });

    it('should ensure messages is always an array', () => {
      const json = JSON.stringify({
        version: '1.0',
        agent: { id: 'test', provider: 'claude', mode: 'query' },
        prompt: 'test',
        messages: null, // invalid messages
        metadata: {
          generatedAt: '2025-10-17T00:00:00.000Z',
          messageCount: 0,
          platform: 'cli',
        },
      });

      const result = parseStructuredPayload(json);
      expect(result).toBeNull(); // should be null due to invalid structure
    });
  });

  describe('createStructuredPayload', () => {
    it('should create payload with required fields', () => {
      const payload = createStructuredPayload({
        agentId: 'test-agent',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test prompt',
      });

      expect(payload.version).toBe('1.0');
      expect(payload.agent.id).toBe('test-agent');
      expect(payload.agent.provider).toBe('claude');
      expect(payload.agent.mode).toBe('query');
      expect(payload.prompt).toBe('Test prompt');
      expect(payload.messages).toEqual([]);
      expect(payload.metadata.platform).toBe('cli');
      expect(payload.metadata.messageCount).toBe(0);
    });

    it('should include optional context', () => {
      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
        context: 'Additional context',
      });

      expect(payload.context).toBe('Additional context');
      expect(payload.metadata.originalContext).toBe('Additional context');
    });

    it('should include custom messages', () => {
      const messages: StructuredMessage[] = [
        {
          id: 'msg1',
          userId: 'user1',
          text: 'Hello',
          timestamp: '2025-10-17T00:00:00.000Z',
          isAssistant: false,
        },
        {
          id: 'msg2',
          userId: 'assistant',
          text: 'Hi there',
          timestamp: '2025-10-17T00:01:00.000Z',
          isAssistant: true,
        },
      ];

      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
        messages,
      });

      expect(payload.messages).toEqual(messages);
      expect(payload.metadata.messageCount).toBe(2);
    });

    it('should include model if provided', () => {
      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'execute',
        prompt: 'Test',
        model: 'claude-3-opus',
      });

      expect(payload.agent.model).toBe('claude-3-opus');
    });

    it('should include platform if provided', () => {
      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
        platform: 'slack',
      });

      expect(payload.metadata.platform).toBe('slack');
    });

    it('should include threadId if provided', () => {
      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
        threadId: 'thread-123',
      });

      expect(payload.metadata.threadId).toBe('thread-123');
    });

    it('should include callStack if provided', () => {
      const callStack = [
        {
          depth: 0,
          agentId: 'test',
          provider: 'claude',
          mode: 'query' as const,
          taskId: 'task-1',
          enteredAt: '2025-10-17T00:00:00.000Z',
        },
      ];

      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
        callStack,
      });

      expect(payload.metadata.callStack).toEqual(callStack);
    });

    it('should generate valid ISO timestamp', () => {
      const payload = createStructuredPayload({
        agentId: 'test',
        provider: 'claude',
        mode: 'query',
        prompt: 'Test',
      });

      // Check that it's a valid ISO string
      const date = new Date(payload.metadata.generatedAt);
      expect(date.toISOString()).toBe(payload.metadata.generatedAt);
    });
  });

  describe('StructuredMessage interface', () => {
    it('should support complete message structure', () => {
      const message: StructuredMessage = {
        id: 'msg-123',
        userId: 'user-1',
        text: 'Test message',
        timestamp: '2025-10-17T00:00:00.000Z',
        isAssistant: false,
        metadata: {
          channel: 'slack-channel',
          agent_id: 'backend',
        },
      };

      expect(message.id).toBe('msg-123');
      expect(message.userId).toBe('user-1');
      expect(message.text).toBe('Test message');
      expect(message.isAssistant).toBe(false);
      expect(message.metadata?.channel).toBe('slack-channel');
    });

    it('should support assistant messages', () => {
      const message: StructuredMessage = {
        id: 'msg-456',
        text: 'Assistant response',
        timestamp: '2025-10-17T00:01:00.000Z',
        isAssistant: true,
      };

      expect(message.isAssistant).toBe(true);
      expect(message.userId).toBeUndefined();
    });
  });

  describe('Integration with CallStackFrame', () => {
    it('should support nested agent calls with callStack', () => {
      const payload = createStructuredPayload({
        agentId: 'backend',
        provider: 'claude',
        mode: 'execute',
        prompt: 'Implement feature',
        callStack: [
          {
            depth: 0,
            agentId: 'coordinator',
            provider: 'codex',
            mode: 'query',
            enteredAt: '2025-10-17T00:00:00.000Z',
          },
          {
            depth: 1,
            agentId: 'backend',
            provider: 'claude',
            mode: 'execute',
            taskId: 'task-123',
            enteredAt: '2025-10-17T00:00:30.000Z',
          },
        ],
      });

      expect(payload.metadata.callStack).toHaveLength(2);
      expect(payload.metadata.callStack?.[0].depth).toBe(0);
      expect(payload.metadata.callStack?.[1].depth).toBe(1);
      expect(payload.metadata.callStack?.[1].taskId).toBe('task-123');
    });
  });
});
