/**
 * Tests for MockProvider - SDK's default fallback provider
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from '../../../src/core/providers/mock.provider';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('Basic Functionality', () => {
    it('should implement AIProvider interface', () => {
      expect(provider.name).toBe('mock/default');
      expect(provider.isAvailable).toBeDefined();
      expect(provider.query).toBeDefined();
      expect(provider.execute).toBeDefined();
      expect(provider.getToolPath).toBeDefined();
    });

    it('should always be available', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return mock tool path', async () => {
      const path = await provider.getToolPath();
      expect(path).toBeNull();
    });
  });

  describe('Default Response Behavior', () => {
    it('should return default response with prompt echo', async () => {
      const response = await provider.query('test prompt');

      expect(response.success).toBe(true);
      expect(response.content).toBe('Mock response for: test prompt');
      expect(response.provider).toBe('mock/default');
      expect(response.command).toBe('mock-command');
    });

    it('should preserve taskId from options', async () => {
      const response = await provider.query('test', { taskId: 'task-123' });

      expect(response.taskId).toBe('task-123');
    });

    it('should handle execute as query alias', async () => {
      const queryResponse = await provider.query('test prompt');
      const execResponse = await provider.execute('test prompt');

      expect(execResponse.content).toBe(queryResponse.content);
      expect(execResponse.provider).toBe(queryResponse.provider);
    });
  });

  describe('Custom Response Configuration', () => {
    it('should allow setting custom response for specific prompt', async () => {
      provider.setResponse('analyze code', {
        content: 'Code analysis: looks good!',
        success: true,
      });

      const response = await provider.query('analyze code');

      expect(response.content).toBe('Code analysis: looks good!');
      expect(response.success).toBe(true);
      expect(response.provider).toBe('mock/default');
    });

    it('should allow setting default response for all prompts', async () => {
      provider.setDefaultResponse({
        content: 'Custom default response',
        success: false,
      });

      const response1 = await provider.query('anything');
      const response2 = await provider.query('something else');

      // MockProvider always echoes prompt unless there's a custom response
      expect(response1.content).toBe('Mock response for: anything');
      expect(response1.success).toBe(false); // success is applied from default
      expect(response2.content).toBe('Mock response for: something else');
      expect(response2.success).toBe(false);
    });

    it('should prioritize custom response over default', async () => {
      provider.setDefaultResponse({
        content: 'Default',
      });

      provider.setResponse('special', {
        content: 'Special response',
      });

      const defaultResp = await provider.query('anything');
      const specialResp = await provider.query('special');

      // Default response echoes prompt
      expect(defaultResp.content).toBe('Mock response for: anything');
      // Custom response uses exact content
      expect(specialResp.content).toBe('Special response');
    });

    it('should clear custom responses', async () => {
      provider.setResponse('test', {
        content: 'Custom',
      });

      let response = await provider.query('test');
      expect(response.content).toBe('Custom');

      provider.clearResponses();

      response = await provider.query('test');
      expect(response.content).toBe('Mock response for: test');
    });

    it('should merge partial responses with defaults', async () => {
      provider.setResponse('test', {
        content: 'Only content changed',
        // success, provider, command should come from defaults
      });

      const response = await provider.query('test');

      expect(response.content).toBe('Only content changed');
      expect(response.success).toBe(true); // From default
      expect(response.provider).toBe('mock/default'); // From default
      expect(response.command).toBe('mock-command'); // From default
    });
  });

  describe('Error Simulation', () => {
    it('should allow simulating provider errors', async () => {
      provider.setResponse('failing task', {
        success: false,
        error: 'Simulated failure',
        content: '',
      });

      const response = await provider.query('failing task');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Simulated failure');
    });

    it('should allow simulating different error scenarios', async () => {
      provider.setResponse('timeout', {
        success: false,
        error: 'Request timeout',
      });

      provider.setResponse('invalid input', {
        success: false,
        error: 'Invalid prompt format',
      });

      const timeout = await provider.query('timeout');
      const invalid = await provider.query('invalid input');

      expect(timeout.error).toBe('Request timeout');
      expect(invalid.error).toBe('Invalid prompt format');
    });
  });

  describe('Test Isolation', () => {
    it('should maintain independent state for multiple instances', async () => {
      const provider1 = new MockProvider();
      const provider2 = new MockProvider();

      provider1.setResponse('test', {
        content: 'Provider 1 response',
      });

      provider2.setResponse('test', {
        content: 'Provider 2 response',
      });

      const resp1 = await provider1.query('test');
      const resp2 = await provider2.query('test');

      expect(resp1.content).toBe('Provider 1 response');
      expect(resp2.content).toBe('Provider 2 response');
    });

    it('should reset state with clearResponses', async () => {
      provider.setResponse('a', { content: 'A' });
      provider.setResponse('b', { content: 'B' });
      provider.setResponse('c', { content: 'C' });

      provider.clearResponses();

      const respA = await provider.query('a');
      const respB = await provider.query('b');
      const respC = await provider.query('c');

      expect(respA.content).toBe('Mock response for: a');
      expect(respB.content).toBe('Mock response for: b');
      expect(respC.content).toBe('Mock response for: c');
    });
  });
});
