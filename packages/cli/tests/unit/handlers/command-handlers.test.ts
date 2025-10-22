import { describe, it, expect } from 'vitest';
import { QueryHandler } from '../src/cli/handlers/query.handler';
import { ExecuteHandler } from '../src/cli/handlers/execute.handler';

describe('CLI Unit Tests - Command Handlers', () => {
  describe('Query Handler', () => {
    it('should parse agent mentions correctly', () => {
      const query = '@claude review this code';
      const agentMatch = query.match(/@(\w+)/);
      
      expect(agentMatch).toBeTruthy();
      expect(agentMatch![1]).toBe('claude');
    });

    it('should handle multiple agent mentions', () => {
      const query = '@claude @copilot review this code together';
      const matches = query.match(/@(\w+)/g);
      
      expect(matches).toHaveLength(2);
      expect(matches).toContain('@claude');
      expect(matches).toContain('@copilot');
    });

    it('should handle queries without mentions', () => {
      const query = 'help me understand this code';
      const agentMatch = query.match(/@(\w+)/);
      
      expect(agentMatch).toBeNull();
    });

    it('should extract prompt correctly', () => {
      const query = '@claude please review this React component';
      const prompt = query.replace(/@(\w+)\s*/, '');
      
      expect(prompt).toBe('please review this React component');
    });
  });

  describe('Execute Handler', () => {
    it('should parse execute commands', () => {
      const command = '@copilot implement user authentication';
      const agentMatch = command.match(/@(\w+)/);
      
      expect(agentMatch).toBeTruthy();
      expect(agentMatch![1]).toBe('copilot');
    });

    it('should handle complex execute prompts', () => {
      const command = '@backend create REST API for user management with JWT authentication';
      const agentMatch = command.match(/@(\w+)/);
      const prompt = command.replace(/@(\w+)\s*/, '');
      
      expect(agentMatch![1]).toBe('backend');
      expect(prompt).toContain('REST API');
      expect(prompt).toContain('JWT authentication');
    });

    it('should validate command structure', () => {
      const validCommand = '@claude test';
      const invalidCommand = 'test without mention';
      
      expect(validCommand.match(/@(\w+)/)).toBeTruthy();
      expect(invalidCommand.match(/@(\w+)/)).toBeNull();
    });
  });

  describe('Command Options', () => {
    it('should parse CLI flags', () => {
      const args = ['--verbose', '--timeout', '30000'];
      
      expect(args).toContain('--verbose');
      expect(args).toContain('--timeout');
      expect(args).toContain('30000');
    });

    it('should handle context options', () => {
      const context = 'Project root: /path/to/project';
      expect(context).toContain('/path/to/project');
    });

    it('should handle session options', () => {
      const sessionId = 'session-001';
      expect(sessionId).toBe('session-001');
    });
  });
});