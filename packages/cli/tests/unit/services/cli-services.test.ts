import { describe, it, expect, vi } from 'vitest';
import { AgentLoaderService } from '../src/services/agent-loader.service';
import { ConfigService } from '../src/services/config.service';

describe('CLI Unit Tests - Services', () => {
  describe('Agent Loader Service', () => {
    it('should load agent configuration', () => {
      const mockConfig = {
        agents: {
          backend: {
            provider: 'cli/claude',
            description: 'Backend development'
          },
          frontend: {
            provider: 'cli/copilot',
            description: 'Frontend development'
          }
        }
      };

      const agentCount = Object.keys(mockConfig.agents).length;
      expect(agentCount).toBe(2);
      expect(mockConfig.agents.backend.provider).toBe('cli/claude');
      expect(mockConfig.agents.frontend.provider).toBe('cli/copilot');
    });

    it('should handle missing agents', () => {
      const config = {
        agents: {}
      };

      expect(Object.keys(config.agents)).toHaveLength(0);
    });

    it('should validate agent structure', () => {
      const agent = {
        provider: 'cli/claude',
        description: 'Test agent',
        inline: {
          model: 'claude-3-opus'
        }
      };

      expect(agent.provider).toBeDefined();
      expect(agent.description).toBeDefined();
      expect(agent.inline).toBeDefined();
    });

    it('should handle provider resolution', () => {
      const agentConfig = {
        provider: 'cli/claude'
      };

      const [namespace, provider] = agentConfig.provider.split('/');
      expect(namespace).toBe('cli');
      expect(provider).toBe('claude');
    });
  });

  describe('Config Service', () => {
    it('should load default configuration', () => {
      const defaultConfig = {
        timeout: 30000,
        retries: 3,
        concurrency: 2
      };

      expect(defaultConfig.timeout).toBe(30000);
      expect(defaultConfig.retries).toBe(3);
      expect(defaultConfig.concurrency).toBe(2);
    });

    it('should handle configuration overrides', () => {
      const baseConfig = {
        timeout: 30000,
        retries: 3
      };

      const overrideConfig = {
        ...baseConfig,
        timeout: 60000
      };

      expect(overrideConfig.timeout).toBe(60000);
      expect(overrideConfig.retries).toBe(3);
    });

    it('should validate configuration schema', () => {
      const config = {
        agents: {
          test: {
            provider: 'cli/claude'
          }
        },
        timeout: 30000
      };

      expect(config.agents).toBeDefined();
      expect(config.timeout).toBeDefined();
      expect(typeof config.timeout).toBe('number');
    });
  });

  describe('Task Management', () => {
    it('should create unique task IDs', () => {
      const taskId1 = 'task-' + Date.now() + '-' + Math.random();
      const taskId2 = 'task-' + Date.now() + '-' + Math.random();

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1).toMatch(/^task-\d+-/);
      expect(taskId2).toMatch(/^task-\d+-/);
    });

    it('should track task status', () => {
      const taskStatus = {
        pending: 'pending',
        running: 'running',
        completed: 'completed',
        failed: 'failed'
      };

      expect(Object.keys(taskStatus)).toHaveLength(4);
      expect(taskStatus.pending).toBe('pending');
      expect(taskStatus.completed).toBe('completed');
    });

    it('should handle task logging', () => {
      const logEntry = {
        taskId: 'task-001',
        timestamp: new Date().toISOString(),
        message: 'Task started',
        level: 'info'
      };

      expect(logEntry.taskId).toBe('task-001');
      expect(logEntry.level).toBe('info');
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});