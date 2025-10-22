# Coverage Strategy

## Target Thresholds
- SDK (`@sowonai/crewx-sdk`)
  - Global thresholds: 80% branches / 80% functions / 80% lines / 80% statements
  - Enforced through `packages/sdk/vitest.config.ts`
- CLI (`crewx`)
  - Global thresholds: 70% branches / 70% functions / 70% lines / 70% statements
  - Enforced through `packages/cli/vitest.config.ts`
- CI gate: `npm run test:ci` (called from GitHub Actions) must pass thresholds before Codecov upload

## Module Priorities
- SDK
  - `core/providers` — regression surface for AI vendor integrations
  - `conversation` — thread persistence across CLI/Slack
  - `utils/mention-parser` — multi-agent routing
- CLI
  - `conversation/cli-conversation-history.provider` — metadata persistence, file hygiene
  - `providers/dynamic-provider.factory` — plugin safety checks
  - `services/context-enhancement.service` — config hydration and context guards
  - `tests/integration/slack/*` — mention ownership handoff rules

## Reporting & Tooling
- Vitest coverage reporter emits `text`, `json`, `html`, `lcov` per package
- Codecov step in `.github/workflows/ci.yml` aggregates reports (expects `lcov`)
- Local developers run `npm run test:coverage --workspaces` for per-package reports

## Backlog Follow-ups
1. Add integration coverage for SDK once remote-agent harness ships (WBS-5 dependency)
2. Expand CLI e2e smoke tests for MCP runner once CLI packaging settles
3. Evaluate partial selective test execution via `vitest --changed` when repository size grows

## Local Environment Note
- `scripts/run-coverage.mjs` skips coverage automatically when `@vitest/coverage-v8` is not installed (offline environments)
- CI should install `@vitest/coverage-v8` so that `npm run test:coverage` enforces the thresholds above before Codecov upload
