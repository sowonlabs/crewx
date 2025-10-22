# Template System Guide

Complete guide for using the template system in CrewX, including document management, Handlebars helpers, and dynamic prompts.

## Table of Contents

- [Overview](#overview)
- [Document System](#document-system)
- [Handlebars Helpers](#handlebars-helpers)
- [Built-in Helpers](#built-in-helpers)
- [Template Examples](#template-examples)
- [Layout System](#layout-system)
- [Best Practices](#best-practices)

## Overview

CrewX's template system enables:
- **Knowledge sharing** across agents
- **Project documentation** access through template variables
- **Dynamic prompts** with Handlebars
- **Context preservation** in agent system prompts
- **Coding standards** enforcement

## Document System

### 3-Level Document System

Documents are defined at three levels with clear priority:

1. **`documents.yaml`** - Global documents (shared across projects)
2. **`crewx.yaml` documents:** - Project-level documents
3. **`agent.inline.documents`** - Agent-specific documents

**Priority:** `agent.inline.documents` > `crewx.yaml documents` > `documents.yaml`

### Document Definition Methods

#### 1. Inline Raw Markdown (Simple)

```yaml
# documents.yaml
documents:
  quick_tips: |
    # Quick Tips
    - Use @agent:model to specify AI model
    - Use q/x shortcuts for query/execute
```

#### 2. Object Format with Metadata

```yaml
documents:
  coding_standards:
    content: |
      # Coding Standards
      ## TypeScript
      - Always use strict type checking
    summary: "Project coding standards"
    type: "markdown"
```

#### 3. Load from File Path

```yaml
documents:
  readme:
    path: "docs/README.md"
    summary: "Main project documentation"
    type: "markdown"
    lazy: false  # Load immediately

  large_guide:
    path: "docs/large-guide.md"
    summary: "Comprehensive guide"
    lazy: true   # Load on-demand (for large files)
```

### Using Documents in Agents

Reference documents in `prompt` using Handlebars template variables:

```yaml
# crewx.yaml
documents:
  project_guide: |
    # Project Guide
    This is project-specific documentation.

agents:
  - id: "my_agent"
    inline:
      documents:
        agent_doc: |
          # Agent-Specific Doc
          Only this agent can see this.

      prompt: |
        You are a helpful assistant.

        <document name="quick_tips">
        {{{documents.quick_tips.content}}}
        </document>

        <toc>
        {{{documents.readme.toc}}}
        </toc>

        Summary: {{documents.readme.summary}}
```

### Template Variables

**Content:**
- `{{{documents.name.content}}}` - Full document content (unescaped)
- `{{documents.name.content}}` - Escaped content

**Metadata:**
- `{{{documents.name.toc}}}` - Table of contents (markdown headings)
- `{{documents.name.summary}}` - Document summary
- `{{documents.name.type}}` - Document type

**Important:** Use triple braces `{{{...}}}` to preserve markdown formatting.

## Handlebars Helpers

### Available Context Variables

**Documents:**
```handlebars
{{{documents.doc_name.content}}}  - Full document content (unescaped)
{{{documents.doc_name.toc}}}      - Table of contents
{{documents.doc_name.summary}}     - Document summary (escaped)
```

**Environment Variables:**
```handlebars
{{env.NODE_ENV}}           - Access any environment variable
{{env.API_KEY}}
{{env.DEBUG}}
```

**Agent Metadata:**
```handlebars
{{agent.id}}               - Agent ID
{{agent.name}}             - Agent name
{{agent.provider}}         - AI provider (cli/claude, cli/gemini, cli/copilot, plugin/*)
{{agent.model}}            - Model name (sonnet, haiku, etc.)
{{agent.workingDirectory}} - Working directory
```

**Mode:**
```handlebars
{{mode}}                   - 'query' or 'execute'
```

**Custom Variables:**
```handlebars
{{vars.customKey}}         - Any custom variable passed in context
```

### Conditional Helpers

#### Equality Check
```handlebars
{{#if (eq agent.provider "cli/claude")}}
You are using Claude AI.
{{else}}
You are using another AI provider.
{{/if}}
```

#### Not Equal
```handlebars
{{#if (ne env.NODE_ENV "production")}}
Debug mode is enabled.
{{/if}}
```

#### Contains (Array)
```handlebars
{{#if (contains options "--verbose")}}
Verbose output enabled.
{{/if}}
```

#### Logical AND
```handlebars
{{#if (and agent.model env.DEBUG)}}
Model: {{agent.model}}, Debug enabled
{{/if}}
```

#### Logical OR
```handlebars
{{#if (or (eq agent.provider "cli/claude") (eq agent.provider "cli/gemini"))}}
Web search is available.
{{/if}}
```

#### Logical NOT
```handlebars
{{#if (not env.PRODUCTION)}}
Running in development mode.
{{/if}}
```

## Built-in Helpers

### formatConversation Helper

The `formatConversation` helper formats conversation history for AI prompts. It supports two modes: basic template (recommended) and custom template.

#### Basic Usage (Recommended)

Use the built-in template with one line:

```handlebars
{{{formatConversation messages platform}}}
```

**Output example:**
```xml
<messages>
Previous conversation (22 messages):
(Slack thread)

**Doha (<@U08LSF2KNVD>)**: 안녕하세요
**crewxdev (<@U09J206RP8V>) (@CrewX)**: 안녕하세요! 무엇을 도와드릴까요?
...
</messages>
```

**Features:**
- ✅ Automatic `<messages>` tag wrapping
- ✅ Slack mention formatting
- ✅ Message count display
- ✅ Platform label (Slack thread)
- ✅ User/Agent distinction

#### Custom Template Usage

For special formatting needs, use as a block helper:

```handlebars
{{#formatConversation messages platform}}
<conversation-history platform="{{platform}}" count="{{messagesCount}}">
{{#each messages}}
{{#if isAssistant}}
[AI] {{{text}}}
{{else}}
[USER] {{{text}}}
{{/if}}
{{/each}}
</conversation-history>
{{/formatConversation}}
```

**Output example:**
```xml
<messages>
<conversation-history platform="slack" count="22">
[USER] 안녕하세요
[AI] 안녕하세요! 무엇을 도와드릴까요?
...
</conversation-history>
</messages>
```

#### Available Variables in Block Helper

**Context variables:**
- `messages`: Message array
- `platform`: 'slack' or 'cli'
- `messagesCount`: Number of messages

**Each message object:**
```javascript
{
  text: string,           // Message content
  isAssistant: boolean,   // AI message indicator
  metadata: {
    agent_id: string,     // Agent ID
    slack: {              // Slack metadata
      user_id: string,
      username: string,
      user_profile: {
        display_name: string,
        real_name: string
      },
      bot_user_id: string,
      bot_username: string
    }
  }
}
```

#### Best Practices

**✅ Recommended:**
1. Use basic template first: `{{{formatConversation messages platform}}}`
2. Use platform-specific branching when needed
3. Use meaningful XML tags

**❌ Avoid:**
1. Manually adding `<messages>` tags (helper does this automatically)
2. Complex logic in templates (keep it simple)
3. Missing metadata safety checks

## Template Examples

### Example 1: Environment-Specific Behavior

```yaml
agents:
  - id: "dev_assistant"
    inline:
      prompt: |
        You are a development assistant.

        {{#if (eq env.NODE_ENV "production")}}
        **Production Mode**: Be extra careful with suggestions.
        Always recommend testing changes thoroughly.
        {{else}}
        **Development Mode**: Feel free to experiment.
        You can suggest more experimental approaches.
        {{/if}}

        Working Directory: {{agent.workingDirectory}}
```

### Example 2: Provider-Specific Features

```yaml
agents:
  - id: "researcher"
    inline:
      prompt: |
        You are a research assistant.

        {{#if (or (eq agent.provider "cli/claude") (eq agent.provider "cli/gemini"))}}
        ## Web Search Available
        You have access to web search capabilities.
        Use them to find the latest information.
        {{else}}
        ## Local-Only Analysis
        You don't have web search. Focus on analyzing provided code and files.
        {{/if}}

        Provider: {{agent.provider}}
        Model: {{agent.model}}
```

### Example 3: Model-Specific Instructions

```yaml
agents:
  - id: "coder"
    inline:
      prompt: |
        You are a coding assistant.

        {{#if (eq agent.model "haiku")}}
        ## Fast Response Mode
        Provide concise, quick answers.
        Focus on the most important information.
        {{else if (eq agent.model "opus")}}
        ## Deep Analysis Mode
        Provide detailed, comprehensive analysis.
        Consider edge cases and architectural implications.
        {{else}}
        ## Balanced Mode
        Provide clear, thorough but efficient responses.
        {{/if}}
```

### Example 4: Multi-Level Documents

**documents.yaml (global):**
```yaml
documents:
  coding_standards: |
    # Coding Standards
    ## TypeScript
    - Use strict type checking
    - Prefer interfaces over types
    - Document public APIs
```

**crewx.yaml (project):**
```yaml
documents:
  project_conventions: |
    # Project Conventions
    - Follow trunk-based development
    - Write tests for all features
    - Use semantic commit messages

agents:
  - id: "code_reviewer"
    inline:
      documents:
        review_checklist: |
          # Review Checklist
          - Check type safety
          - Verify test coverage
          - Review error handling

      prompt: |
        You are a code reviewer.

        <coding_standards>
        {{{documents.coding_standards.content}}}
        </coding_standards>

        <project_conventions>
        {{{documents.project_conventions.content}}}
        </project_conventions>

        <review_checklist>
        {{{documents.review_checklist.content}}}
        </review_checklist>
```

### Example 5: Conversation History Integration

```yaml
agents:
  - id: "slack_bot"
    inline:
      prompt: |
        You are a Slack assistant.

        {{{formatConversation messages platform}}}

        Respond naturally based on the conversation history.
```

## Layout System

CrewX layouts provide reusable prompt structure templates. Layouts work together with the template system to organize agent prompts.

**Quick Comparison:**

| Feature | Templates (this doc) | Layouts |
|---------|---------------------|---------|
| Purpose | Document management & variables | Prompt structure & reusability |
| Configuration | `documents`, `{{{variables}}}` | `inline.layout` with props |
| Scope | Content insertion | Structural wrapping |
| Example | Load coding standards | Define system prompt format |

**Template System (this document):**
- Manage documents across agents
- Reference content with `{{{documents.name.content}}}`
- Use Handlebars helpers for dynamic content
- Insert variables like `{{agent.id}}`, `{{env.DEBUG}}`

**Layout System:**
- Define reusable prompt templates
- Customize with React PropTypes-style props
- Share structure across multiple agents
- Security containers and prompt wrapping

**Example - Using Both Together:**

```yaml
# Define documents (Template System)
documents:
  coding_standards: |
    # Coding Standards
    - Use TypeScript strict mode
    - Write unit tests

agents:
  - id: code_reviewer
    inline:
      # Use layout for structure (Layout System)
      layout: "crewx/default"  # Full agent profile

      # Reference documents in prompt (Template System)
      prompt: |
        You are a code reviewer.

        <standards>
        {{{documents.coding_standards.content}}}
        </standards>

        Environment: {{env.NODE_ENV}}
        Provider: {{agent.provider}}
```

For detailed layout usage, see [Layout System Guide](layouts.md).

## Best Practices

### 1. Document ID Naming Convention

**Use underscores (`_`) for document IDs:**

```yaml
# ✅ Recommended: Use underscores
documents:
  coding_standards: |
    # Coding Standards
  api_guide: |
    # API Guide
  review_checklist: |
    # Review Checklist

# ❌ Avoid: Hyphens can cause issues
documents:
  coding-standards: |  # May not work in all contexts
    # Coding Standards
```

**Why underscores?**
- ✅ Works reliably in all template contexts
- ✅ Compatible with Handlebars variable syntax
- ✅ Prevents potential parsing issues
- ✅ Consistent with JavaScript naming conventions

**Example usage:**
```yaml
documents:
  project_conventions: |
    # Project Conventions
    - Follow trunk-based development

agents:
  - id: reviewer
    inline:
      prompt: |
        {{{documents.project_conventions.content}}}
```

### 2. Organize by Scope
- **Global**: Coding standards, general guidelines
- **Project**: Project-specific conventions, architecture
- **Agent**: Role-specific checklists, workflows

### 3. Use Lazy Loading
For large documents (>100KB):
```yaml
documents:
  large_spec:
    path: "docs/large-spec.md"
    lazy: true  # Only load when accessed
```

### 4. Preserve Formatting
Always use triple braces for markdown:
```yaml
{{{documents.name.content}}}  # Correct
{{documents.name.content}}    # Escaped (wrong for markdown)
```

### 5. Provide Summaries
Help agents understand document purpose:
```yaml
documents:
  api_guide:
    path: "docs/api.md"
    summary: "RESTful API design patterns and best practices"
```

### 6. Version Control
Store documents in Git:
```
project/
├── docs/
│   ├── *.md
├── documents.yaml
└── crewx.yaml
```

### 7. Use Environment Variables
Make agents context-aware:
```bash
export NODE_ENV=production
export FEATURE_FLAGS=experimental,beta
crewx query "@dev analyze this feature"
```

### 8. Use Descriptive Variable Names
Make conditions clear:
```handlebars
{{#if (eq env.DEPLOYMENT_ENV "production")}}  # Clear
{{#if (eq env.DE "prod")}}                    # Unclear
```

### 9. Provide Fallbacks
Always have an `{{else}}` clause:
```handlebars
{{#if tools}}
  You have {{tools.count}} tools available.
{{else}}
  No tools available at this time.
{{/if}}
```

## Benefits

✅ **Version Control** - Documents in YAML/markdown files
✅ **Reusability** - Share documents across agents
✅ **Organization** - Separate concerns (global, project, agent)
✅ **Performance** - Lazy loading for large documents
✅ **Flexibility** - Mix inline and file-based documents
✅ **Dynamic Behavior** - Environment and agent-aware prompts

## See Also

- [Layout System Guide](layouts.md) - Reusable prompt templates with props
- [Agent Configuration Guide](agent-configuration.md) - Agent setup
- [CLI Guide](cli-guide.md) - Command-line usage
