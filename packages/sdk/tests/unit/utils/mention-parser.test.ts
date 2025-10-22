import { describe, it, expect } from 'vitest';
import { MentionParser } from '@/utils/mention-parser';

describe('MentionParser', () => {
  const parser = new MentionParser(['claude', 'backend', 'frontend', 'gemini']);

  it('creates tasks for each leading agent mention', () => {
    const result = parser.parse('@backend Scope the API surface @frontend polish UI copy');

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]?.agents).toEqual(['backend']);
    expect(result.tasks[0]?.task).toBe('Scope the API surface');
    expect(result.tasks[1]?.agents).toEqual(['frontend']);
    expect(result.tasks[1]?.task).toBe('polish UI copy');
    expect(result.errors).toEqual([]);
  });

  it('captures model overrides for recognized agents', () => {
    const result = parser.parse('@claude:sonnet Draft launch notes');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.agents).toEqual(['claude']);
    expect(result.tasks[0]?.models?.get('claude')).toBe('sonnet');
    expect(result.tasks[0]?.task).toBe('Draft launch notes');
  });

  it('returns unmatched text when no mentions are present', () => {
    const result = parser.parse('Broadcast: share weekly update with the team');

    expect(result.tasks).toHaveLength(0);
    expect(result.unmatchedText).toEqual(['Broadcast: share weekly update with the team']);
    expect(result.errors).toEqual([]);
  });

  it('collects errors for unknown agents while preserving valid tasks', () => {
    const result = parser.parse('@backend Prepare deployment plan @unknown assist with docs');

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.agents).toEqual(['backend']);
    expect(result.errors).toEqual(['Unknown agent: @unknown']);
  });
});
