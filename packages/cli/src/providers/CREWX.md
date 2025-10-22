# Provider Integration

> CLI wiring for SDK-based providers + dynamic plugin/remote factories

[← Back to Source](../CREWX.md)

---

## Overview

The CLI no longer ships bespoke provider classes. Instead it composes the SDK's
built-in providers (Claude, Gemini, Copilot, Codex) and augments them with CLI
tool-call telemetry and version gating. Custom providers are defined via YAML
(`plugin/*`, `remote/*`) and instantiated through `DynamicProviderFactory`.

- **Built-in providers**: Created inside `AIProviderService` using SDK classes.
- **Dynamic providers**: Loaded at runtime from `crewx.yaml` and validated by
  the factory (WBS-16 schema work).
- **Logger adapter**: Bridges SDK log calls into NestJS `Logger` with provider-aware tags.

---

## Namespace Format

Provider identifiers follow `{namespace}/{id}`:

| Namespace | Description | Examples |
|-----------|-------------|----------|
| `cli/`    | Built-in providers backed by the SDK | `cli/claude`, `cli/gemini` |
| `plugin/` | YAML-defined external CLIs            | `plugin/aider`, `plugin/mock` |
| `remote/` | MCP remote agents via HTTP            | `remote/backend`, `remote/ui` |

`AIProviderService` auto-registers the SDK providers on module init, then
invokes the factory to register all dynamic providers discovered in config.

---

## Dynamic Provider Lifecycle

1. `ConfigService.getDynamicProviders()` returns validated YAML entries.
2. `DynamicProviderFactory.validateConfig()` ensures schema compliance, safe env vars,
   and executable presence.
3. `DynamicProviderFactory.createProvider()` builds a runtime instance that
   delegates command execution through the shared `ToolCallService`.
4. `AIProviderService` registers the provider and emits availability telemetry.

### Security Guardrails

- Blocks dangerous env vars (`PATH`, `LD_PRELOAD`, `DYLD_LIBRARY_PATH`, `IFS`, etc.).
- Verifies command paths + arguments to avoid shell injection.
- Captures full config snapshot in debug logs for troubleshooting failed loads.

---

## Files

| File | Purpose |
|------|---------|
| `dynamic-provider.factory.ts` | Validates YAML configs, constructs plugin/remote providers with tool-call hooks. |
| `logger.adapter.ts`           | Adapts NestJS logger to SDK provider logger contract with provider-scoped prefixes. |

---

**Last Updated**: 2025-10-20

