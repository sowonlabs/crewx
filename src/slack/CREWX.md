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
Routes messages to appropriate AI providers and formats responses for Slack.

### **formatters/message.formatter.ts**
Message formatting utilities for Slack-specific rendering.
Converts markdown to Slack blocks, handles code formatting, and emoji rendering.
Ensures proper display of AI responses in Slack channels.

---

**Last Updated**: 2025-10-12
