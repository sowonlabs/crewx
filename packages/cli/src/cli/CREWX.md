# CLI Interface Layer

> Command-line interface handlers for CrewX

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to CLI handlers:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **cli.handler.ts**
Main CLI command router that dispatches to appropriate handlers.
Routes commands (query, execute, chat, agent, init, doctor, templates, help) to their handlers.
Handles application lifecycle (startup, shutdown) and error handling.

### **query.handler.ts**
Read-only query command handler (`crewx query`).
Supports multi-agent fan-out, stdin piping, thread-based conversations, and TemplateContext hydration.
No file modifications allowed — layout-rendered prompts keep responses read-only.

### **execute.handler.ts**
File modification command handler (`crewx execute`).
Allows agents to create/modify files, run commands, and perform actions.
Streams layout-rendered instructions, tracks tool invocations, and supports parallel execution with rollback safeguards.

### **chat.handler.ts**
Interactive chat mode handler (`crewx chat`).
Provides REPL-like interface with conversation history and multi-turn interactions.
Supports thread persistence, TemplateContext refresh per turn, and session management across CLI restarts.

### **mcp.handler.ts**
MCP (Model Context Protocol) command handler (`crewx mcp`).
Manages MCP server installation, configuration, IDE integration, and remote agent connections.
Handles remote agent discovery, MCP tool registrations, and distributed collaboration setup.

### **agent.handler.ts**
Agent management handler (`crewx agent`).
Implements the `crewx agent ls` / `crewx agent list` subcommand for discovering configured agents, including JSON output via `--raw`.
Supports both local and remote MCP agent discovery.

### **init.handler.ts**
Project initialization handler (`crewx init`).
Creates configuration files (crewx.yaml), sets up project structure, and loads templates.
Supports multiple template types (default, minimal, development, production).

### **doctor.handler.ts**
System diagnostics handler (`crewx doctor`).
Checks configuration validity, layout/template availability, provider health, and TemplateContext readiness.
Runs parallel diagnostics (WBS-16 schema checks, provider tool-call probes) and surfaces actionable remediation steps.

### **templates.handler.ts**
Template management handler (`crewx templates`).
Lists layout templates (local/CDN), fetches updates, and validates compatibility via `TemplateService` version gating.
Supports installation, cache inspection, and migration hints for layout/append feature flags.

### **help.handler.ts**
Help command handler (`crewx help`).
Displays command usage, examples, and documentation links.
Delegates to HelpService for content rendering.

---

**Last Updated**: 2025-10-20
