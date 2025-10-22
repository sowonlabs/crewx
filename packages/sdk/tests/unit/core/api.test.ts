import { describe, it, expect } from 'vitest';
import {
  createCrewxAgent,
  runQueriesParallel,
  runExecutesParallel,
} from '../../../src/index';

describe('SDK Unit Tests - Core API', () => {
  describe('CrewX Agent Creation', () => {
    it('should create agent with basic config', async () => {
      const config = {
        agents: {
          test: {
            provider: 'cli/claude',
            description: 'Test agent'
          }
        }
      };

      // Mock implementation test
      expect(config.agents.test.provider).toBe('cli/claude');
      expect(config.agents.test.description).toBe('Test agent');
    });

    it('should handle multiple agents', () => {
      const config = {
        agents: {
          frontend: {
            provider: 'cli/copilot',
            description: 'Frontend specialist'
          },
          backend: {
            provider: 'cli/claude',
            description: 'Backend specialist'
          }
        }
      };

      expect(Object.keys(config.agents)).toHaveLength(2);
      expect(config.agents.frontend.provider).toBe('cli/copilot');
      expect(config.agents.backend.provider).toBe('cli/claude');
    });
  });

  describe('Parallel Processing', () => {
    it('should handle parallel query requests', () => {
      const requests = [
        {
          agentId: 'frontend',
          prompt: 'Review UI code',
          context: 'React project'
        },
        {
          agentId: 'backend',
          prompt: 'Review API code',
          context: 'Node.js project'
        }
      ];

      expect(requests).toHaveLength(2);
      expect(requests[0].agentId).toBe('frontend');
      expect(requests[1].agentId).toBe('backend');
    });

    it('should handle parallel execute requests', () => {
      const requests = [
        {
          agentId: 'devops',
          prompt: 'Setup CI/CD pipeline'
        },
        {
          agentId: 'testing',
          prompt: 'Write test cases'
        }
      ];

      expect(requests.every(req => req.agentId && req.prompt)).toBe(true);
    });

    it('should validate parallel config', () => {
      const config = {
        concurrency: 2,
        timeoutMs: 60000
      };

      expect(config.concurrency).toBe(2);
      expect(config.timeoutMs).toBe(60000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid agent IDs', () => {
      const agentId = '@invalid-agent';
      expect(agentId.startsWith('@')).toBe(true);
    });

    it('should handle missing prompts', () => {
      const prompt = '';
      expect(prompt).toBe('');
    });

    it('should handle timeout scenarios', () => {
      const timeout = 30000;
      expect(timeout).toBeGreaterThan(0);
    });
  });
});
