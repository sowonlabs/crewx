# Business Logic Services

> Core business logic and support services

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to services:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **tool-call.service.ts**
Layout-aware tool execution pipeline (WBS-13~15).
- Renders layouts via SDK (`LayoutLoader`/`LayoutRenderer`) and injects secure `<user_query>` wrappers.
- Routes tool invocations, handles streaming/cancellation, and records append telemetry.
- Normalises responses for CLI, Slack, and MCP surfaces.

### **agent-loader.service.ts**
Agent resolution + layout selection.
- Merges `crewx.yaml`, inline definitions, and layout props.
- Applies TemplateContext defaults (mode, platform, agent metadata) before execution.
- Caches resolved agents and supports feature flag `CREWX_APPEND_LEGACY`.

### **context-enhancement.service.ts**
TemplateContext enrichment.
- Aggregates CLAUDE.md, README snippets, and Layout overrides.
- Produces `TemplateContext` / `AgentMetadata` for layout rendering (WBS-14).
- Exposes metrics used by append safety dashboards.

### **template.service.ts**
Remote/local template management.
- Prefers local repo templates, falls back to CDN/GitHub with cache + version gating.
- Supports `.crewx/cache/templates` storage and `CREWX_ENABLE_REMOTE_TEMPLATES` flag.
- Shared across CLI + SDK for consistent layout delivery.

### **config.service.ts**
Configuration aggregation.
- Resolves crewx.yaml/crewX.layout.yaml precedence and dynamic provider configs.
- Surfaces skills schema data (`skillsPaths`, include/exclude) for WBS-16 workflows.
- Provides reload hooks used by `--config` option.

### **config-validator.service.ts**
AJV-based JSON Schema validation (WBS-16).
- Validates providers, agents, layouts, and skills definitions.
- Returns actionable diagnostics tied to source paths for CLI error reporting.

### **parallel-processing.service.ts**
Concurrent agent execution orchestrator.
- Manages worker pools, timeout budgets, and cancellation hooks.
- Integrates with compression service to keep transcripts bounded.

### **intelligent-compression.service.ts**
Conversation summarisation & token budgeting.
- Uses importance heuristics to trim transcripts before sending to providers.
- Maintains audit trail so results remain explainable.

### **task-management.service.ts**
Todo tracking + progress reporting.
- Emits status updates used by CLI progress UI and MCP telemetry.
- Persists history for retrospective reporting.

### **result-formatter.service.ts**
Output shaping for CLI/Slack/MCP.
- Applies layout-aware formatting, diff highlighting, and structured JSON packaging.
- Handles error surfaces and safety warnings consistently.

### **document-loader.service.ts**
Project document ingestion.
- Reads markdown, code, and config files with encoding fallbacks.
- Feeds context into TemplateContext builder and conversation cache.

### **mcp-client.service.ts**
MCP client utilities for remote agents.
- Manages websocket lifecycle, tool discovery, and request/response routing.
- Shares auth tokens with `AuthService` for secure connections.

### **remote-agent.service.ts**
Remote agent registry + orchestration.
- Tracks available MCP agents, syncs capabilities, and proxies execution requests.
- Supplies status data to CLI commands (e.g. `crewx agent ls`).

### **auth.service.ts**
Authentication helper for remote services.
- Stores bearer tokens/secrets, injects them into MCP requests when required.
- Validates credentials against allowed provider namespaces.

### **help.service.ts**
Help and documentation surface.
- Renders command usage, layout docs, and feature flag references.
- Pulls pointers to WBS documents for deeper investigation.

---

**Last Updated**: 2025-10-20
