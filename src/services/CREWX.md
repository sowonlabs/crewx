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

### **mcp-client.service.ts**
MCP (Model Context Protocol) client implementation for remote agent connections.
Manages MCP server communications, tool discovery, and remote agent execution.
Handles connection lifecycle, protocol message routing, and bearer authentication.

### **remote-agent.service.ts**
Remote agent management and execution service.
Connects to remote MCP agents, manages agent registry, and handles remote task execution.
Provides discovery and capabilities introspection for remote agents with distributed collaboration.

### **auth.service.ts**
Authentication and authorization service for secure agent access.
Manages API keys, tokens, and credential validation for remote services.
Provides bearer token authentication for MCP endpoints and secure remote agent connections.

### **tool-call.service.ts**
Tool execution engine for MCP tools and external commands.
Discovers, loads, validates, and executes tools with security sandboxing.
Handles tool input/output schemas and result formatting.

### **config.service.ts**
Configuration management service for loading YAML settings.
Reads crewx.yaml from multiple locations with precedence rules.
Provides typed configuration access throughout the application.

### **config-validator.service.ts**
YAML schema validation using JSON Schema (AJV).
Validates agent definitions, provider configs, and tool settings.
Provides detailed error messages for configuration issues.

### **agent-loader.service.ts**
Agent definition loading and management service.
Parses agent configurations, resolves dependencies, and caches instances.
Supports both built-in and custom agent definitions.

### **parallel-processing.service.ts**
Concurrent task execution and result aggregation.
Manages multiple agent queries/executes running simultaneously.
Handles timeouts, errors, and result collection for parallel operations.

### **task-management.service.ts**
Todo tracking and progress reporting system.
Creates, updates, and manages task states (pending/in_progress/completed).
Provides task history and status queries for CLI/MCP tools.

### **template.service.ts**
Handlebars template rendering and management.
Loads templates from GitHub, local files, and inline definitions.
Supports variable interpolation and helper functions.

### **result-formatter.service.ts**
Output formatting for CLI and MCP responses.
Formats agent results, errors, and metadata for display.
Supports multiple output formats (text, JSON, markdown).

### **context-enhancement.service.ts**
Project context loading from CLAUDE.md and similar files.
Automatically detects and loads project-specific instructions.
Enhances agent prompts with relevant project context.

### **intelligent-compression.service.ts**
Conversation history compression using importance detection.
Reduces token usage while preserving key information.
Applies summarization and filtering strategies.

### **document-loader.service.ts**
Document loading and parsing utilities.
Reads markdown, text, and structured documents for context.
Supports multiple file formats and encodings.

### **help.service.ts**
Help content generation and display service.
Provides command usage, examples, and documentation links.
Renders formatted help text for CLI commands.

---

**Last Updated**: 2025-10-13
