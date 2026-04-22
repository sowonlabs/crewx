import { describe, it, expect } from 'vitest';
import { parseAgentMessage } from './parse-agent-message';

describe('parseAgentMessage', () => {
  // ── @mention forms ────────────────────────────────────────────────────────

  it('parses @mention + message in a single chunk', () => {
    expect(parseAgentMessage(['@claude 안녕'])).toEqual({ agentRef: '@claude', message: '안녕' });
  });

  it('parses @mention and message as separate args', () => {
    expect(parseAgentMessage(['@claude', '안녕'])).toEqual({ agentRef: '@claude', message: '안녕' });
  });

  it('joins multiple trailing args into one message', () => {
    expect(parseAgentMessage(['@claude', '안녕', '해'])).toEqual({ agentRef: '@claude', message: '안녕 해' });
  });

  it('returns empty message when only @mention given', () => {
    expect(parseAgentMessage(['@claude'])).toEqual({ agentRef: '@claude', message: '' });
  });

  // ── Default agent (no @mention) ───────────────────────────────────────────

  it('returns empty agentRef for a single bare word (default agent path)', () => {
    // "crewx q hi" → caller should fall back to @crewx
    expect(parseAgentMessage(['hi'])).toEqual({ agentRef: '', message: 'hi' });
  });

  it('returns empty agentRef for multi-word input without @mention', () => {
    // "crewx q hello world" → full string is the message; default agent
    expect(parseAgentMessage(['hello world'])).toEqual({ agentRef: '', message: 'hello world' });
  });

  it('returns empty agentRef for multi-word input split into args', () => {
    expect(parseAgentMessage(['hello', 'world'])).toEqual({ agentRef: '', message: 'hello world' });
  });

  it('returns empty agentRef and message for a sentence with no @mention', () => {
    expect(parseAgentMessage(['what is the weather today?'])).toEqual({
      agentRef: '',
      message: 'what is the weather today?',
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns empty agentRef and empty message for empty args', () => {
    expect(parseAgentMessage([])).toEqual({ agentRef: '', message: '' });
  });

  it('returns empty agentRef and empty message for blank string', () => {
    expect(parseAgentMessage(['  '])).toEqual({ agentRef: '', message: '' });
  });
});
