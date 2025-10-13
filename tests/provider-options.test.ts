import { describe, it, expect } from 'vitest';
import { CrewXTool } from '../src/crewx.tool';
import { Agent } from '../src/agent.types';

describe('CrewXTool - Provider-specific options', () => {
  let crewxTool: CrewXTool;

  beforeAll(() => {
    crewxTool = new CrewXTool();
  });

  describe('getOptionsForAgent with provider-specific options', () => {
    it('should handle simple provider names (TypeScript type format)', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          query: {
            claude: ['--verbose', '--add-dir=.'],
            gemini: ['--include-directories=.'],
          },
          execute: {
            claude: ['--allowedTools=Edit,Bash'],
            gemini: ['--permission-mode=acceptEdits'],
          },
        },
      };

      // Test query mode with claude provider
      const queryOptions = crewxTool.getOptionsForAgent(agent, 'query', 'cli/claude');
      expect(queryOptions).toEqual(['--verbose', '--add-dir=.']);

      // Test execute mode with claude provider
      const executeOptions = crewxTool.getOptionsForAgent(agent, 'execute', 'cli/claude');
      expect(executeOptions).toEqual(['--allowedTools=Edit,Bash']);

      // Test with gemini provider
      const geminiOptions = crewxTool.getOptionsForAgent(agent, 'query', 'cli/gemini');
      expect(geminiOptions).toEqual(['--include-directories=.']);
    });

    it('should handle namespace provider names (documentation format)', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          query: {
            'cli/claude': ['--verbose'],
            'cli/gemini': ['--include-directories=.'],
          },
        },
      };

      // Test with namespace format
      const options = crewxTool.getOptionsForAgent(agent, 'query', 'cli/claude');
      expect(options).toEqual(['--verbose']);
    });

    it('should handle mixed format (both simple and namespace names)', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          execute: {
            claude: ['--simple-format'],
            'cli/gemini': ['--namespace-format'],
            default: ['--default-options'],
          },
        },
      };

      // Should prefer simple name match
      const claudeOptions = crewxTool.getOptionsForAgent(agent, 'execute', 'cli/claude');
      expect(claudeOptions).toEqual(['--simple-format']);

      // Should fallback to namespace format if simple name not found
      const geminiOptions = crewxTool.getOptionsForAgent(agent, 'execute', 'cli/gemini');
      expect(geminiOptions).toEqual(['--namespace-format']);
    });

    it('should fallback to default options when provider not found', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          query: {
            default: ['--default-query'],
          },
        },
      };

      const options = crewxTool.getOptionsForAgent(agent, 'query', 'cli/copilot');
      expect(options).toEqual(['--default-query']);
    });

    it('should return empty array when no matching options found', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          query: {
            claude: ['--claude-only'],
          },
        },
      };

      const options = crewxTool.getOptionsForAgent(agent, 'query', 'cli/gemini');
      expect(options).toEqual([]);
    });

    it('should handle plugin providers', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'plugin/aider',
        description: 'Test agent',
        options: {
          execute: {
            aider: ['--yes', '--no-auto-commits'],
          },
        },
      };

      const options = crewxTool.getOptionsForAgent(agent, 'execute', 'plugin/aider');
      expect(options).toEqual(['--yes', '--no-auto-commits']);
    });

    it('should handle legacy array options', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: ['--legacy', '--options'],
      };

      const options = crewxTool.getOptionsForAgent(agent, 'query', 'cli/claude');
      expect(options).toEqual(['--legacy', '--options']);
    });

    it('should handle mode-specific array options', () => {
      const agent: Agent = {
        id: 'test_agent',
        provider: 'cli/claude',
        description: 'Test agent',
        options: {
          query: ['--query-only'],
          execute: ['--execute-only'],
        },
      };

      const queryOptions = crewxTool.getOptionsForAgent(agent, 'query', 'cli/claude');
      expect(queryOptions).toEqual(['--query-only']);

      const executeOptions = crewxTool.getOptionsForAgent(agent, 'execute', 'cli/claude');
      expect(executeOptions).toEqual(['--execute-only']);
    });
  });
});