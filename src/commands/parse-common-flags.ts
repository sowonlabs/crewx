/**
 * Common flag parser for query/execute commands.
 *
 * Supports both `--flag=value` and `--flag value` forms.
 * Handles: --thread, --provider, --metadata, --verbose, --config/-c,
 *          --output-format, --effort.
 */

export interface CommonFlags {
  /** Thread name for conversation continuity. */
  thread?: string;
  /** Provider override (e.g., cli/claude). */
  provider?: string;
  /** Raw metadata JSON string. */
  metadata?: string;
  /** Enable verbose/debug output mode. */
  verbose: boolean;
  /** Config file path override. */
  config?: string;
  /** Output format (json | text | stream-json). */
  outputFormat?: string;
  /** Model effort level (high | medium | low). */
  effort?: string;
  /** Remaining non-flag arguments. */
  rest: string[];
}

/**
 * Parse a single-value flag from an args array.
 * Supports `--flag=value` and `--flag value` forms.
 * Returns undefined if flag is not present.
 */
function parseFlag(args: string[], ...names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    for (const name of names) {
      const prefix = `${name}=`;
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length);
      }
      if (arg === name && i + 1 < args.length) {
        return args[i + 1];
      }
    }
  }
  return undefined;
}

/**
 * Check if a boolean flag is present.
 */
function hasFlag(args: string[], ...names: string[]): boolean {
  return names.some(name => args.includes(name));
}

/**
 * Parse common CLI flags from an args array.
 * Returns parsed flags and remaining positional arguments.
 */
export function parseCommonFlags(args: string[]): CommonFlags {
  const thread = parseFlag(args, '--thread');
  const provider = parseFlag(args, '--provider');
  const metadata = parseFlag(args, '--metadata');
  const config = parseFlag(args, '--config', '-c');
  const outputFormat = parseFlag(args, '--output-format');
  const effort = parseFlag(args, '--effort');
  const verbose = hasFlag(args, '--verbose');

  // Collect the set of consumed positions
  const consumed = new Set<number>();
  const flagPairs = [
    { names: ['--thread'] },
    { names: ['--provider'] },
    { names: ['--metadata'] },
    { names: ['--config', '-c'] },
    { names: ['--output-format'] },
    { names: ['--effort'] },
  ];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    // Boolean flags
    if (arg === '--verbose') {
      consumed.add(i);
      continue;
    }

    // Value flags
    for (const { names } of flagPairs) {
      for (const name of names) {
        if (arg.startsWith(`${name}=`)) {
          consumed.add(i);
        } else if (arg === name) {
          consumed.add(i);
          if (i + 1 < args.length) consumed.add(i + 1);
        }
      }
    }
  }

  const rest = args.filter((_, i) => !consumed.has(i));

  return { thread, provider, metadata, verbose, config, outputFormat, effort, rest };
}

/**
 * Parse metadata JSON string from --metadata flag.
 * Returns empty object when no raw value provided.
 * Throws Error on invalid JSON or non-object values (fail-fast).
 */
export function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error(`--metadata must be a JSON object. Got: ${raw}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('--metadata must be a JSON object')) {
      throw err;
    }
    throw new Error(`--metadata must be valid JSON (double-quoted). Got: ${raw}`);
  }
}
