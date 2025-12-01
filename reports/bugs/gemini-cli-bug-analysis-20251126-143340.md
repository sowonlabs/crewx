# Gemini CLI Bug Analysis (2025-11-26 14:33:40)

## Context
- Project: /Users/doha/git/yangsangjeung (agent: tax_advisor_gemini, provider: cli/gemini, model: gemini-3-pro-preview, args: --allowed-tools=WebSearch,Bash,Read,Write,Edit --yolo)
- CrewX version in logs: 0.7.5-rc.4; platform: Slack execute mode.
- Logs analyzed: /Users/doha/git/yangsangjeung/.crewx/logs/task_1764125712099_56gww10v6.log, task_1764128585194_3n2rh6exk.log, task_1764130089230_fzug67c14.log.

## Error Timeline & Patterns (timestamps from logs)
- 11:55:12 start (task_1764125712099_56gww10v6) → 11:55:14 stderr: "YOLO mode is enabled", "Loaded cached credentials" → 11:55:17 stderr: MaxListenersExceededWarning (11 abort listeners) → 11:55:39 child exit code 0 recorded → provider marks failure, task logged as exit code 1 (no STDOUT captured).
- 12:43:05 start (task_1764128585194_3n2rh6exk) → 12:43:07 same two stderr lines → 12:43:09 MaxListenersExceededWarning → 12:43:28 child exit code 0 → marked failed, exit code 1; no STDOUT.
- 13:08:09 start (task_1764130089230_fzug67c14) → 13:08:11 same stderr preamble → 13:08:13 MaxListenersExceededWarning → 13:08:34 child exit code 0 → marked failed, exit code 1; no STDOUT.
- Pattern: every run emits identical warning-only stderr, zero stdout, child exits 0; CrewX wraps result as failure and exits 1.

## Root Cause Analysis
- The Gemini CLI emits warnings to stderr (YOLO notice, cached credentials notice, MaxListenersExceededWarning about >10 abort listeners on an AbortSignal) but returns exit code 0 and no stdout payload.
- Provider success gate in BaseAIProvider requires both `exitCode === 0` and non-empty stdout; otherwise it defers to parseProviderError.
- `parseProviderError` treats any `stderr && !stdout` as fatal even when `exitCode === 0`, so warning-only stderr is promoted to an error and returned as `success: false`, which drives the outer CLI exit code 1.
- MaxListeners warning likely originates inside the Gemini CLI process (shared AbortSignal in Google client when multiple tools are registered); the warning itself is non-fatal but triggers the stderr-only failure path above.

## Affected Code
- packages/sdk/src/core/providers/base-ai.provider.ts:290-308 – `parseProviderError` marks any stderr without stdout as `error: true`.
- packages/sdk/src/core/providers/base-ai.provider.ts:717-754 – execute-mode close handler: success requires stdout; otherwise uses parseProviderError and returns `success: false` even if `exitCode === 0`.
- packages/sdk/src/core/providers/gemini.provider.ts:5-30 – GeminiProvider inherits the shared BaseAIProvider behavior (no overrides for stderr handling).
- packages/cli/src/ai-provider.service.ts:65-87 – CLI wires the SDK GeminiProvider directly, so the stdout-required + stderr-fatal logic applies in CLI/Slack execution.

## Proposed Fix
- Immediate (CrewX side):
  - Relax stderr handling for exitCode 0 by classifying known benign patterns (YOLO enabled, cached credentials, MaxListenersExceededWarning) as warnings; return success with `warnings` metadata instead of treating them as fatal when stdout is empty.
  - Optionally allow execute-mode success when exitCode 0 and stderr-only output matches warning patterns, while still failing on unknown stderr content or non-zero exit codes; add unit test for the “exit 0 + warning-only stderr” path.
- Long-term (Gemini CLI side):
  - Fix listener accumulation in the Gemini CLI (use per-call AbortControllers or raise/remove the listener limit via `events.setMaxListeners`); ensure the CLI emits a non-zero exit code when it truly fails or streams a response to stdout when successful.
  - Consider separating warnings to stderr while still emitting a minimal stdout payload so downstream tooling does not misclassify the run.

## Impact Assessment
- All CLI providers that inherit BaseAIProvider are vulnerable to “exit 0 + warning-only stderr” being misreported as a hard failure; currently blocks Gemini execute flows in Slack (no response, task exit 1) and could mask successful runs for other providers if they emit warnings similarly.
- Users see task failures even though the Gemini CLI did not signal an error via exit code; repeated retries will continue to fail until stderr handling or the upstream warning is addressed.
