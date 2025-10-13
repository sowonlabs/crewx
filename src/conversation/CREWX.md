# Conversation System

> Thread-based conversation history management

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to conversation system:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **conversation-history.interface.ts**
Interface definition for conversation history providers.
Defines standard methods for loading, saving, and managing conversation threads.
Includes metadata support for platform-specific data and agent information.
Ensures consistent behavior across different storage backends (CLI, Slack).

### **conversation-config.ts**
Configuration settings for conversation management.
Defines thread storage paths, retention policies, and format options.
Provides defaults for CLI and Slack conversation modes.

### **conversation-storage.service.ts**
Low-level storage service for reading/writing conversation data.
Handles file I/O, JSON serialization, and directory management.
Supports multiple storage locations and formats.

### **conversation-provider.factory.ts**
Factory for creating appropriate conversation provider instances.
Selects correct provider based on mode (CLI vs Slack).
Manages provider lifecycle and dependency injection.

### **base-conversation-history.provider.ts**
Abstract base class for conversation history providers.
Provides common functionality for thread management and message storage.
Child providers implement platform-specific storage mechanisms.

### **cli-conversation-history.provider.ts**
CLI-specific conversation history implementation.
Stores threads in local filesystem (~/.crewx/conversations/).
Supports thread creation, message append, history retrieval for CLI mode, and agent metadata persistence.

### **slack-conversation-history.provider.ts**
Slack-specific conversation history implementation with CrewX branding alignment.
Retrieves thread history from Slack API using thread timestamps.
Formats Slack messages for AI context, handles Slack-specific metadata, supports CrewX branding consistency, and integrates with remote agents for cross-platform conversation continuity.

### **index.ts**
Public API exports for conversation system.
Re-exports key classes and interfaces for external consumption.
Provides clean entry point for conversation functionality.

---

**Last Updated**: 2025-10-13
