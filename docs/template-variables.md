# Template Variables Reference

This document describes the Handlebars variables and helpers available in CrewX agent templates (agents.yaml).

All variables are processed by `src/utils/template-processor.ts` using Handlebars templating engine.

## Document Variables

Access loaded documents from `.crewx/docs/` directory:

```handlebars
{{{documents.doc-name.content}}}    # Full document content
{{{documents.doc-name.toc}}}        # Table of contents (headings only)
{{documents.doc-name.summary}}      # Document summary
```

**Example:**
```yaml
system_prompt: |
  You are a developer assistant.

  {{{documents.coding-standards.content}}}

  Project structure:
  {{{documents.project-structure.toc}}}
```

**Notes:**
- Document names use hyphens (e.g., `coding-standards`, `project-structure`)
- Documents are loaded from `.crewx/docs/<doc-name>.md`
- Use triple braces `{{{ }}}` to preserve formatting (no HTML escaping)

## Environment Variables

Access environment variables:

```handlebars
{{env.VARIABLE_NAME}}               # Read environment variable
{{#if env.DEBUG}}...{{/if}}         # Conditional based on env var
```

**Example:**
```yaml
system_prompt: |
  {{#if env.DEBUG}}
  Debug mode is enabled. Provide detailed logs.
  {{else}}
  Production mode. Be concise.
  {{/if}}
```

## Agent Metadata

Access current agent properties:

```handlebars
{{agent.id}}                        # Agent ID (e.g., "claude", "gemini")
{{agent.name}}                      # Agent display name
{{agent.provider}}                  # Provider (e.g., "claude", "gemini", "copilot")
{{agent.model}}                     # Model name (if specified)
{{agent.workingDirectory}}          # Working directory path
```

**Example:**
```yaml
system_prompt: |
  You are {{agent.name}} ({{agent.id}}).
  Provider: {{agent.provider}}
  {{#if agent.model}}Model: {{agent.model}}{{/if}}
```

## Mode

Detect query vs execute mode:

```handlebars
{{mode}}                            # "query" or "execute"
{{#if (eq mode "query")}}...{{/if}} # Query mode condition
{{#if (eq mode "execute")}}...{{/if}} # Execute mode condition
```

**Example:**
```yaml
system_prompt: |
  {{#if (eq mode "query")}}
  Read-only mode. Analyze and explain, but don't modify files.
  {{else}}
  Execute mode. You can modify files and make changes.
  {{/if}}
```

## Platform

Detect CLI vs Slack platform:

```handlebars
{{platform}}                        # "cli" or "slack"
{{#if (eq platform "slack")}}...{{/if}} # Slack-specific instructions
```

**Example:**
```yaml
system_prompt: |
  {{#if (eq platform "slack")}}
  You are in a Slack thread. Keep responses concise.
  {{else}}
  CLI mode. You can provide detailed output.
  {{/if}}
```

## CLI Options

Access CLI flags passed to agent:

```handlebars
{{options}}                         # Array of option strings
{{#if (contains options "--verbose")}}...{{/if}} # Check for specific flag
```

**Example:**
```yaml
system_prompt: |
  {{#if (contains options "--verbose")}}
  Verbose mode enabled. Provide detailed explanations.
  {{/if}}
```

## Conversation History

Access previous messages in conversation:

```handlebars
{{messages}}                        # Array of message objects
{{messages.length}}                 # Number of messages
{{{formatConversation messages platform}}} # Formatted conversation
```

**Message Object Structure:**
```typescript
{
  text: string;                     // Message text
  isAssistant: boolean;             // true if assistant, false if user
  metadata?: {                      // Optional platform metadata
    slack?: {                       // Slack-specific info
      user_id: string;
      username: string;
      user_profile: {
        display_name: string;
        real_name: string;
      }
    };
    agent_id?: string;              // Agent ID for assistant messages
  }
}
```

**Default formatConversation Template:**
```handlebars
{{{formatConversation messages platform}}}
```

Output format:
```
Previous conversation (3 messages):
**User**: What's the weather?
**Assistant (@claude)**: The weather is sunny.
**User**: Thanks!
```

**Custom formatConversation Template:**
```handlebars
{{#formatConversation messages platform}}
<conversation>
{{#each messages}}
{{#if isAssistant}}
[AI]: {{{text}}}
{{else}}
[Human]: {{{text}}}
{{/if}}
{{/each}}
</conversation>
{{/formatConversation}}
```

**Examples:**

