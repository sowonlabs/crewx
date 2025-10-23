# WBS-9 Phase 4: Parallel Runner Migration Guide

## Overview

Phase 4 migrates the CLI-only `ParallelProcessingService` logic into a reusable SDK module named `ParallelRunner`. The new runner centralises chunking, concurrency limits, fail-fast behaviour, timeouts, and metrics so that other consumers can reuse the capability without depending on NestJS or CLI internals.

## What Changed

### New SDK Module (`packages/sdk/src/core/parallel/`)
- `types.ts` – Shared interfaces for tasks, results, callbacks, and metrics.
- `parallel-runner.ts` – Framework-agnostic runner that orchestrates concurrency, fail-fast, and timeout handling. Exposes `ParallelRunner`, `ParallelRunnerTimeoutError`, and `createDefaultParallelRunner`.
- `index.ts` – Module exports wired into the public SDK surface (`packages/sdk/src/index.ts`).

### CLI Refactor (`packages/cli/src/services/parallel-processing.service.ts`)
- Now composes the SDK `ParallelRunner` instead of managing concurrency manually.
- Task lifecycle integration moved into callbacks (`onTaskStart`, `onTaskComplete`, `onError`) which bridge to `TaskManagementService` and logging.
- Request preprocessing (provider resolution, option lookup, prompt formatting) remains in the CLI layer.
- Results are normalised using runner metrics to keep the previous summary API intact.

### Testing
- Added `packages/sdk/tests/unit/core/parallel/parallel-runner.test.ts` covering concurrency limits, fail-fast, timeout handling, metrics, and callback wiring.
- Added `packages/cli/tests/unit/services/parallel-processing.service.test.ts` to verify CLI ↔ runner integration and failure propagation.

## Migration Path

### For SDK Consumers
```ts
import { ParallelRunner, type Task } from '@sowonai/crewx-sdk';

const runner = new ParallelRunner({ maxConcurrency: 5, timeoutMs: 30_000 });

const tasks: Task<string>[] = items.map((item, index) => ({
  id: `task-${index}`,
  run: async ({ signal }) => {
    signal.throwIfAborted?.();
    return await doWork(item);
  },
}));

const results = await runner.run(tasks, {
  failFast: true,
  evaluateTaskSuccess: (value) => value.length > 0,
});

console.log(runner.getMetrics());
```

### For CLI Maintainers
- `ParallelProcessingService` already wraps the new runner. No additional wiring is required when invoking `queryAgentsParallel` or `executeAgentsParallel`.
- When adding new logging or telemetry, use the callbacks in `createTaskCallbacks()` to avoid duplicating runner logic.
- Timeout defaults derive from `getTimeoutConfig().parallel`; adjust the shared config to tune behaviour globally.

## Testing Checklist
- `npm run build --workspace @sowonai/crewx-sdk`
- `npm run build --workspace @sowonai/crewx-cli`
- `npm run test --workspace @sowonai/crewx-sdk`
- `npm run test --workspace @sowonai/crewx-cli`

## Next Steps
- Phase 5 will extract MCP utilities; ensure any new parallel workloads reuse `ParallelRunner` instead of bespoke concurrency code.
- Monitor metrics emitted by `ParallelRunner.getMetrics()` to validate throughput improvements during RC testing.
