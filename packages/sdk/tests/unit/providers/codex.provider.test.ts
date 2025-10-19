import { describe, it, expect } from 'vitest';
import { CodexProvider } from '../../../src/core/providers/codex.provider';

describe('CodexProvider (SDK)', () => {
  it('uses CLI arguments with prompt in args', () => {
    const provider = new CodexProvider();
    const promptInArgs = (provider as any).getPromptInArgs();
    expect(promptInArgs).toBe(true);
    const shouldPipe = (provider as any).shouldPipeContext();
    expect(shouldPipe).toBe(false);
  });
});
