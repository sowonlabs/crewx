# Slack Integration

> Slack bot implementation and message formatting

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to Slack integration:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **slack-bot.ts**
Main Slack Bot implementation using Bolt SDK.
Handles @mentions, thread-based conversations, and multi-agent coordination.
Builds TemplateContext payloads shared with CLI, renders layouts via SDK, and preserves append metrics for safety dashboards.
Routes messages to appropriate AI providers, integrates with remote MCP agents, and maintains cross-platform conversation continuity.

### **formatters/message.formatter.ts**
Message formatting utilities for Slack-specific rendering with CrewX branding alignment.
Converts layout-rendered markdown to Slack blocks, handles code formatting, emoji, and security redaction.
Ensures TemplateContext metadata is surfaced (agent tags, tool usage) with consistent CrewX visual identity.

---

**Last Updated**: 2025-10-20
