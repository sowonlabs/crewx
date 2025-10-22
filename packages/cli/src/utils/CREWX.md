# Utility Helpers

> Shared helpers used across CLI, Slack, and MCP surfaces

[← Back to Source](../CREWX.md)

---

## 📋 Files Overview

### **template-processor.ts**
- Wraps SDK layout rendering with CLI-specific helpers (partials, markdown cleanup).
- Provides fallback rendering for legacy inline prompts.

### **terminal-message-formatter.ts**
- Formats rich terminal output (status icons, ANSI stripping for logs).
- Used by ToolCallService + CLI handlers to present layout-rendered content cleanly.

### **config-utils.ts**
- Resolves config search paths (`crewx.yaml`, `crewX.layout.yaml`, `.crewx/*.yaml`).
- Normalises environment overrides and legacy flags (`CREWX_APPEND_LEGACY`).

### **stdin-utils.ts**
- Detects piped stdin vs interactive sessions.
- Provides safe buffering helpers for forwarding stdin content into TemplateContext.

### **simple-security.ts**
- Validates shell arguments and environment values before execution.
- Shared by dynamic providers and tool pipeline for guardrails.

### **mcp-installer.ts**
- Automates MCP server installation and upgrade flows.
- Supports VS Code, Cursor, and Claude Desktop integrations.

---

**Last Updated**: 2025-10-20

