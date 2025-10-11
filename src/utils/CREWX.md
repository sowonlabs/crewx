# Utility Functions

> Helper functions and cross-cutting utilities

[← Back to Source](../CREWX.md)

---

> **⚠️ Document Maintenance**
>
> When making changes to utilities:
> 1. Update file descriptions below if responsibilities change
> 2. Update parent [src/CREWX.md](../CREWX.md) if architecture changes

---

## 📋 Files Overview

### **mention-parser.ts**
@mention parsing and extraction from user input.
Identifies agent mentions (@claude, @gemini), extracts agent IDs and messages.
Supports single and multiple agent mentions in queries and commands.

### **template-processor.ts**
Handlebars template processing and variable interpolation.
Supports context variables, helper functions, and nested templates.
Used for agent prompts, configuration files, and output formatting.

### **error-utils.ts**
Error message extraction and stack trace formatting utilities.
Standardizes error handling across different error types and sources.
Provides clean error messages for CLI and logging output.

### **string-utils.ts**
String manipulation helper functions.
Includes trimming, formatting, and text transformation utilities.
Common string operations used throughout the application.

### **config-utils.ts**
Configuration file path resolution and loading helpers.
Searches multiple locations for config files with precedence rules.
Handles environment variables and default value resolution.

### **stdin-utils.ts**
Standard input reading and piped content handling.
Detects and reads piped input from shell commands.
Formats stdin content for AI context inclusion.

### **mcp-installer.ts**
Model Context Protocol server installation utilities.
Handles MCP server setup, configuration, and IDE integration.
Provides automated installation for VS Code, Claude Desktop, and Cursor.

### **simple-security.ts**
Basic security validation and sanitization utilities.
Input validation, shell metacharacter filtering, and injection prevention.
Lightweight security helpers for CLI argument processing.

### **math-utils.ts**
Mathematical and numerical helper functions.
Common calculations and number formatting utilities.
Used for metrics, statistics, and numerical operations.

---

**Last Updated**: 2025-10-11
