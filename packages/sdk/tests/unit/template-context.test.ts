/**
 * Unit tests for TemplateContext types (WBS-14 Phase 3)
 */

import { describe, it, expect } from 'vitest';
import type { TemplateContext, AgentMetadata } from '../../src/types/template.types';

describe('TemplateContext', () => {
  describe('Type Structure', () => {
    it('should accept all valid fields', () => {
      const agentMetadata: AgentMetadata = {
        specialties: ['typescript', 'nestjs'],
        capabilities: ['code-analysis', 'debugging'],
        description: 'AI agent for TypeScript development'
      };

      const context: TemplateContext = {
        env: { NODE_ENV: 'test', DEBUG: 'true' },
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          provider: 'claude',
          model: 'sonnet',
          workingDirectory: '/test'
        },
        agentMetadata,
        mode: 'query',
        messages: [
          {
            text: 'Hello',
            isAssistant: false,
            metadata: { source: 'user' }
          }
        ],
        platform: 'cli',
        tools: {
          list: [
            {
              name: 'read',
              description: 'Read file',
              input_schema: { type: 'object' }
            }
          ],
          json: '{"tools": []}',
          count: 1
        },
        vars: { customVar: 'value' }
      };

      expect(context.env).toBeDefined();
      expect(context.agent).toBeDefined();
      expect(context.agentMetadata).toBeDefined();
      expect(context.mode).toBe('query');
      expect(context.messages).toHaveLength(1);
      expect(context.platform).toBe('cli');
      expect(context.tools).toBeDefined();
      expect(context.vars).toBeDefined();
    });

    it('should accept partial context (all fields optional)', () => {
      const minimalContext: TemplateContext = {};

      expect(minimalContext).toBeDefined();
    });

    it('should accept context with only essential fields', () => {
      const context: TemplateContext = {
        agent: {
          id: 'minimal-agent',
          name: 'Minimal Agent',
          provider: 'gemini'
        },
        mode: 'execute'
      };

      expect(context.agent?.id).toBe('minimal-agent');
      expect(context.mode).toBe('execute');
    });
  });

  describe('Platform Extensibility', () => {
    it('should accept string platform for extensibility', () => {
      const contexts: TemplateContext[] = [
        { platform: 'cli' },
        { platform: 'slack' },
        { platform: 'mcp' },
        { platform: 'discord' },
        { platform: 'custom-platform' }
      ];

      contexts.forEach(ctx => {
        expect(typeof ctx.platform).toBe('string');
      });
    });
  });

  describe('AgentMetadata', () => {
    it('should accept all metadata fields', () => {
      const metadata: AgentMetadata = {
        specialties: ['javascript', 'react', 'nodejs'],
        capabilities: ['code-generation', 'error-analysis', 'optimization'],
        description: 'Full-stack JavaScript development agent'
      };

      expect(metadata.specialties).toHaveLength(3);
      expect(metadata.capabilities).toHaveLength(3);
      expect(metadata.description).toContain('JavaScript');
    });

    it('should accept empty metadata', () => {
      const emptyMetadata: AgentMetadata = {};

      expect(emptyMetadata).toBeDefined();
    });

    it('should accept partial metadata', () => {
      const partialMetadatas: AgentMetadata[] = [
        { specialties: ['typescript'] },
        { capabilities: ['debugging'] },
        { description: 'Specialized agent' }
      ];

      partialMetadatas.forEach(metadata => {
        expect(metadata).toBeDefined();
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce message structure', () => {
      const message = {
        text: 'Test message',
        isAssistant: true,
        metadata: { agent_id: 'test-agent' }
      };

      // TypeScript should catch if structure is wrong
      expect(message.text).toBe('Test message');
      expect(message.isAssistant).toBe(true);
      expect(message.metadata?.agent_id).toBe('test-agent');
    });

    it('should enforce tools structure', () => {
      const tools = {
        list: [
          {
            name: 'write',
            description: 'Write to file',
            input_schema: { type: 'object', properties: { path: { type: 'string' } } },
            output_schema: { type: 'object', properties: { success: { type: 'boolean' } } }
          }
        ],
        json: '{"name": "write", "description": "Write to file"}',
        count: 1
      };

      expect(tools.list).toHaveLength(1);
      expect(tools.list[0].name).toBe('write');
      expect(typeof tools.json).toBe('string');
      expect(typeof tools.count).toBe('number');
    });
  });
});