/**
 * Shared utility for parsing agent reference and message from CLI args.
 *
 * Supported call forms:
 *   crewx query '@claude 안녕'       → agentRef='@claude', message='안녕'
 *   crewx query '@claude' '안녕'     → agentRef='@claude', message='안녕'
 *   crewx query '@claude' '안녕' '해' → agentRef='@claude', message='안녕 해'
 *   crewx query '안녕하세요'          → agentRef='',        message='안녕하세요' (default agent)
 *
 * Only @mention form triggers explicit agent selection. Input without a
 * leading @mention uses the default agent (@crewx) — callers are responsible
 * for applying the fallback.
 *
 * Reusable by query, execute, and any future command that accepts an agent ref.
 */

export interface AgentMessage {
  agentRef: string;
  message: string;
}

/**
 * Parse agent reference and message from CLI args array.
 *
 * Joins all args with a single space first, then splits on the first
 * whitespace boundary so that both the "single-chunk" form
 * (`'@claude 안녕'`) and the "separated" form (`'@claude', '안녕'`) produce
 * identical results.
 *
 * Returns agentRef='' when no leading @mention is found — the caller should
 * default to '@crewx' in that case.
 */
export function parseAgentMessage(args: string[]): AgentMessage {
  if (args.length === 0) {
    return { agentRef: '', message: '' };
  }

  // Join all args so both forms are handled uniformly
  const combined = args.join(' ').trim();

  if (!combined) {
    return { agentRef: '', message: '' };
  }

  // Only @mention form triggers explicit agent selection
  if (combined.startsWith('@')) {
    const spaceIdx = combined.indexOf(' ');
    if (spaceIdx === -1) {
      return { agentRef: combined, message: '' };
    }
    return {
      agentRef: combined.slice(0, spaceIdx),
      message: combined.slice(spaceIdx + 1).trim(),
    };
  }

  // No leading @mention — entire input is the message; caller defaults to @crewx
  return { agentRef: '', message: combined };
}
