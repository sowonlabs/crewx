/**
 * Tests for createCrewxAgent factory function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCrewxAgent } from '../../../../src/core/agent/agent-factory';

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
