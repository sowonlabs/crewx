# Layout System Guide

Complete guide for using CrewX's layout system to create reusable, customizable prompt templates.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Built-in Layouts](#built-in-layouts)
- [Creating Custom Layouts](#creating-custom-layouts)
- [Props Schema](#props-schema)
- [Layout Resolution](#layout-resolution)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [See Also](#see-also)

## Overview

CrewX layouts provide a way to create reusable prompt structure templates that can be shared across agents. Think of layouts as React components for AI prompts—they define the structure and accept customizable props.

### What Are Layouts?

Layouts separate **prompt structure** (the container) from **prompt content** (the actual instructions):

| Aspect | Layout (`inline.layout`) | Prompt (`inline.prompt`) |
|--------|-------------------------|-------------------------|
| **Purpose** | Defines the structural template | Contains agent-specific instructions |
| **Reusability** | Shared across multiple agents | Unique to each agent |
| **Customization** | Props (like React PropTypes) | Direct text content |
| **Example** | Security containers, document sections | "You are a code reviewer..." |

### Why Use Layouts?

**Without layouts:**
```yaml
agents:
  - id: agent1
    inline:
      prompt: |
        <crewx_system_prompt>
        {{{documents.manual.content}}}
        </crewx_system_prompt>
        <system_prompt key="{{vars.security_key}}">
        You are agent 1...
        </system_prompt>

  - id: agent2
    inline:
      prompt: |
        <crewx_system_prompt>
        {{{documents.manual.content}}}  # Duplicate structure
        </crewx_system_prompt>
        <system_prompt key="{{vars.security_key}}">
        You are agent 2...
        </system_prompt>
```

**With layouts:**
```yaml
agents:
  - id: agent1
    inline:
      layout: "crewx/default"  # Reusable structure
      prompt: |
        You are agent 1...

  - id: agent2
    inline:
      layout: "crewx/default"  # Same structure, different content
      prompt: |
        You are agent 2...
```

## Quick Start

### Step 1: Choose a Layout

Start with a built-in layout:

```yaml
agents:
  - id: my_agent
    inline:
      layout: "crewx/default"  # Simple string reference
      prompt: |
        You are a helpful assistant.
```

### Step 2: Use Minimal Layout

For simple agents without full agent profile:

```yaml
agents:
  - id: simple_agent
    inline:
      layout: "crewx/minimal"  # Lightweight wrapper
      prompt: |
        You are a simple assistant.
```

### Step 3: Test Your Agent

```bash
crewx query "@simple_agent help me with my task"
```

That's it! You're using layouts.

## Basic Usage

### Using Built-in Layouts

Reference a layout by its ID:

```yaml
agents:
  - id: simple_agent
    inline:
      layout: "crewx/default"  # String format
      prompt: |
        Your instructions here.
```

**Available built-in layouts:**
- `crewx/default` - Full agent profile with security containers (default)
- `crewx/minimal` - Minimal security wrapper only (lightweight)

### Layout Selection

Choose the appropriate layout for your use case:

```yaml
agents:
  - id: full_agent
    inline:
      layout: "crewx/default"  # Full agent profile
      prompt: |
        You are a complex agent with full capabilities.

  - id: minimal_agent
    inline:
      layout: "crewx/minimal"  # Minimal wrapper only
      prompt: |
        You are a simple, focused agent.
```

### Default Behavior

If you omit `layout`, CrewX uses `crewx/default` automatically:

```yaml
agents:
  - id: my_agent
    inline:
      # No layout specified → uses crewx/default
      prompt: |
        Your instructions here.
```

## Built-in Layouts

### crewx/default

The standard layout used by all agents unless specified otherwise. Provides the full agent profile with complete context.

**Structure:**
- Wraps prompt in `<crewx_system_prompt>` and `<system_prompt>` security containers
- Includes full agent profile (identity, CLI options, session info)
- Includes CrewX User Manual document
- Injects agent's `inline.prompt` into secure container

**Props:** None

**Usage:**
```yaml
agents:
  - id: my_agent
    inline:
      layout: "crewx/default"  # Explicit (or omit for default)
      prompt: |
        You are a helpful assistant.
```

**When to use:**
- Standard agents that need full context and capabilities
- Agents that benefit from complete agent profile information
- Default choice for most use cases

### crewx/minimal

A lightweight layout that provides only the essential security wrapper without the full agent profile.

**Structure:**
- Wraps prompt in `<crewx_system_prompt>` and `<system_prompt>` security containers
- Injects agent's `inline.prompt` directly (no additional context)
- Minimal overhead for simple agents

**Props:** None

**Usage:**
```yaml
agents:
  - id: simple_agent
    inline:
      layout: "crewx/minimal"  # Lightweight wrapper
      prompt: |
        You are a simple assistant.
```

**When to use:**
- Simple agents with focused, specific tasks
- When you want minimal system context
- Performance-sensitive scenarios where you want to minimize token usage
- Agents that don't need full agent profile information

## Creating Custom Layouts

You can define custom layouts in your `crewx.yaml` file to create reusable prompt structures.

### Basic Custom Layout

Define layouts in the `layouts` section of your `crewx.yaml`:

```yaml
# crewx.yaml
layouts:
  my_custom_layout: |
    <system_prompt key="{{vars.security_key}}">
    You are a specialized agent.

    {{{agent.inline.prompt}}}

    Always follow best practices.
    </system_prompt>

agents:
  - id: my_agent
    inline:
      layout: "my_custom_layout"  # Reference your custom layout
      prompt: |
        You are a code reviewer focusing on security.
```

### Simple Parameterized Layout

For layouts shared across multiple agents, include parameters directly in the prompt:

```yaml
# crewx.yaml
layouts:
  team_layout: |
    <system_prompt key="{{vars.security_key}}">
    You are a specialized team member.

    {{{agent.inline.prompt}}}

    Always collaborate with your team and follow best practices.
    </system_prompt>

agents:
  - id: frontend_dev
    inline:
      layout: "team_layout"
      prompt: |
        You are a member of the Frontend Team.
        Your focus area: frontend
        You specialize in React and TypeScript.

  - id: backend_dev
    inline:
      layout: "team_layout"
      prompt: |
        You are a member of the Backend Team.
        Your focus area: backend
        You specialize in Node.js and databases.
```

**Note:** For most use cases, including parameters directly in the `prompt` field is simpler and more maintainable than using props validation.

### Advanced: Layout with Props Validation

For advanced use cases requiring type validation and default values, use `propsSchema`:

```yaml
# crewx.yaml
layouts:
  config_layout:
    propsSchema:
      teamName:
        type: string
        defaultValue: "Development Team"
      maxContextDocs:
        type: number
        min: 1
        max: 50
        defaultValue: 10
      verbose:
        type: bool
        defaultValue: false
    template: |
      <system_prompt key="{{vars.security_key}}">
      <team>{{props.teamName}}</team>
      <context_limit>{{props.maxContextDocs}}</context_limit>
      <verbose_mode>{{props.verbose}}</verbose_mode>

      {{{agent.inline.prompt}}}

      Follow team guidelines and best practices.
      </system_prompt>

agents:
  # Agent with default props
  - id: default_agent
    inline:
      layout: "config_layout"  # Uses default values
      prompt: |
        You are an agent with default settings.

  # Agent with custom props
  - id: custom_agent
    inline:
      layout:
        id: "config_layout"
        props:
          teamName: "AI Research Team"
          maxContextDocs: 25
          verbose: true
      prompt: |
        You are an agent with custom settings.
```

**When to use props validation:**
- Multiple agents need different configuration values
- Type safety is important (number ranges, enums, booleans)
- You want validation errors for invalid values
- Shared layout across many agents with varying settings

### Available Template Variables

Use these variables in your custom layouts:

- `{{{agent.inline.prompt}}}` - Agent's prompt content
- `{{{agent.id}}}`, `{{{agent.name}}}` - Agent metadata
- `{{vars.security_key}}` - Security key for containers
- `{{{documents.doc-name.content}}}` - Document content
- `{{props.yourPropName}}` - Custom props
- `{{env.YOUR_ENV_VAR}}` - Environment variables

### Layout Best Practices

1. **Always use security containers**: Wrap content in `<system_prompt key="{{vars.security_key}}">`
2. **Inject agent prompt**: Use `{{{agent.inline.prompt}}}` with triple braces
3. **Provide defaults**: Set `defaultValue` for all props
4. **Keep it simple**: Start with minimal structure, add complexity only when needed
5. **Reuse common patterns**: Extract repeated structures into layouts

### Example: Documentation-focused Layout

```yaml
layouts:
  doc_reviewer_layout: |
    <system_prompt key="{{vars.security_key}}">
    <role>Documentation Reviewer</role>

    <standards>
    {{{documents.writing-guide.content}}}
    </standards>

    <instructions>
    {{{agent.inline.prompt}}}
    </instructions>

    Always check for clarity, accuracy, and consistency.
    </system_prompt>

documents:
  writing-guide: |
    # Writing Guide
    - Use clear, concise language
    - Include code examples
    - Follow markdown conventions

agents:
  - id: doc_reviewer
    inline:
      layout: "doc_reviewer_layout"
      prompt: |
        Review documentation for technical accuracy and readability.
```

## Props Schema

**Note:** Built-in layouts (`crewx/default` and `crewx/minimal`) do not use props. This section is relevant when creating **custom layouts**.

CrewX uses **React PropTypes-style** validation for layout props. If you're familiar with React, this will feel natural.

### Prop Types

#### String Props

```yaml
propsSchema:
  name:
    type: string
    defaultValue: "default"
```

**With constraints:**
```yaml
propsSchema:
  theme:
    type: string
    oneOf: ["light", "dark", "auto"]  # Enum values
    defaultValue: "auto"
```

**Usage in a custom layout:**
```yaml
layout:
  id: "my/custom-layout"
  props:
    theme: "dark"  # Must be "light", "dark", or "auto"
```

#### Number Props

```yaml
propsSchema:
  maxItems:
    type: number
    min: 1
    max: 100
    defaultValue: 10
```

**Usage in a custom layout:**
```yaml
layout:
  id: "my/custom-layout"
  props:
    maxItems: 25  # Must be between 1 and 100
```

#### Boolean Props

```yaml
propsSchema:
  enabled:
    type: bool
    defaultValue: true
```

**Usage in a custom layout:**
```yaml
layout:
  id: "my/custom-layout"
  props:
    enabled: false
```

#### Array Props

**Simple array:**
```yaml
propsSchema:
  tags:
    type: array
    defaultValue: []
```

**Typed array (arrayOf):**
```yaml
propsSchema:
  sections:
    type: arrayOf
    itemType: string
    itemOneOf: ["section1", "section2", "section3"]
    defaultValue: ["section1"]
```

**Usage in a custom layout:**
```yaml
layout:
  id: "my/custom-layout"
  props:
    sections: ["section1", "section2"]  # Each item must be valid
```

### Required Props

Use `isRequired` to enforce mandatory props:

```yaml
propsSchema:
  userId:
    type: string
    isRequired: true  # Must be provided
```

**Usage in a custom layout:**
```yaml
layout:
  id: "my/custom-layout"
  props:
    userId: "user123"  # Required, cannot be omitted
```

### Complex Example

```yaml
propsSchema:
  # String with enum constraint
  theme:
    type: string
    oneOf: ["light", "dark", "auto"]
    defaultValue: "auto"
    description: "UI theme preference"

  # Number with range constraint
  maxDocs:
    type: number
    min: 1
    max: 50
    defaultValue: 10
    description: "Maximum documents to load"

  # Boolean flag
  enableCache:
    type: bool
    defaultValue: true
    description: "Enable response caching"

  # Array of specific strings
  features:
    type: arrayOf
    itemType: string
    itemOneOf: ["search", "analytics", "reporting"]
    defaultValue: ["search"]
    description: "Enabled features"

  # Required string
  agentName:
    type: string
    isRequired: true
    description: "Agent display name"
```

### React PropTypes Comparison

If you know React PropTypes, here's the mapping:

| React PropTypes | CrewX Schema | Example |
|----------------|--------------|---------|
| `PropTypes.string` | `type: string` | `name: "value"` |
| `PropTypes.number` | `type: number` | `count: 42` |
| `PropTypes.bool` | `type: bool` | `enabled: true` |
| `PropTypes.array` | `type: array` | `items: [1, 2, 3]` |
| `PropTypes.arrayOf(PropTypes.string)` | `type: arrayOf, itemType: string` | `tags: ["a", "b"]` |
| `PropTypes.oneOf(["a", "b"])` | `oneOf: ["a", "b"]` | `mode: "a"` |
| `.isRequired` | `isRequired: true` | Required field |

## Layout Resolution

### Resolution Order

CrewX resolves layouts in two stages:

1. **Built-in layouts** - Load from CrewX system (`templates/agents/*.yaml`)
2. **Props override** - Apply user-provided props from `crewx.yaml` (for custom layouts with props)

```
┌─────────────────────────┐
│  Built-in Layout        │  Step 1: Load base layout
│  (crewx/default or      │         (default/minimal)
│   crewx/minimal)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Custom Layout Props    │  Step 2: Apply props
│  (if using custom       │         (custom layouts only)
│   layout)               │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  Final Layout           │  Result: Rendered layout
│                         │          with agent prompt
└─────────────────────────┘
```

### Props Override Example (Custom Layouts)

**Custom layout defines:**
```yaml
# my-custom-layout.yaml (custom layout)
id: "my/custom-layout"
propsSchema:
  theme:
    type: string
    defaultValue: "auto"
  maxItems:
    type: number
    defaultValue: 10
```

**User overrides in crewx.yaml:**
```yaml
# crewx.yaml (your project)
agents:
  - id: my_agent
    inline:
      layout:
        id: "my/custom-layout"
        props:
          theme: "dark"      # Override: "auto" → "dark"
          maxItems: 20       # Override: 10 → 20
      prompt: |
        Your instructions here.
```

**Final rendered layout:**
- `theme` = `"dark"` (overridden)
- `maxItems` = `20` (overridden)

### Fallback Behavior

| Scenario | Behavior | Example |
|----------|----------|---------|
| Layout exists | Use specified layout | `layout: "crewx/minimal"` → loads minimal |
| Layout not found | Fall back to `crewx/default` | `layout: "unknown/layout"` → uses default + warning |
| Props invalid (lenient mode) | Use default values + warning | Invalid prop → uses default value |
| Props invalid (strict mode) | Error, execution stops | Invalid prop → throws error |

### Validation Modes

**Lenient Mode (default):**
- Invalid props → Use default values
- Unknown props → Ignore with warning
- Missing required props → Use defaults if available

**Strict Mode:**
- Invalid props → Throw validation error
- Unknown props → Throw validation error
- Missing required props → Throw validation error

Configuration is set by CrewX system, not user-configurable.

## Best Practices

### 1. Start Simple

Begin with built-in layouts before creating custom ones:

```yaml
# ✅ Good: Start with built-in
agents:
  - id: my_agent
    inline:
      layout: "crewx/default"
      prompt: |
        Your instructions.
```

### 2. Use Meaningful Prop Names

Make props self-documenting:

```yaml
# ✅ Good: Clear prop names
props:
  maxContextDocuments: 20
  enableConversationHistory: true

# ❌ Bad: Cryptic names
props:
  max: 20
  en: true
```

### 3. Provide Default Values

Always set sensible defaults in layout definitions:

```yaml
propsSchema:
  theme:
    type: string
    defaultValue: "auto"  # ✅ Default provided

  mode:
    type: string
    # ❌ No default - users must always specify
```

### 4. Document Your Props

Use `description` to explain prop purpose:

```yaml
propsSchema:
  maxContextDocs:
    type: number
    min: 1
    max: 50
    defaultValue: 10
    description: "Maximum number of context documents to load. Higher values improve context but increase token usage."  # ✅ Helpful
```

### 5. Use Type Constraints

Leverage `oneOf`, `min`, `max` to catch errors early:

```yaml
propsSchema:
  theme:
    type: string
    oneOf: ["light", "dark", "auto"]  # ✅ Validates input
    defaultValue: "auto"

  # ❌ No constraint - any string accepted (prone to typos)
  theme:
    type: string
    defaultValue: "auto"
```

### 6. Keep Layouts Focused

Each layout should serve a specific purpose:

```yaml
# ✅ Good: Focused layouts
- crewx/default   → Full agent profile with complete context
- crewx/minimal   → Lightweight wrapper for simple agents

# ❌ Bad: One layout trying to do everything
- crewx/mega-layout  → Supports 20 different modes with tons of props
```

### 7. Security Considerations

**Never hardcode secrets:**
```yaml
# ❌ NEVER DO THIS
props:
  apiKey: "sk-1234567890"  # Hard-coded secret
```

**Use environment variables instead:**
```yaml
# ✅ Reference environment variables in prompt
prompt: |
  API Key: {{env.API_KEY}}  # Safe: from environment
```

**Trust only system layouts:**
- Built-in CrewX layouts are security-reviewed
- Custom layouts should undergo security review
- Props are sanitized and escaped by CrewX

## Examples

### Example 1: Simple Agent with Default Layout

**Scenario:** Create a basic code review agent.

```yaml
agents:
  - id: code_reviewer
    name: "Code Review Assistant"
    inline:
      provider: "cli/claude"
      layout: "crewx/default"  # Use simple default
      prompt: |
        You are a code review assistant.

        Review code for:
        - Type safety
        - Error handling
        - Performance issues
        - Security vulnerabilities

        Provide constructive feedback with examples.
```

**Usage:**
```bash
crewx query "@code_reviewer review my authentication code"
```

### Example 2: Minimal Agent for Simple Tasks

**Scenario:** Create a lightweight assistant for simple, focused tasks.

```yaml
agents:
  - id: quick_helper
    name: "Quick Helper"
    inline:
      provider: "cli/claude"
      layout: "crewx/minimal"  # Lightweight wrapper
      prompt: |
        You are a quick helper for simple questions.

        Keep answers:
        - Concise and to the point
        - Clear and actionable
        - Under 3 sentences when possible

        Focus on efficiency and speed.
```

**Usage:**
```bash
crewx query "@quick_helper what is the syntax for array map in JavaScript?"
crewx query "@quick_helper explain git rebase in one sentence"
```

### Example 3: Multiple Agents Sharing Layout

**Scenario:** Create frontend and backend specialists sharing the same layout structure.

```yaml
agents:
  - id: frontend_specialist
    name: "Frontend Expert"
    inline:
      provider: "cli/claude"
      layout: "crewx/default"  # Shared structure
      prompt: |
        You are a frontend development specialist.

        Expertise:
        - React, Vue, Angular
        - CSS, Tailwind, styled-components
        - Browser APIs and optimization

  - id: backend_specialist
    name: "Backend Expert"
    inline:
      provider: "cli/gemini"
      layout: "crewx/default"  # Same structure, different content
      prompt: |
        You are a backend development specialist.

        Expertise:
        - Node.js, Python, Go
        - Database design (SQL, NoSQL)
        - API design and security
```

**Benefits:**
- Consistent prompt structure across agents
- Easy to maintain (update layout once)
- Clear separation of concerns

### Example 4: Choosing Layout Based on Use Case

**Scenario:** Use different layouts for different complexity levels.

```yaml
agents:
  - id: simple_qa
    name: "Simple Q&A Assistant"
    inline:
      layout: "crewx/minimal"  # Lightweight for simple tasks
      prompt: |
        You are a Q&A assistant for quick questions.
        Provide brief, direct answers without extra context.

  - id: complex_analyst
    name: "Complex Analysis Assistant"
    inline:
      layout: "crewx/default"  # Full context for complex tasks
      prompt: |
        You are an analysis assistant for complex technical questions.

        Provide comprehensive analysis including:
        - Root cause investigation
        - Multiple solution approaches
        - Trade-off analysis
        - Best practice recommendations

        Use full context and agent capabilities as needed.
```

### Example 5: Progressive Enhancement

**Scenario:** Start simple, optimize as needed.

**Version 1: Start with implicit default**
```yaml
agents:
  - id: assistant
    inline:
      # Implicit crewx/default layout
      prompt: |
        You are a helpful assistant.
```

**Version 2: Make layout explicit**
```yaml
agents:
  - id: assistant
    inline:
      layout: "crewx/default"  # Explicit choice
      prompt: |
        You are a helpful assistant.
```

**Version 3: Optimize for performance**
```yaml
agents:
  - id: assistant
    inline:
      layout: "crewx/minimal"  # Switch to minimal for efficiency
      prompt: |
        You are a helpful assistant focused on quick responses.
```

## See Also

### Related Documentation

- [Template System](templates.md) - Document management and template variables
- [Template Variables](template-variables.md) - Available variables and helpers
- [Agent Configuration](agent-configuration.md) - Complete agent setup guide

### Developer Documentation

- [Context Integration Standard](../packages/docs/context-integration-standard.md) - Layout rendering pipeline (WBS-14)
- [Layout DSL Reference](../packages/docs/layout-dsl-field-reference.md) - Technical layout specification
- [WBS-11 Layout Spec](../wbs/wbs-11-layout-spec.md) - Original layout requirements

### Quick Links

**For Users:**
- Want to use templates in your prompts? → [Template System](templates.md)
- Need to reference variables? → [Template Variables](template-variables.md)
- Setting up custom agents? → [Agent Configuration](agent-configuration.md)

**For Developers:**
- Building custom layouts? → [Layout DSL Reference](../packages/docs/layout-dsl-field-reference.md)
- Understanding the pipeline? → [Context Integration Standard](../packages/docs/context-integration-standard.md)
