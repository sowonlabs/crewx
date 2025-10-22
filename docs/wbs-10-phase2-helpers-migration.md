# WBS-10 Phase 2 – Parallel Helper Migration Guide

Phase 2 introduces SDK-native helper functions for running agent queries and executes in parallel without pulling the CLI `ParallelProcessingService` into external projects. This document outlines how to adopt the new API and replace any ad-hoc concurrency logic.

## Quick Start

```ts
import {
  runQueriesParallel,
  runExecutesParallel,
  type ParallelConfig,
} from '@sowonai/crewx-sdk';

const config: ParallelConfig = {
  concurrency: 2,
  timeout: 45_000,
  retryPolicy: { maxRetries: 1, retryDelay: 250 },
  onProgress: (completed, total) => {
    console.log(`[parallel] ${completed}/${total} finished`);
  },
  onComplete: (summary) => {
    console.table(summary.results.map(({ agentId, success }) => ({ agentId, success })));
  },
};

const queries = await runQueriesParallel([
  { agentId: 'frontend', prompt: 'Review UI draft' },
  { agentId: 'backend', prompt: 'Review API draft' },
], config);

const executes = await runExecutesParallel([
  { agentId: 'infra', prompt: 'Provision sandbox' },
  { agentId: 'devops', prompt: 'Update CI pipeline' },
], config);
```

Both helpers return an array of `AgentResult` in the same order as the incoming requests. Failures are represented as `success: false` results with error details stored in `metadata.error`.

## ParallelConfig Overview

| Field | Description | Default |
| --- | --- | --- |
| `concurrency` | Maximum number of concurrent tasks | `3` |
| `timeout` | Per-task timeout in milliseconds | `30_000` |
| `retryPolicy.maxRetries` | Number of retries when a task fails | `0` |
| `retryPolicy.retryDelay` | Delay between retries (ms) | `500` |
| `onProgress(completed, total)` | Fired after each task settles | optional |
| `onComplete(summary)` | Receives a `HelperResult` with metrics | optional |

### HelperResult Snapshot

`onComplete` receives a summary object:

```ts
interface HelperResult<T = AgentResult> {
  total: number;
  completed: number;
  successCount: number;
  failureCount: number;
  results: T[];
  errors: Array<{ index: number; error: Error }>;
  metrics: ParallelRunnerMetrics;
}
```

- `results` preserves input ordering.
- `errors` lists failed task indices with normalized `Error` objects.
- `metrics` mirrors `ParallelRunner.getMetrics()` output for downstream telemetry.

## Migration Checklist

1. **Remove CLI Service Imports** – Replace any direct `ParallelProcessingService` usage outside the CLI package with the new SDK helpers.
2. **Configure Concurrency Per Use-Case** – The default limit is conservative. Increase `concurrency` only after verifying provider rate limits.
3. **Surface Progress** – Wire `onProgress` to existing progress bars or logging utilities.
4. **Capture Metrics** – Use `onComplete` to forward `HelperResult.metrics` into diagnostics dashboards.
5. **Retire Forked Logic** – Delete custom retry/timeout helpers that duplicated CLI behaviour; the SDK now owns these policies.

## Testing Notes

- Unit coverage now lives in `packages/sdk/tests/unit/core/parallel/helpers.test.ts` (17 cases).
- Timeout scenarios rely on the underlying `ParallelRunnerTimeoutError`.
- Retry logic covers both thrown errors and `success: false` results to match CLI semantics.

## Known Limits

- Helpers currently allocate a fresh `AgentRuntime` per invocation. Shared runtimes can be introduced later if we need event bus continuity across batches.
- Streaming responses are out of scope for Phase 2; use `onProgress`/`onComplete` hooks for coarse-grained reporting.

For questions reach out in the #sdk channel with the tag `#wbs-10-phase2`.
