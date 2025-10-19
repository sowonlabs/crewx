/**
 * Tests for SlackMessageFormatter
 *
 * Verifies:
 * - Inheritance from SDK BaseMessageFormatter
 * - Slack-specific formatting (blocks, mrkdwn, emoji)
 * - Override behavior for formatMessage
 * - Execution result formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SlackMessageFormatter } from '../../../src/slack/formatters/message.formatter';
import { StructuredMessage } from '@sowonai/crewx-sdk';

describe('SlackMessageFormatter', () => {
  let formatter: SlackMessageFormatter;

  beforeEach(() => {
    formatter = new SlackMessageFormatter();
  });

  describe('Inheritance from BaseMessageFormatter', () => {
    it('should inherit formatHistory method', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Test message',
          isAssistant: false,
          userId: 'user1',
        },
      ];

      const result = formatter.formatHistory(messages);

      expect(result).toBeTruthy();
      expect(result).toContain('Test message');
    });

    it('should inherit buildContext method', () => {
      const payload = {
        prompt: 'Test prompt',
        context: 'Test context',
      };

      const result = formatter.buildContext(payload);

      expect(result).toContain('Test prompt');
      expect(result).toContain('Test context');
    });

    it('should inherit convertToStructured methods', () => {
      const convMsg = {
        id: '123',
        userId: 'user',
        text: 'Message',
        timestamp: new Date(),
        isAssistant: false,
      };

      const structured = formatter.convertToStructured(convMsg);

      expect(structured.id).toBe('123');
      expect(structured.text).toBe('Message');
    });
  });

  describe('Slack-specific formatMessage override', () => {
    it('should use Slack emoji prefixes by default', () => {
      const message: StructuredMessage = {
        text: 'Hello from Slack',
        isAssistant: false,
        userId: 'john',
      };

      const result = formatter.formatMessage(message);

      // Should use Slack emoji codes
      expect(result).toContain(':bust_in_silhouette:');
      expect(result).toContain('Hello from Slack');
    });

    it('should format assistant messages with robot emoji', () => {
      const message: StructuredMessage = {
        text: 'Assistant response',
        isAssistant: true,
        userId: 'bot',
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain(':robot_face:');
      expect(result).toContain('Assistant response');
    });

    it('should bold user IDs in Slack format', () => {
      const message: StructuredMessage = {
        text: 'Message',
        isAssistant: false,
        userId: 'alice',
      };

      const result = formatter.formatMessage(message, { includeUserId: true });

      expect(result).toContain('*alice*');
    });

    it('should include Slack user mention when metadata is available', () => {
      const message: StructuredMessage = {
        text: 'Slack message',
        isAssistant: false,
        userId: 'alice',
        metadata: {
          slack: {
            user_id: 'U12345678',
            username: 'alice',
          },
        },
      };

      const result = formatter.formatMessage(message, { includeUserId: true });

      expect(result).toContain('<@U12345678>');
    });
  });

  describe('formatExecutionResult', () => {
    it('should format successful execution result', () => {
      const result = {
        agent: 'test-agent',
        provider: 'claude',
        taskId: 'task-123',
        response: 'Success response',
        success: true,
      };

      const blocks = formatter.formatExecutionResult(result);

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);

      // Should have section block with response
      const sectionBlock = blocks.find((b: any) => b.type === 'section');
      expect(sectionBlock).toBeDefined();
      expect((sectionBlock as any).text.text).toContain('Success response');

      // Should have footer
      const contextBlocks = blocks.filter((b: any) => b.type === 'context');
      expect(contextBlocks.length).toBeGreaterThan(0);
    });

    it('should format error execution result with metadata', () => {
      const result = {
        agent: 'test-agent',
        provider: 'gemini',
        taskId: 'task-456',
        response: '',
        success: false,
        error: 'Connection timeout',
      };

      const blocks = formatter.formatExecutionResult(result);

      expect(blocks).toBeDefined();

      // Should have error section
      const errorBlock = blocks.find(
        (b: any) => b.type === 'section' && b.text.text.includes('❌'),
      );
      expect(errorBlock).toBeDefined();
      expect((errorBlock as any).text.text).toContain('Connection timeout');

      // Should have metadata context
      const metadataBlock = blocks.find(
        (b: any) =>
          b.type === 'context' &&
          b.elements &&
          b.elements[0].text.includes('test-agent'),
      );
      expect(metadataBlock).toBeDefined();
      expect((metadataBlock as any).elements[0].text).toContain('gemini');
      expect((metadataBlock as any).elements[0].text).toContain('task-456');
    });

    it('should split long responses into multiple sections', () => {
      const longResponse = 'x'.repeat(10000); // 10K characters
      const result = {
        agent: 'test-agent',
        provider: 'claude',
        taskId: 'task-789',
        response: longResponse,
        success: true,
      };

      const blocks = formatter.formatExecutionResult(result);

      // Should have multiple section blocks
      const sectionBlocks = blocks.filter((b: any) => b.type === 'section');
      expect(sectionBlocks.length).toBeGreaterThan(1);
    });
  });

  describe('Slack formatting helpers', () => {
    it('should format error blocks', () => {
      const blocks = formatter.formatError('Test error message');

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);

      const errorBlock = blocks[0];
      expect((errorBlock as any).text.text).toContain('❌');
      expect((errorBlock as any).text.text).toContain('Test error message');
    });

    it('should format simple message blocks', () => {
      const blocks = formatter.formatSimpleMessage('Hello Slack', '👋');

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);

      const messageBlock = blocks[0];
      expect((messageBlock as any).text.text).toContain('👋');
      expect((messageBlock as any).text.text).toContain('Hello Slack');
    });

    it('should use default emoji when none provided', () => {
      const blocks = formatter.formatSimpleMessage('Default emoji test');

      expect(blocks).toBeDefined();
      const messageBlock = blocks[0];
      expect((messageBlock as any).text.text).toContain('💬');
    });
  });

  describe('Emoji conversion', () => {
    it('should convert common emoji codes in messages', () => {
      const message: StructuredMessage = {
        text: 'Great work :rocket: :white_check_mark:',
        isAssistant: true,
        userId: 'bot',
      };

      const result = formatter.formatMessage(message);

      // Emoji codes should be converted
      expect(result).toContain('Great work');
    });

    it('should handle markdown conversion in messages', () => {
      const message: StructuredMessage = {
        text: '## Heading\n**Bold text** and `code`',
        isAssistant: false,
        userId: 'user',
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('Heading');
      expect(result).toContain('Bold text');
      expect(result).toContain('code');
    });

    it('should standardize Slack mention syntax', () => {
      const message: StructuredMessage = {
        text: 'Ping @U12345678 for updates',
        isAssistant: true,
        userId: 'bot',
      };

      const result = formatter.formatMessage(message);

      expect(result).toContain('<@U12345678>');
    });
  });

  describe('Slack-specific edge cases', () => {
    it('should handle very long single line messages', () => {
      const longLine = 'a'.repeat(5000);
      const result = {
        agent: 'test',
        provider: 'claude',
        taskId: 'task-1',
        response: longLine,
        success: true,
      };

      const blocks = formatter.formatExecutionResult(result);

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);

      // Should not exceed Slack's 50 block limit
      expect(blocks.length).toBeLessThan(50);
    });

    it('should respect SLACK_MAX_RESPONSE_LENGTH env var', () => {
      // Save original env var
      const originalEnv = process.env.SLACK_MAX_RESPONSE_LENGTH;

      // Set custom limit
      process.env.SLACK_MAX_RESPONSE_LENGTH = '1000';

      // Create new formatter to pick up env var
      const limitedFormatter = new SlackMessageFormatter();

      const longResponse = 'x'.repeat(5000);
      const result = {
        agent: 'test',
        provider: 'claude',
        taskId: 'task-1',
        response: longResponse,
        success: true,
      };

      const blocks = limitedFormatter.formatExecutionResult(result);

      expect(blocks).toBeDefined();

      // Response should be truncated
      const sectionBlocks = blocks.filter((b: any) => b.type === 'section');
      const totalLength = sectionBlocks.reduce(
        (sum, block) => sum + (block as any).text.text.length,
        0,
      );
      expect(totalLength).toBeLessThan(5000);

      // Restore env var
      if (originalEnv !== undefined) {
        process.env.SLACK_MAX_RESPONSE_LENGTH = originalEnv;
      } else {
        delete process.env.SLACK_MAX_RESPONSE_LENGTH;
      }
    });

    it('should handle empty response gracefully', () => {
      const result = {
        agent: 'test',
        provider: 'claude',
        taskId: 'task-1',
        response: '',
        success: true,
      };

      const blocks = formatter.formatExecutionResult(result);

      expect(blocks).toBeDefined();
      expect(blocks.length).toBeGreaterThan(0);
    });
  });

  describe('Platform detection', () => {
    it('should automatically set platform to slack in formatMessage', () => {
      const messages: StructuredMessage[] = [
        {
          text: 'Test',
          isAssistant: false,
        },
      ];

      // Should use Slack-specific formatting
      const result = formatter.formatHistory(messages);

      expect(result).toContain(':bust_in_silhouette:');
    });

    it('should allow custom platform override', () => {
      const message: StructuredMessage = {
        text: 'Custom platform test',
        isAssistant: false,
      };

      const result = formatter.formatMessage(message, {
        platform: 'custom',
        userPrefix: 'Custom User',
      });

      expect(result).toContain('Custom User');
    });
  });
});
