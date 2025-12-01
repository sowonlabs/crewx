# Gemini CLI Bug Analysis (2025-11-26 14:17:15)

## Context
- Requested task logs at `/Users/doha/git/crewx/.crewx/tasks/task_1764125712099_56gww10v6/output.log` (and related) are not present in the workspace. Analysis uses the Slack thread capture `.crewx/conversations/slack-C09LBTJ0JF7_1764130242_892789.json` plus existing task logs under `.crewx/logs/` (e.g., `task_1764130557941_wfv3axemr.log`, `task_1764133865596_mw0xci2v3.log`).

## Error Log Timeline (KST)
- 11:55 – `task_1764125712099_56gww10v6`: stderr shows `YOLO mode enabled`, `Loaded cached credentials`, then `(node:65619) MaxListenersExceededWarning...` → reported as `cli/gemini CLI execute failed`.
- 12:43 – `task_1764128585194_3n2rh6exk`: same stderr sequence, warning repeats → surfaced as failure.
- 13:09 – `task_1764130089230_fzug67c14`: same pattern, warning only, exit reported as failed. All three runs share identical warning-only stderr; no stdout observed in the Slack dump.

## Code-Level Findings
- `packages/sdk/src/core/providers/base-ai.provider.ts:290-309`: `parseProviderError` treats any stderr with empty stdout as a fatal error (`{ error: true, message: stderr }`).
- `packages/sdk/src/core/providers/base-ai.provider.ts:510-538` (query) and `:725-754` (execute): success requires `(exitCode === 0 && stdout.trim().length > 0)`; otherwise it defers to `parseProviderError`. Exit 0 with stderr-only output is therefore marked `success: false`.
- `packages/cli/src/providers/CREWX.md`: CLI wires the SDK providers directly and does not override this logic, so Claude/Gemini/Copilot/Codex and plugin/remote providers all share the same stderr/exit-code handling.

## Root Cause
- The Gemini CLI process emits `MaxListenersExceededWarning` to stderr (likely from attaching >10 abort listeners to a shared `AbortSignal` inside the Gemini CLI while YOLO/tool-calls run). The CLI exits with code 0 and no stdout payload.
- The shared provider runner interprets “exit 0 + stderr-only” as a hard failure because of the stdout-required success gate and the `stderr && !stdout` error rule above. The underlying warning is non-fatal, but it is promoted to an error in our provider layer.

## Remediation Ideas
- **Workaround (Gemini CLI side):** bump listener limits at process start (`require('events').setMaxListeners(20)` or `events.defaultMaxListeners = 0`) or ensure the Gemini CLI creates distinct `AbortController`s instead of sharing one across tool calls; this suppresses the warning but does not fix the CrewX misclassification.
- **Bug fix (provider layer):**
  1) Soften the success gate for exit code 0: if stderr matches known warning patterns (`MaxListenersExceededWarning`, "YOLO mode is enabled", "Loaded cached credentials") and stdout is empty, return `success: true` with a warnings field instead of failing.
  2) Adjust `parseProviderError` to treat warning-only stderr as non-fatal when `exitCode === 0` (e.g., return `{ error: false, message: '' }` for matched warnings) and optionally surface warnings separately.
  3) Optionally add a Gemini-specific override to keep stdout-optional success semantics while retaining stricter parsing for other providers.

## Impact
- All CLI providers that rely on `BaseAIProvider` inherit the “stdout-required” success rule; any CLI that prints warnings to stderr and exits 0 (Gemini today, potentially Claude/Copilot/Codex/plugin/remote CLIs) will be falsely marked as failed.
- The MaxListeners warning itself indicates listener accumulation inside the Gemini CLI; while non-fatal, it signals potential resource churn during long runs.

## Next Steps
- Implement provider-side warning classification to allow exit 0 + warning-only stderr to succeed (and expose warnings separately).
- Patch or configure the Gemini CLI to avoid shared abort signals or raise listener limits to remove the warning at the source.
- Add a regression test that simulates `exitCode=0`, `stdout=''`, `stderr='MaxListenersExceededWarning...'` to ensure future providers are not marked failed in this scenario.
