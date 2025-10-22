/**
 * Tests for RemoteAgentManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RemoteAgentManager,
  MockRemoteTransport,
  type RemoteAgentConfig,
  type McpJsonRpcResponse,
} from '../../../../src/core/remote';

describe('RemoteAgentManager', () => {
  let manager: RemoteAgentManager;
  let transport: MockRemoteTransport;
  let logMessages: Array<{ message: string; level?: string }>;

  beforeEach(() => {
    transport = new MockRemoteTransport();
    logMessages = [];

    manager = new RemoteAgentManager({
      transport,
      logger: (message, level) => {
        logMessages.push({ message, level: level || 'info' });
      },
    });
  });

  describe('Configuration Management', () => {
    it('should load a single remote agent configuration', () => {
      const config: RemoteAgentConfig = {
        type: 'mcp-http',
        url: 'https://example.com/mcp',
        apiKey: 'test-key',
      };

      manager.loadConfig('test-agent', config);

      expect(manager.isRemoteAgent('test-agent')).toBe(true);
      expect(manager.getConfig('test-agent')).toEqual(config);
    });

    it('should load multiple configurations at once', () => {
      const configs: Record<string, RemoteAgentConfig> = {
        'agent-1': {
          type: 'mcp-http',
          url: 'https://example.com/agent1',
        },
        'agent-2': {
          type: 'mcp-http',
          url: 'https://example.com/agent2',
        },
      };

      manager.loadConfigs(configs);

      expect(manager.isRemoteAgent('agent-1')).toBe(true);
      expect(manager.isRemoteAgent('agent-2')).toBe(true);
      expect(manager.getRemoteAgentIds()).toEqual(['agent-1', 'agent-2']);
    });

    it('should validate configuration on load', () => {
      const invalidConfig = {
        type: 'mcp-http',
        url: '', // Invalid: empty URL
      } as RemoteAgentConfig;

      expect(() => {
        manager.loadConfig('invalid-agent', invalidConfig);
      }).toThrow('Remote agent configuration requires a URL');
    });

    it('should reject non-HTTP URLs', () => {
      const invalidConfig: RemoteAgentConfig = {
        type: 'mcp-http',
        url: 'file:///local/path', // Invalid: not HTTP/HTTPS
      };

      expect(() => {
        manager.loadConfig('invalid-agent', invalidConfig);
      }).toThrow('Remote agent URL must start with http:// or https://');
    });

    it('should clear all configurations', () => {
      manager.loadConfig('agent-1', {
        type: 'mcp-http',
        url: 'https://example.com',
      });

      manager.clearConfigs();

      expect(manager.isRemoteAgent('agent-1')).toBe(false);
      expect(manager.getRemoteAgentIds()).toEqual([]);
    });
  });

  describe('URL Normalization', () => {
    it('should remove trailing slashes from URLs', () => {
      const config: RemoteAgentConfig = {
        type: 'mcp-http',
        url: 'https://example.com///',
      };

      manager.loadConfig('test-agent', config);

      // URL should be normalized internally
      expect(manager.normalizeUrl('https://example.com///')).toBe('https://example.com');
    });

    it('should remove redundant /mcp suffix', () => {
      expect(manager.normalizeUrl('https://example.com/mcp')).toBe('https://example.com');
      expect(manager.normalizeUrl('https://example.com/MCP')).toBe('https://example.com');
    });

    it('should handle empty URLs', () => {
      expect(manager.normalizeUrl('')).toBe('');
      expect(manager.normalizeUrl('   ')).toBe('');
    });
  });

  describe('Query Remote Agent', () => {
    beforeEach(() => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        apiKey: 'test-key',
      });

      const mockResponse: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'test-id',
        result: {
          content: [{ type: 'text', text: 'Query response' }],
          success: true,
        },
      };

      transport.setMockResponse('https://example.com/mcp', mockResponse);
    });

    it('should query a remote agent successfully', async () => {
      const response = await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'What is the weather?',
      });

      expect(response.content).toEqual([{ type: 'text', text: 'Query response' }]);
      expect(response.success).toBe(true);

      const requestLog = transport.getRequestLog();
      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].url).toBe('https://example.com/mcp');
    });

    it('should include optional parameters in query', async () => {
      await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'Test query',
        context: 'Test context',
        model: 'gpt-4',
        platform: 'cli',
        messages: [{ text: 'Hello', isAssistant: false }],
      });

      const requestLog = transport.getRequestLog();
      const body = requestLog[0].options.body;

      expect(body.params.arguments).toMatchObject({
        agentId: 'test-agent',
        query: 'Test query',
        context: 'Test context',
        model: 'gpt-4',
        platform: 'cli',
        messages: [{ text: 'Hello', isAssistant: false }],
      });
    });

    it('should use custom tool name if configured', async () => {
      manager.loadConfig('custom-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        tools: {
          query: 'custom_query_tool',
          execute: 'custom_execute_tool',
        },
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('custom-agent', {
        agentId: 'custom-agent',
        query: 'Test',
      });

      const requestLog = transport.getRequestLog();
      const body = requestLog[0].options.body;

      expect(body.params.name).toBe('custom_query_tool');
    });

    it('should use remote agent ID if configured', async () => {
      manager.loadConfig('local-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        agentId: 'remote-agent-123',
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('local-agent', {
        agentId: 'local-agent',
        query: 'Test',
      });

      const requestLog = transport.getRequestLog();
      const body = requestLog[0].options.body;

      expect(body.params.arguments.agentId).toBe('remote-agent-123');
    });

    it('should throw error for unconfigured agent', async () => {
      await expect(
        manager.query('unknown-agent', {
          agentId: 'unknown-agent',
          query: 'Test',
        }),
      ).rejects.toThrow('Agent unknown-agent is not configured as a remote agent');
    });
  });

  describe('Execute Remote Agent', () => {
    beforeEach(() => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
      });

      const mockResponse: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'test-id',
        result: {
          content: [{ type: 'text', text: 'Execute response' }],
          success: true,
        },
      };

      transport.setMockResponse('https://example.com/mcp', mockResponse);
    });

    it('should execute a task on remote agent', async () => {
      const response = await manager.execute('test-agent', {
        agentId: 'test-agent',
        task: 'Create a new feature',
      });

      expect(response.content).toEqual([{ type: 'text', text: 'Execute response' }]);
      expect(response.success).toBe(true);
    });

    it('should include optional parameters in execute', async () => {
      await manager.execute('test-agent', {
        agentId: 'test-agent',
        task: 'Test task',
        context: 'Test context',
        model: 'gpt-4',
        platform: 'slack',
      });

      const requestLog = transport.getRequestLog();
      const body = requestLog[0].options.body;

      expect(body.params.arguments).toMatchObject({
        agentId: 'test-agent',
        task: 'Test task',
        context: 'Test context',
        model: 'gpt-4',
        platform: 'slack',
      });
    });
  });

  describe('Response Normalization', () => {
    it('should handle response with content array', () => {
      const result = {
        content: [{ type: 'text', text: 'Hello' }],
        success: true,
      };

      const normalized = manager.normalizeResponse(result);

      expect(normalized).toEqual(result);
    });

    it('should handle response without content array', () => {
      const result = {
        response: 'Hello from remote',
        success: true,
      };

      const normalized = manager.normalizeResponse(result);

      expect(normalized.content).toEqual([
        {
          type: 'text',
          text: 'Hello from remote',
        },
      ]);
    });

    it('should handle null or undefined response', () => {
      const normalized = manager.normalizeResponse(null);

      expect(normalized.content).toEqual([
        {
          type: 'text',
          text: 'Remote agent returned no response.',
        },
      ]);
      expect(normalized.success).toBe(false);
    });

    it('should extract content from various fields', () => {
      const testCases = [
        { response: 'From response field' },
        { implementation: 'From implementation field' },
        { message: 'From message field' },
        { output: 'From output field' },
      ];

      for (const testCase of testCases) {
        const normalized = manager.normalizeResponse(testCase);
        const expectedText = Object.values(testCase)[0];
        expect(normalized.content[0].text).toBe(expectedText);
      }
    });

    it('should stringify object content', () => {
      const result = {
        data: { key: 'value', nested: { prop: 123 } },
      };

      const normalized = manager.normalizeResponse(result);

      expect(normalized.content[0].text).toContain('"key": "value"');
      expect(normalized.content[0].text).toContain('"nested"');
    });
  });

  describe('Tool Name Mapping', () => {
    it('should update tool names for an agent', () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
      });

      manager.mapToolNames('test-agent', {
        query: 'custom_query',
        execute: 'custom_execute',
      });

      const config = manager.getConfig('test-agent');
      expect(config?.tools).toEqual({
        query: 'custom_query',
        execute: 'custom_execute',
      });
    });

    it('should partially update tool names', () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        tools: {
          query: 'old_query',
          execute: 'old_execute',
        },
      });

      manager.mapToolNames('test-agent', {
        query: 'new_query',
      });

      const config = manager.getConfig('test-agent');
      expect(config?.tools).toEqual({
        query: 'new_query',
        execute: 'old_execute',
      });
    });

    it('should throw error for unconfigured agent', () => {
      expect(() => {
        manager.mapToolNames('unknown-agent', { query: 'test' });
      }).toThrow('Agent unknown-agent is not configured as a remote agent');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
      });
    });

    it('should handle MCP error responses', async () => {
      const errorResponse: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'test-id',
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      };

      transport.setMockResponse('https://example.com/mcp', errorResponse);

      await expect(
        manager.query('test-agent', {
          agentId: 'test-agent',
          query: 'Test',
        }),
      ).rejects.toThrow('Invalid Request');
    });

    it('should handle transport errors', async () => {
      transport.setMockResponse('https://example.com/mcp', () => {
        throw new Error('Network error');
      });

      await expect(
        manager.query('test-agent', {
          agentId: 'test-agent',
          query: 'Test',
        }),
      ).rejects.toThrow('Network error');

      const errorLog = logMessages.find((log) => log.level === 'error');
      expect(errorLog?.message).toContain('Remote query failed');
    });
  });

  describe('Logging', () => {
    it('should log configuration loading', () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
      });

      const debugLog = logMessages.find(
        (log) => log.message.includes('Loaded remote agent config') && log.level === 'debug',
      );
      expect(debugLog).toBeDefined();
    });

    it('should log tool calls', async () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'Test',
      });

      const debugLog = logMessages.find(
        (log) => log.message.includes('Calling remote MCP tool') && log.level === 'debug',
      );
      expect(debugLog).toBeDefined();
    });
  });

  describe('Custom Headers and Authentication', () => {
    it('should include API key in Authorization header', async () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        apiKey: 'secret-key-123',
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'Test',
      });

      const requestLog = transport.getRequestLog();
      expect(requestLog[0].options.headers?.['Authorization']).toBe('Bearer secret-key-123');
    });

    it('should include custom headers', async () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': 'req-123',
        },
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'Test',
      });

      const requestLog = transport.getRequestLog();
      expect(requestLog[0].options.headers?.['X-Custom-Header']).toBe('custom-value');
      expect(requestLog[0].options.headers?.['X-Request-ID']).toBe('req-123');
    });
  });

  describe('Timeout Configuration', () => {
    it('should use custom timeout if provided', async () => {
      manager.loadConfig('test-agent', {
        type: 'mcp-http',
        url: 'https://example.com',
        timeoutMs: 30000,
      });

      transport.setMockResponse('https://example.com/mcp', {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { content: [{ type: 'text', text: 'Response' }] },
      });

      await manager.query('test-agent', {
        agentId: 'test-agent',
        query: 'Test',
      });

      const requestLog = transport.getRequestLog();
      expect(requestLog[0].options.timeoutMs).toBe(30000);
    });
  });
});
