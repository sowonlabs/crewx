# AI Provider System

> AI provider implementations and plugin system

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to providers:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **ai-provider.interface.ts**
Provider contract defining standard interfaces for all AI providers.
Defines AIProvider interface, AIQueryOptions, and AIResponse types.
Ensures consistent behavior across different AI provider implementations.

### **base-ai.provider.ts**
Abstract base class providing common functionality for all AI providers.
Handles CLI process spawning, output streaming, error handling, and logging.
Child providers extend this to implement specific AI tool integrations.

### **claude.provider.ts**
Claude Code CLI integration provider.
Implements Claude-specific arguments, output parsing, and error handling.
Supports stream-json output format for structured responses.

### **gemini.provider.ts**
Gemini CLI integration provider.
Implements Google Gemini-specific CLI arguments and response handling.
Provides real-time web access and multi-modal capabilities.

### **copilot.provider.ts**
GitHub Copilot CLI integration provider.
Implements Copilot-specific command routing and response parsing.
Specialized for code-focused tasks and explanations.

### **dynamic-provider.factory.ts**
YAML-based plugin provider system for external AI tools.
Creates provider instances from YAML configuration at runtime.
Validates CLI commands, sanitizes arguments, and prevents injection attacks.

---

**Last Updated**: 2025-10-11