Simple history check:
```yaml
system_prompt: |
  {{#if messages}}
  Previous conversation ({{messages.length}} messages):
  {{#each messages}}
  - {{#if isAssistant}}Assistant{{else}}User{{/if}}: {{{text}}}
  {{/each}}
  {{/if}}
```

Default formatted conversation:
```yaml
system_prompt: |
  {{{formatConversation messages platform}}}

  Based on the conversation above, continue assisting the user.
```

Custom conversation format:
```yaml
system_prompt: |
  {{#formatConversation messages platform}}
  # Chat History
  {{#each messages}}
  {{#if isAssistant}}
  **🤖 AI**: {{{truncate text 1000}}}
  {{else}}
  **👤 User**: {{{text}}}
  {{/if}}
  {{/each}}
  {{/formatConversation}}
```

## Tools (Future - Not yet!)

Access available MCP tools:

```handlebars
{{tools.list}}                      # Array of tool objects
{{tools.count}}                     # Number of available tools
{{{tools.json}}}                    # All tools as JSON string
```

**Tool Object Structure:**
```typescript
{
  name: string;
  description: string;
  input_schema: any;
  output_schema?: any;
}
```

**Example:**
```yaml
system_prompt: |
  {{#if tools}}
  You have access to {{tools.count}} MCP tools:
  {{{tools.json}}}
  {{/if}}
```

## Custom Variables (Experimental)

Pass custom variables via `vars` context:

```handlebars
{{vars.customKey}}                  # Access custom variable
{{#if vars.feature}}...{{/if}}      # Conditional on custom var
```

**Note:** Custom variables are set programmatically by CrewX internals, not via YAML configuration.

## Handlebars Helpers

### Comparison Helpers

```handlebars
{{#if (eq a b)}}...{{/if}}          # Equality (===)
{{#if (ne a b)}}...{{/if}}          # Not equal (!==)
{{#if (contains array value)}}...{{/if}} # Array contains value
```

**Examples:**
```yaml
system_prompt: |
  {{#if (eq agent.provider "claude")}}
  Use Claude-specific features.
  {{/if}}

  {{#if (ne mode "query")}}
  You can modify files.
  {{/if}}

  {{#if (contains options "--debug")}}
  Debug mode enabled.
  {{/if}}
```

### Logical Helpers

```handlebars
{{#if (and a b)}}...{{/if}}         # Logical AND
{{#if (or a b)}}...{{/if}}          # Logical OR
{{#if (not a)}}...{{/if}}           # Logical NOT
```

**Examples:**
```yaml
system_prompt: |
  {{#if (and (eq mode "execute") env.ALLOW_WRITES)}}
  You can write files.
  {{/if}}

  {{#if (or env.DEBUG (contains options "--verbose"))}}
  Verbose output enabled.
  {{/if}}

  {{#if (not env.PRODUCTION)}}
  Development mode.
  {{/if}}
```

### Data Helpers

```handlebars
{{{json object}}}                   # JSON.stringify with formatting
{{truncate text 500}}               # Truncate string to max length
{{length array}}                    # Array or string length
```

**Examples:**
```yaml
system_prompt: |
  Available tools:
  {{{json tools.list}}}

  Previous context (truncated):
  {{{truncate documents.context.content 1000}}}

  Message count: {{length messages}}
```

## Complete Example

```yaml
agents:
  - id: crewx_dev
    provider: claude
    system_prompt: |
      You are {{agent.name}}, a developer for the CrewX project.

      # Project Context
      {{{documents.project-structure.content}}}

      # Coding Standards
      {{{documents.coding-standards.content}}}

      # Mode
      {{#if (eq mode "query")}}
      **Query Mode**: Read-only. Analyze and explain without modifications.
      {{else}}
      **Execute Mode**: You can modify files and implement changes.
      {{/if}}

      # Platform
      {{#if (eq platform "slack")}}
      You are responding in a Slack thread. Keep responses concise.
      {{/if}}

      # Conversation History
      {{#if messages}}
      {{{formatConversation messages platform}}}
      {{/if}}

      # Available Tools
      {{#if tools}}
      You have access to {{tools.count}} MCP tools.
      {{/if}}

      # Environment
      {{#if env.DEBUG}}
      DEBUG mode enabled. Provide detailed logs.
      {{/if}}
```

## Template Loading Order

1. **Agent template** (agents.yaml `system_prompt`) is loaded
2. **Document references** are detected and loaded
3. **Document content** is processed as Handlebars template (supports nested variables)
4. **Main template** is compiled and rendered with all context

This means documents can also use `{{agent.id}}`, `{{env.VAR}}`, etc. in their content.

