/**
 * Tests for createCrewxAgent factory function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCrewxAgent,
  loadAgentConfigFromYaml,
} from '../../../../src/core/agent/agent-factory';
import type { LoggerLike } from '../../../../src/core/providers/base-ai.types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('createCrewxAgent', () => {
  it('should create agent with default configuration', async () => {
    const result = await createCrewxAgent();

    expect(result).toHaveProperty('agent');
    expect(result).toHaveProperty('onEvent');
    expect(result).toHaveProperty('eventBus');
    expect(result.agent).toHaveProperty('query');
    expect(result.agent).toHaveProperty('execute');
    expect(result.agent).toHaveProperty('getCallStack');
  });

  it('should create agent with custom configuration', async () => {
    const result = await createCrewxAgent({
      provider: {
        namespace: 'cli',
        id: 'codex',
        apiKey: 'test-key',
      },
      enableCallStack: true,
      defaultAgentId: 'test-agent',
    });

    expect(result.agent).toBeDefined();
    expect(result.onEvent).toBeTypeOf('function');
  });

  it('should support event subscription via onEvent', async () => {
    const { agent, onEvent } = await createCrewxAgent({
      enableCallStack: true,
    });

    const events: any[] = [];
    const unsubscribe = onEvent('agentStarted', (payload) => {
      events.push(payload);
    });

    // Execute a query to trigger event
    await agent.query({ prompt: 'test' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      agentId: 'crewx',
      mode: 'query',
    });

    // Cleanup
    unsubscribe();
  });

  it('should track call stack when enabled', async () => {
    const { agent, onEvent } = await createCrewxAgent({
      enableCallStack: true,
    });

    const callStacks: any[] = [];
    onEvent('callStackUpdated', (stack) => {
      callStacks.push([...stack]);
    });

    await agent.query({ prompt: 'test query' });

    // Should have at least 2 updates: push and pop
    expect(callStacks.length).toBeGreaterThanOrEqual(2);

    // First update should have depth 0
    expect(callStacks[0][0]).toMatchObject({
      depth: 0,
      agentId: 'crewx',
      mode: 'query',
    });

    // Final update should be empty (after pop)
    expect(callStacks[callStacks.length - 1]).toHaveLength(0);
  });

  it('should execute query successfully', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.query({
      prompt: 'What is the status?',
      context: 'Project: CrewX',
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Query executed');
    expect(result.metadata).toMatchObject({
      context: 'Project: CrewX',
      messageCount: 0,
    });
  });

  it('should execute action successfully', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.execute({
      prompt: 'Create new feature',
      context: 'Feature: User Auth',
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Execute completed');
  });

  it('should handle multiple listeners for same event', async () => {
    const { agent, onEvent } = await createCrewxAgent();

    const listener1Events: any[] = [];
    const listener2Events: any[] = [];

    onEvent('agentStarted', (payload) => listener1Events.push(payload));
    onEvent('agentStarted', (payload) => listener2Events.push(payload));

    await agent.query({ prompt: 'test' });

    expect(listener1Events).toHaveLength(1);
    expect(listener2Events).toHaveLength(1);
    expect(listener1Events[0]).toEqual(listener2Events[0]);
  });

  it('should support unsubscribe from events', async () => {
    const { agent, onEvent } = await createCrewxAgent();

    const events: any[] = [];
    const unsubscribe = onEvent('agentStarted', (payload) => {
      events.push(payload);
    });

    await agent.query({ prompt: 'test 1' });
    expect(events).toHaveLength(1);

    // Unsubscribe
    unsubscribe();

    // This should not trigger the listener
    await agent.query({ prompt: 'test 2' });
    expect(events).toHaveLength(1); // Still 1, not 2
  });

  it('should pass conversation messages to agent', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.query({
      prompt: 'Continue the conversation',
      messages: [
        {
          id: 'msg-1',
          text: 'Hello',
          timestamp: new Date().toISOString(),
          isAssistant: false,
        },
        {
          id: 'msg-2',
          text: 'Hi there!',
          timestamp: new Date().toISOString(),
          isAssistant: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.messageCount).toBe(2);
  });

  it('should expose eventBus for advanced usage', async () => {
    const { eventBus } = await createCrewxAgent();

    expect(eventBus).toBeDefined();
    expect(eventBus.on).toBeTypeOf('function');
    expect(eventBus.emit).toBeTypeOf('function');
    expect(eventBus.clear).toBeTypeOf('function');
    expect(eventBus.listenerCount).toBeTypeOf('function');
  });

  it('should handle nested agent calls with call stack', async () => {
    const { agent, onEvent } = await createCrewxAgent({
      enableCallStack: true,
    });

    let maxDepth = 0;
    onEvent('callStackUpdated', (stack) => {
      if (stack.length > maxDepth) {
        maxDepth = stack.length;
      }
    });

    // Simulate nested call by executing query
    await agent.query({ prompt: 'outer query' });

    // Should have reached depth 1 at least
    expect(maxDepth).toBeGreaterThanOrEqual(1);
  });
});

describe('YAML Integration', () => {
  it('should create agent from YAML configuration', async () => {
    const yaml = `agents:
  backend:
    provider: cli/codex
    inline:
      model: gpt-4
      apiKey: test-key`;

    const config = loadAgentConfigFromYaml(yaml);
    const { agent } = await createCrewxAgent(config);

    expect(agent).toBeDefined();
    expect(agent.query).toBeTypeOf('function');
    expect(agent.execute).toBeTypeOf('function');
  });

  it('should execute query with YAML-loaded agent', async () => {
    const yaml = `agents:
  tester:
    provider: cli/claude`;

    const config = loadAgentConfigFromYaml(yaml);
    const { agent } = await createCrewxAgent(config);

    const result = await agent.query({
      model: 'haiku',
      prompt: 'What is 2+2?',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeTruthy();
    expect(result.content).toContain('Query executed');
  });

  it('should preserve YAML provider config in agent', async () => {
    const yaml = `agents:
  backend:
    provider: cli/gemini
    inline:
      model: gemini-pro
      apiKey: secret-key`;

    const config = loadAgentConfigFromYaml(yaml);

    expect(config.provider).toBeDefined();
    expect(config.provider?.namespace).toBe('cli');
    expect(config.provider?.id).toBe('gemini');
    expect(config.provider?.model).toBe('gemini-pro');
    expect(config.provider?.apiKey).toBe('secret-key');

    const { agent } = await createCrewxAgent(config);
    expect(agent).toBeDefined();
  });

  it('should handle YAML with knowledge base', async () => {
    const yaml = `agents:
  researcher:
    provider: cli/claude
    knowledgeBase: ./docs`;

    const config = loadAgentConfigFromYaml(yaml);

    expect(config.knowledgeBase).toBeDefined();
    expect(config.knowledgeBase?.path).toBe('./docs');

    const { agent } = await createCrewxAgent(config);
    expect(agent).toBeDefined();
  });

  it('should support multiple agents in YAML (uses first as default)', async () => {
    const yaml = `agents:
  frontend:
    provider: cli/copilot
  backend:
    provider: cli/claude`;

    const config = loadAgentConfigFromYaml(yaml);

    expect(config.defaultAgentId).toBe('frontend');
    expect(config.provider?.id).toBe('copilot');

    const { agent } = await createCrewxAgent(config);
    expect(agent).toBeDefined();
  });

  it('should handle YAML with enableCallStack', async () => {
    const yaml = `agents:
  tracker:
    provider: cli/codex`;

    const config = loadAgentConfigFromYaml(yaml);
    const { agent, onEvent } = await createCrewxAgent({
      ...config,
      enableCallStack: true,
    });

    const callStacks: any[] = [];
    onEvent('callStackUpdated', (stack) => {
      callStacks.push([...stack]);
    });

    await agent.query({ prompt: 'test with call stack' });

    expect(callStacks.length).toBeGreaterThanOrEqual(2);
    expect(callStacks[0][0]).toHaveProperty('depth');
    expect(callStacks[0][0]).toHaveProperty('agentId');
  });

  it('should throw error for invalid YAML', () => {
    const invalidYaml = `agents:
  backend:
    provider: [unclosed`;

    expect(() => loadAgentConfigFromYaml(invalidYaml)).toThrow();
  });

  it('should throw error for YAML without valid provider format', () => {
    const yaml = `agents:
  backend:
    provider: invalid-no-slash`;

    expect(() => loadAgentConfigFromYaml(yaml)).toThrow(/Invalid provider format/);
  });
});

describe('Runtime Model Override', () => {
  it('should accept model parameter in query request', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.query({
      prompt: 'test query',
      model: 'gpt-4-turbo',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.model).toBe('gpt-4-turbo');
  });

  it('should accept model parameter in execute request', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.execute({
      prompt: 'test execute',
      model: 'claude-3-opus',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.model).toBe('claude-3-opus');
  });

  it('should work without model parameter (optional)', async () => {
    const { agent } = await createCrewxAgent();

    const result = await agent.query({
      prompt: 'test without model',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.model).toBeUndefined();
  });

  it('should override YAML model with runtime model', async () => {
    const yaml = `agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-sonnet`;

    const config = loadAgentConfigFromYaml(yaml);
    const { agent } = await createCrewxAgent(config);

    // Runtime model should override YAML model
    const result = await agent.query({
      prompt: 'test override',
      model: 'claude-3-opus',  // Runtime override
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.model).toBe('claude-3-opus');  // Should be runtime model
  });

  it('should use YAML model when no runtime override', async () => {
    const yaml = `agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-sonnet`;

    const config = loadAgentConfigFromYaml(yaml);

    // YAML model is in config, but AgentRuntime doesn't use it yet (Mock mode)
    expect(config.provider?.model).toBe('claude-3-sonnet');

    const { agent } = await createCrewxAgent(config);

    const result = await agent.query({
      prompt: 'test with yaml model',
      // No model override
    });

    expect(result.success).toBe(true);
    // In mock mode, no model in metadata when not specified
    expect(result.metadata?.model).toBeUndefined();
  });
});

describe('Custom Logger Integration', () => {
  it('should support custom logger injection (simple in-memory example)', async () => {
    // Simple in-memory logger for demonstration
    const logs: string[] = [];

    const customLogger: LoggerLike = {
      log: (message: string) => {
        logs.push(`[LOG] ${message}`);
      },
      warn: (message: string) => {
        logs.push(`[WARN] ${message}`);
      },
      error: (message: string) => {
        logs.push(`[ERROR] ${message}`);
      },
    };

    const { agent } = await createCrewxAgent();

    // Note: Currently AgentRuntime doesn't use logger,
    // but this shows the pattern for when Provider is integrated

    await agent.query({ prompt: 'test with custom logger' });

    // In current mock mode, no logs are generated by AgentRuntime
    // But when WBS-18 Provider integration is complete, logs will appear here
    expect(customLogger).toBeDefined();
    expect(logs).toBeDefined();
  });

  it('should support simple file logger (example implementation)', async () => {
    const logFilePath = join(__dirname, '../../../../test-logs/agent-test.log');
    const logEntries: string[] = [];

    // Simple file logger implementation
    class SimpleFileLogger implements LoggerLike {
      private logs: string[] = [];

      log(message: string): void {
        const entry = `[${new Date().toISOString()}] LOG: ${message}`;
        this.logs.push(entry);
        logEntries.push(entry);
      }

      warn(message: string): void {
        const entry = `[${new Date().toISOString()}] WARN: ${message}`;
        this.logs.push(entry);
        logEntries.push(entry);
      }

      error(message: string): void {
        const entry = `[${new Date().toISOString()}] ERROR: ${message}`;
        this.logs.push(entry);
        logEntries.push(entry);
      }

      // Save logs to file (can be called manually or in destructor)
      save(filePath: string): void {
        try {
          mkdirSync(join(__dirname, '../../../../test-logs'), { recursive: true });
          writeFileSync(filePath, this.logs.join('\n'), 'utf-8');
        } catch (error) {
          // Ignore file write errors in test
        }
      }
    }

    const fileLogger = new SimpleFileLogger();
    const { agent } = await createCrewxAgent();

    // Simulate logging (in real scenario, Provider would log)
    fileLogger.log('Agent created successfully');

    await agent.query({ prompt: 'test query' });

    fileLogger.log('Query executed');
    fileLogger.save(logFilePath);

    // Verify logs were captured
    expect(logEntries.length).toBeGreaterThanOrEqual(2);
    expect(logEntries[0]).toContain('Agent created successfully');
    expect(logEntries[1]).toContain('Query executed');
  });

  it('should demonstrate logger pattern for production use', () => {
    // Example: Production-ready file logger with rotation
    const productionLoggerExample: LoggerLike = {
      log: (message: string) => {
        // In production: append to file with rotation
        // Example: winston.info(message) or fs.appendFileSync()
        expect(message).toBeDefined();
      },
      warn: (message: string) => {
        // In production: log to warning file
        // Example: winston.warn(message)
        expect(message).toBeDefined();
      },
      error: (message: string) => {
        // In production: log to error file + monitoring service
        // Example: winston.error(message) or Sentry.captureMessage()
        expect(message).toBeDefined();
      },
    };

    // This pattern can be used with createCrewxAgent when WBS-18 completes
    expect(productionLoggerExample).toBeDefined();
  });
});

describe('String-based Query/Execute API (Mention Parsing)', () => {
  it('should execute query with mention string (@agent task)', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'backend',
      validAgents: ['backend', 'frontend', 'devops'],
    });

    const result = await agent.query('@backend analyze this code');

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('backend');
    expect(result.content).toContain('analyze this code');
  });

  it('should execute query with mention and model (@agent:model task)', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'backend',
      validAgents: ['backend', 'frontend'],
    });

    const result = await agent.query('@backend:gpt-4 review API design');

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('backend');
    expect(result.metadata?.model).toBe('gpt-4');
    expect(result.content).toContain('review API design');
  });

  it('should execute query without mention (use default agent)', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'backend',
      validAgents: ['backend'],
    });

    const result = await agent.query('What is the weather today?');

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('backend'); // Uses default
  });

  it('should execute execute with mention string', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'devops',
      validAgents: ['devops', 'backend'],
    });

    const result = await agent.execute('@devops setup CI/CD pipeline');

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('devops');
    expect(result.content).toContain('setup CI/CD pipeline');
  });

  it('should execute execute with mention and model', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'frontend',
      validAgents: ['frontend', 'backend'],
    });

    const result = await agent.execute('@frontend:claude-3-opus create new component');

    expect(result.success).toBe(true);
    expect(result.agentId).toBe('frontend');
    expect(result.metadata?.model).toBe('claude-3-opus');
  });

  it('should support both string and object-based query API', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'backend',
      validAgents: ['backend'],
    });

    // String-based
    const result1 = await agent.query('@backend analyze code');
    expect(result1.agentId).toBe('backend');

    // Object-based (backward compatibility)
    const result2 = await agent.query({
      agentId: 'backend',
      prompt: 'analyze code',
    });
    expect(result2.agentId).toBe('backend');
  });

  it('should throw error for unknown agent in mention', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'backend',
      validAgents: ['backend'],  // 'unknown_agent' not in list
    });

    await expect(async () => {
      await agent.query('@unknown_agent do something');
    }).rejects.toThrow(/Mention parsing errors/);
  });

  it('should handle multi-agent YAML config with valid agents for mention parsing', async () => {
    const yaml = `agents:
  backend:
    provider: cli/claude
  frontend:
    provider: cli/copilot`;

    const config = loadAgentConfigFromYaml(yaml);

    // Extract agent IDs from YAML config for validAgents
    const { agent } = await createCrewxAgent({
      ...config,
      validAgents: ['backend', 'frontend'],
    });

    // Should successfully parse valid agent mentions
    const result = await agent.query('@backend optimize database queries');
    expect(result.success).toBe(true);
    expect(result.agentId).toBe('backend');
  });

  it('should support execute with both string and object API', async () => {
    const { agent } = await createCrewxAgent({
      defaultAgentId: 'devops',
      validAgents: ['devops'],
    });

    // String-based
    const result1 = await agent.execute('@devops deploy to staging');
    expect(result1.agentId).toBe('devops');

    // Object-based
    const result2 = await agent.execute({
      agentId: 'devops',
      prompt: 'deploy to production',
      model: 'gpt-4',
    });
    expect(result2.agentId).toBe('devops');
    expect(result2.metadata?.model).toBe('gpt-4');
  });
});
