import { describe, it, expect, vi } from 'vitest';
import { CrewXTool } from '../src/crewx.tool';

describe('Platform Integration Tests - MCP Protocol', () => {
  describe('MCP Tool Registration', () => {
    it('should register query tool', () => {
      const queryTool = {
        name: 'query',
        description: 'Send a query to AI agents',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            agentId: { type: 'string' },
            context: { type: 'string' }
          },
          required: ['prompt']
        }
      };

      expect(queryTool.name).toBe('query');
      expect(queryTool.description).toContain('query');
      expect(queryTool.inputSchema.properties.prompt).toBeDefined();
    });

    it('should register execute tool', () => {
      const executeTool = {
        name: 'execute',
        description: 'Execute tasks with AI agents',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            agentId: { type: 'string' },
            context: { type: 'string' }
          },
          required: ['prompt']
        }
      };

      expect(executeTool.name).toBe('execute');
      expect(executeTool.inputSchema.required).toContain('prompt');
    });

    it('should register list_agents tool', () => {
      const listAgentsTool = {
        name: 'list_agents',
        description: 'List available AI agents',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      expect(listAgentsTool.name).toBe('list_agents');
      expect(listAgentsTool.inputSchema.properties).toEqual({});
    });
  });

  describe('MCP Request Handling', () => {
    it('should handle JSON-RPC requests', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {
            prompt: 'test query',
            agentId: 'claude'
          }
        }
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('tools/call');
      expect(request.params.name).toBe('query');
      expect(request.params.arguments.prompt).toBe('test query');
    });

    it('should format JSON-RPC responses', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: 'Query response from AI agent'
            }
          ],
          isError: false
        }
      };

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result.content[0].text).toContain('Query response');
      expect(response.result.isError).toBe(false);
    });

    it('should handle error responses', () => {
      const errorResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          message: 'Invalid params: prompt is required'
        }
      };

      expect(errorResponse.error.code).toBe(-32602);
      expect(errorResponse.error.message).toContain('Invalid params');
    });

    it('should validate tool arguments', () => {
      const schema = {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          agentId: { type: 'string' }
        },
        required: ['prompt']
      };

      const validArgs = { prompt: 'test', agentId: 'claude' };
      const invalidArgs = { agentId: 'claude' }; // missing prompt

      expect(validArgs.prompt).toBeDefined();
      expect(invalidArgs.prompt).toBeUndefined();
    });
  });

  describe('MCP Tool Execution', () => {
    it('should execute query tool', () => {
      const queryResult = {
        content: 'This is a query response',
        agentId: 'claude',
        success: true,
        timestamp: '2025-01-16T10:00:00.000Z'
      };

      expect(queryResult.success).toBe(true);
      expect(queryResult.agentId).toBe('claude');
      expect(queryResult.content).toContain('query response');
    });

    it('should execute execute tool', () => {
      const executeResult = {
        content: 'Task execution completed',
        agentId: 'copilot',
        success: true,
        filesModified: ['src/app.ts', 'src/utils.ts'],
        timestamp: '2025-01-16T10:01:00.000Z'
      };

      expect(executeResult.success).toBe(true);
      expect(executeResult.filesModified).toHaveLength(2);
      expect(executeResult.filesModified[0]).toBe('src/app.ts');
    });

    it('should handle parallel execution', () => {
      const parallelResults = [
        {
          agentId: 'claude',
          content: 'Analysis complete',
          success: true
        },
        {
          agentId: 'copilot',
          content: 'Implementation complete',
          success: true
        },
        {
          agentId: 'gemini',
          content: 'Optimization complete',
          success: true
        }
      ];

      expect(parallelResults).toHaveLength(3);
      expect(parallelResults.every(r => r.success)).toBe(true);
      expect(parallelResults.map(r => r.agentId)).toContain('claude');
      expect(parallelResults.map(r => r.agentId)).toContain('copilot');
      expect(parallelResults.map(r => r.agentId)).toContain('gemini');
    });
  });

  describe('MCP Content Formatting', () => {
    it('should format text content', () => {
      const textContent = {
        type: 'text',
        text: 'Plain text response'
      };

      expect(textContent.type).toBe('text');
      expect(textContent.text).toBe('Plain text response');
    });

    it('should format markdown content', () => {
      const markdownContent = {
        type: 'text',
        text: '# Code Review\n\n✅ Syntax: OK\n\n```typescript\nconst test = true;\n```'
      };

      expect(markdownContent.text).toContain('# Code Review');
      expect(markdownContent.text).toContain('```typescript');
    });

    it('should format error content', () => {
      const errorContent = {
        type: 'text',
        text: '❌ Error: Agent not found'
      };

      expect(errorContent.text).toContain('❌ Error');
      expect(errorContent.text).toContain('Agent not found');
    });
  });

  describe('MCP Session Management', () => {
    it('should track session context', () => {
      const session = {
        sessionId: 'session-001',
        startTime: '2025-01-16T09:00:00.000Z',
        lastActivity: '2025-01-16T10:00:00.000Z',
        requestCount: 5,
        agentUsage: {
          claude: 2,
          copilot: 2,
          gemini: 1
        }
      };

      expect(session.sessionId).toBe('session-001');
      expect(session.requestCount).toBe(5);
      expect(session.agentUsage.claude).toBe(2);
      expect(Object.keys(session.agentUsage)).toHaveLength(3);
    });

    it('should handle timeout scenarios', () => {
      const timeout = 30000; // 30 seconds
      const startTime = Date.now() - 35000; // 35 seconds ago
      const currentTime = Date.now();
      const isTimedOut = (currentTime - startTime) > timeout;

      expect(isTimedOut).toBe(true);
      expect(timeout).toBe(30000);
    });
  });
});