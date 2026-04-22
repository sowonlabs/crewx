import { describe, it, expect } from 'vitest';
import { parseAgentMessage } from '../../src/commands/parse-agent-message';

describe('parseAgentMessage', () => {
  // ── Separated form ────────────────────────────────────────────────────────

  it('parses @mention and message as separate args', () => {
    const result = parseAgentMessage(['@claude', '안녕']);
    expect(result.agentRef).toBe('@claude');
    expect(result.message).toBe('안녕');
  });

  it('joins multi-word message from multiple separate args', () => {
    const result = parseAgentMessage(['@claude', '안녕', '해', '줘']);
    expect(result.agentRef).toBe('@claude');
    expect(result.message).toBe('안녕 해 줘');
  });

  it('bare id (no @) treated as message to default agent — agentRef is empty', () => {
    // Without @, the full input is the message; caller defaults to @crewx
    const result = parseAgentMessage(['claude', '안녕']);
    expect(result.agentRef).toBe('');
    expect(result.message).toBe('claude 안녕');
  });

  // ── Single-chunk form (user wraps in quotes) ──────────────────────────────

  it('parses @mention and message as a single chunk', () => {
    // Shell passes "@claude 안녕" as args[0]
    const result = parseAgentMessage(['@claude 안녕']);
    expect(result.agentRef).toBe('@claude');
    expect(result.message).toBe('안녕');
  });

  it('bare id single-chunk (no @) treated as message to default agent — agentRef is empty', () => {
    const result = parseAgentMessage(['claude 안녕']);
    expect(result.agentRef).toBe('');
    expect(result.message).toBe('claude 안녕');
  });

  it('parses @mention with multi-word message in single chunk', () => {
    const result = parseAgentMessage(['@claude 안녕 해 줘']);
    expect(result.agentRef).toBe('@claude');
    expect(result.message).toBe('안녕 해 줘');
  });

  // ── Underscore / hyphen in agent name ────────────────────────────────────

  it('handles agent id with underscores', () => {
    const result = parseAgentMessage(['@my_agent', '질문']);
    expect(result.agentRef).toBe('@my_agent');
    expect(result.message).toBe('질문');
  });

  it('handles agent id with underscores in single chunk', () => {
    const result = parseAgentMessage(['@my_agent 질문이야']);
    expect(result.agentRef).toBe('@my_agent');
    expect(result.message).toBe('질문이야');
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns empty strings for empty args', () => {
    const result = parseAgentMessage([]);
    expect(result.agentRef).toBe('');
    expect(result.message).toBe('');
  });

  it('returns empty message when only agent ref provided', () => {
    const result = parseAgentMessage(['@claude']);
    expect(result.agentRef).toBe('@claude');
    expect(result.message).toBe('');
  });
});
