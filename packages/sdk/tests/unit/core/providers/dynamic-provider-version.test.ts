
import { describe, it, expect } from 'vitest';
import { BaseDynamicProviderFactory, RemoteProviderConfig } from '../../../../src/core/providers/dynamic-provider.factory';

class TestFactory extends BaseDynamicProviderFactory {
  public createTestRemoteProvider(config: RemoteProviderConfig) {
    return this.createRemoteProvider(config);
  }
}

describe('BaseDynamicProviderFactory Version Propagation', () => {
  it('should pass crewxVersion to provider instance', () => {
    const version = '1.2.3-test';
    const factory = new TestFactory({ crewxVersion: version });
    
    const config: RemoteProviderConfig = {
      id: 'test-remote',
      type: 'remote',
      location: 'file:///tmp/test.yaml',
      external_agent_id: 'agent',
    };
    
    const provider = factory.createTestRemoteProvider(config);
    
    // Access private property crewxVersion via any cast or verify log behavior if possible
    // BaseAIProvider has private crewxVersion, but it's used in createTaskLogFile.
    // We can check if the property exists on the instance (it's protected/private but accessible in JS)
    expect((provider as any).crewxVersion).toBe(version);
  });

  it('should default to "unknown" if no version provided', () => {
    const factory = new TestFactory();
    
    const config: RemoteProviderConfig = {
      id: 'test-remote',
      type: 'remote',
      location: 'file:///tmp/test.yaml',
      external_agent_id: 'agent',
    };
    
    const provider = factory.createTestRemoteProvider(config);
    
    expect((provider as any).crewxVersion).toBe('unknown');
  });
});
