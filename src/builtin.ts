/**
 * Built-in tool router.
 *
 * Routes built-in commands (memory, search, doc, etc.) to their respective
 * @crewx/* package CLI entry points.
 *
 * Copied and adapted from packages/cli-bak/src/cli/builtin.handler.ts.
 */

type Tracer = { run: (name: string, fn: () => unknown, opts?: unknown) => Promise<unknown> };

const BUILTIN_MAP: Record<string, () => Promise<{ main: (args?: string[]) => Promise<void> }>> = {
  memory:   () => import('@crewx/memory/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  search:   () => import('@crewx/search/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  doc:      () => import('@crewx/doc/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  wbs:      () => import('@crewx/wbs/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  cron:     () => import('@crewx/cron/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  workflow: () => import('@crewx/workflow/cli') as Promise<{ main: (args?: string[]) => Promise<void> }>,
  // NOTE: @crewx/skill does not expose /cli module — handled separately in main.ts
};

export const BUILTIN_COMMANDS = new Set(Object.keys(BUILTIN_MAP));

// Load skill-tracer for observability (graceful degradation if unavailable)
async function loadTracer(): Promise<Tracer | null> {
  try {
    return await import('@crewx/shared/skill-tracer') as Tracer;
  } catch {
    return null;
  }
}

/**
 * Wrap main() with tracer.run() if tracer is available.
 * Falls back to direct main() call on any tracer failure.
 */
export async function wrapWithTracer(
  builtinName: string,
  main: (args?: string[]) => Promise<void>,
  args: string[],
): Promise<void> {
  let tracer: Tracer | null = null;
  try {
    tracer = await loadTracer();
  } catch {
    // tracer unavailable — proceed without it
  }

  if (tracer) {
    let mainError: unknown = null;
    let mainCompleted = false;
    try {
      await tracer.run(`crewx/${builtinName}`, async () => {
        try {
          await main(args);
          mainCompleted = true;
        } catch (err) {
          mainError = err;
          throw err;
        }
      });
      return;
    } catch {
      if (mainError) throw mainError;
      if (mainCompleted) return;
      // tracer setup error — fall back
    }
  }

  await main(args);
}

export async function handleBuiltin(
  builtinName: string,
  args: string[],
): Promise<void> {
  const loader = BUILTIN_MAP[builtinName];
  if (!loader) {
    console.error(`Unknown built-in tool: ${builtinName}`);
    process.exit(1);
  }

  try {
    const mod = await loader();
    await wrapWithTracer(builtinName, mod.main.bind(mod), args);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`\n  Built-in tool '${builtinName}' is not installed.\n`);
      console.error(`  Install it with:\n`);
      console.error(`    npm install @crewx/${builtinName}\n`);
      process.exit(1);
    }
    throw err;
  }
}
