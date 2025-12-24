import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAIProvider } from '../../../src/core/providers/base-ai.provider';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn().mockReturnValue('/bin/echo'),
}));

class TestProvider extends BaseAIProvider {
  name = 'cli/test';
  getCliCommand() { return 'echo'; }
  getDefaultArgs() { return []; }
  getExecuteArgs() { return []; }
  getNotInstalledMessage() { return 'error'; }
}

describe('BaseAIProvider Environment Variables', () => {
  let provider: TestProvider;
  
  beforeEach(() => {
    provider = new TestProvider('test');
    // Mock spawn to return a fake child process
    (child_process.spawn as any).mockImplementation(() => {
      const child = new EventEmitter();
      (child as any).stdout = new EventEmitter();
      (child as any).stderr = new EventEmitter();
      (child as any).stdin = { write: vi.fn(), end: vi.fn() };
      (child as any).kill = vi.fn();
      
      // Simulate immediate close
      setTimeout(() => {
        child.emit('close', 0);
      }, 10);
      
      return child;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('injects CREWX_* environment variables in query', async () => {
    await provider.query('test prompt', { agentId: 'test-agent', taskId: 'test-task' });
    
    expect(child_process.spawn).toHaveBeenCalled();
    const calls = (child_process.spawn as any).mock.calls;
    const env = calls[0][2].env;
    
    expect(env.CREWX_AGENT_ID).toBe('test-agent');
    expect(env.CREWX_TASK_ID).toBe('test-task');
    expect(env.CREWX_USER_ID).toBeDefined();
  });

  it('injects CREWX_* environment variables in execute', async () => {
    await provider.execute('test prompt', { agentId: 'test-agent', taskId: 'test-task' });
    
    expect(child_process.spawn).toHaveBeenCalled();
    const calls = (child_process.spawn as any).mock.calls;
    const env = calls[0][2].env;
    
    expect(env.CREWX_AGENT_ID).toBe('test-agent');
    expect(env.CREWX_TASK_ID).toBe('test-task');
    expect(env.CREWX_USER_ID).toBeDefined();
  });
});
