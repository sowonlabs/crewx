
import { describe, it, expect } from 'vitest';
import { BaseDynamicProviderFactory, RemoteProviderConfig } from '../../../../src/core/providers/dynamic-provider.factory';

class TestFactory extends BaseDynamicProviderFactory {
  public createTestRemoteProvider(config: RemoteProviderConfig) {
    return this.createRemoteProvider(config);
  }
}

describe('BaseDynamicProviderFactory', () => {
  describe('RemoteProvider', () => {
    const factory = new TestFactory();
    const config: RemoteProviderConfig = {
      id: 'test-remote',
      type: 'remote',
      location: 'file:///tmp/test.yaml',
      external_agent_id: 'agent',
    };
    
    // Create the provider instance
    const provider = factory.createTestRemoteProvider(config);

    // Access the private method using 'any' casting
    const parseUserQuery = (provider as any).parseUserQueryForRemote.bind(provider);

    it('should extract user query from standard format', () => {
      const prompt = '<user_query key="123">test query</user_query>';
      expect(parseUserQuery(prompt)).toBe('test query');
    });

    it('should extract user query with extra spaces in tag', () => {
      const prompt = '<user_query  key="123">test query</user_query>';
      expect(parseUserQuery(prompt)).toBe('test query');
    });

    it('should extract user query with no key attribute', () => {
      const prompt = '<user_query>test query</user_query>';
      expect(parseUserQuery(prompt)).toBe('test query');
    });

    it('should extract user query with garbage attributes', () => {
      const prompt = '<user_query foo="bar" key="123">test query</user_query>';
      expect(parseUserQuery(prompt)).toBe('test query');
    });

    it('should extract user query with multiline content', () => {
      const prompt = `<user_query key="123">
line 1
line 2
</user_query>`;
      expect(parseUserQuery(prompt)).toBe('line 1\nline 2');
    });

    it('should return original prompt if no tag found', () => {
      const prompt = 'raw prompt';
      expect(parseUserQuery(prompt)).toBe('raw prompt');
    });

    it('should return original prompt if tag is malformed', () => {
      const prompt = '<user_query unclosed tag';
      expect(parseUserQuery(prompt)).toBe('<user_query unclosed tag');
    });
  });
});
