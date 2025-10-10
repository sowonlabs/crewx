/**
 * Test for CLI mention parsing fix (bug b19a109)
 *
 * This test verifies that only @mentions at the start of the string
 * are captured as agent mentions, not @ symbols in the message content.
 */

// Test the regex logic directly
describe('CLI Mention Parsing', () => {
  it('should only capture leading @mentions, not @ in message content', () => {
    const testCases = [
      {
        input: '@claude Register bug for @BotA and @BotB issue',
        expected: {
          mentions: ['claude'],
          query: 'Register bug for @BotA and @BotB issue'
        }
      },
      {
        input: '@backend @frontend implement login with @email support',
        expected: {
          mentions: ['backend', 'frontend'],
          query: 'implement login with @email support'
        }
      },
      {
        input: 'analyze this code with @mentions in it',
        expected: {
          mentions: [], // No leading mentions, should use default agent
          query: 'analyze this code with @mentions in it'
        }
      },
      {
        input: '@claude:sonnet Check user@example.com for @username',
        expected: {
          mentions: ['claude'],
          model: 'sonnet',
          query: 'Check user@example.com for @username'
        }
      }
    ];

    const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g;
    const leadingMentionsRegex = /^(?:@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?\s*)+/;

    testCases.forEach(({ input, expected }) => {
      const leadingMatch = input.match(leadingMentionsRegex);

      if (!leadingMatch) {
        // No leading mentions
        expect(expected.mentions).toHaveLength(0);
        expect(input.trim()).toBe(expected.query);
        return;
      }

      // Extract mentions and query
      const mentionsText = leadingMatch[0];
      const query = input.slice(mentionsText.length).trim();
      const matches = [...mentionsText.matchAll(mentionRegex)];
      const mentions = matches.map(m => m[1]);

      expect(mentions).toEqual(expected.mentions);
      expect(query).toBe(expected.query);

      // Check model if specified
      if (expected.model) {
        expect(matches[0][2]).toBe(expected.model);
      }
    });
  });

  it('should not capture @ symbols in message content as agent mentions', () => {
    const input = '@claude Register bug for @BotA and @BotB issue';
    const leadingMentionsRegex = /^(?:@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?\s*)+/;
    const mentionRegex = /@([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9._-]+))?/g;

    const leadingMatch = input.match(leadingMentionsRegex);
    const mentionsText = leadingMatch![0];
    const query = input.slice(mentionsText.length).trim();

    // Verify query contains the @ symbols
    expect(query).toBe('Register bug for @BotA and @BotB issue');
    expect(query).toContain('@BotA');
    expect(query).toContain('@BotB');

    // Verify only 'claude' is extracted as an agent
    const matches = [...mentionsText.matchAll(mentionRegex)];
    const agentIds = matches.map(m => m[1]);
    expect(agentIds).toEqual(['claude']);
  });
});
