# Layout DSL Field Reference

## Purpose
This reference documents every field, helper, and rendering hook available to CrewX layout templates after the WBS-14 context integration. Use it when designing custom layouts or validating props schemas.

## Rendering Pipeline Recap
1. `LayoutLoader.load(layoutId, props)` resolves the YAML manifest, validates `props` against its `propsSchema`, and returns an in-memory layout.
2. `LayoutRenderer.render(layout, renderContext)` executes Handlebars templates with the sanitized context below.
3. `processDocumentTemplate()` runs post-processing: document includes, helper registration, and security-tag preservation.

## Core Render Context
| Key             | Type                            | Description                                                                                                                                                                                                                                         |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent`         | Object                          | Raw agent fields (`id`, `name`, `role`, `team`, `description`, `workingDirectory`, `capabilities`, `specialties`, `provider`, `providerList`, `providerRaw`, `inline`, `model`, `options`, `optionsArray`, `optionsByMode`, `remote`, `documents`). |
| `layout`        | Object                          | `{ system_prompt, prompt }` seeded with the resolved base system prompt. Allows templates to embed or transform base text.                                                                                                                          |
| `props`         | Object                          | Validated custom props supplied through `inline.layout.props`. Defaults to `{}`.                                                                                                                                                                    |
| `messages`      | Array                           | Conversation history (previous turns). Each entry: `{ text, isAssistant, metadata }`. Use helpers like `formatConversation`.                                                                                                                        |
| `platform`      | String                          | Channel hint e.g. `cli`, `slack`, `mcp`.                                                                                                                                                                                                            |
| `vars`          | Object                          | Runtime variables (currently `security_key`).                                                                                                                                                                                                       |
| `env`           | Object                          | Selected environment variables (entire `process.env` by default).                                                                                                                                                                                   |
| `session`       | Object                          | `{ mode, platform, options, env, vars, tools }` summarizing current invocation.                                                                                                                                                                     |
| `context`       | Object                          | Mirrors `TemplateContext` for compatibility; includes `mode`, `platform`, `options`, `env`, `vars`, `agent`.                                                                                                                                        |
| `documents`     | Object                          | Document stubs resolved lazily by `processDocumentTemplate()`. Access via `{{{documents.<id>.content}}}`.                                                                                                                                           |

## Layout Manifest Structure
```yaml
id: crewx/default
version: 1.0.0
propsSchema:
  sidebarTheme:
    type: string
    oneOf: [light, dark, auto]
    defaultValue: auto
    description: Layout theme selection
  showTimeline:
    type: bool
    defaultValue: true
    description: Toggle conversation history block
layout:
  system_prompt: |
    <crewx_system_prompt key="{{vars.security_key}}">
      ...
    </crewx_system_prompt>
```
- `propsSchema` uses React PropTypes-inspired keywords: `type`, `isRequired`, `defaultValue`, `oneOf`, `min`, `max`, `arrayOf`, `shape`, etc.
- Unknown props trigger warnings (lenient mode) or errors (strict mode) depending on loader configuration.

## Supported Helpers & Patterns
| Helper | Purpose | Example |
| ------ | ------- | ------- |
| `formatConversation messages platform` | Formats conversation history into XML for layouts. | `{{{formatConversation messages platform}}}` |
| Inline conditionals | Branch based on metadata. | `{{#if agentMetadata.specialties.[0]}}…{{/if}}` |
| Each loops | Iterate over arrays. | `{{#each agentMetadata.capabilities}}<item>{{this}}</item>{{/each}}` |
| Fallback blocks | Provide compatibility with legacy fields. | `{{else if agent.capabilities.[0]}}` |
| Document inclusion | Embed shared documents. | `{{{documents.crewx-manual.content}}}` |
| Security key usage | Preserve prompt containers. | `<system_prompt key="{{vars.security_key}}">` |

## Rendering Guidelines
- Always wrap final instructions inside `<system_prompt key="{{vars.security_key}}">…</system_prompt>` to keep alignment with downstream security checks.
- Use `agentMetadata` first, then fallback to `agent` to avoid duplication.
- Avoid concatenating large JSON blobs; use `tools.json` or iterate `tools.list`.
- Treat `env` as read-only hints; never expose sensitive values.
- For channel-specific branches, gate on `platform` or `session.platform` rather than `agent.provider`.

## Example Layout Snippet
```hbs
<agent_profile>
  <identity>
    <id>{{{agent.id}}}</id>
    {{#if agentMetadata.description}}
    <description>{{{agentMetadata.description}}}</description>
    {{else if agent.description}}
    <description>{{{agent.description}}}</description>
    {{/if}}
  </identity>

  {{#if agentMetadata.specialties.[0]}}
  <specialties>
    {{#each agentMetadata.specialties}}
    <item>{{{this}}}</item>
    {{/each}}
  </specialties>
  {{/if}}
</agent_profile>
```

## Rendering Pipeline Debugging
- Enable `CREWX_WBS14_TELEMETRY=true` to log layout ID, metadata counts, and platform for each render.
- Layout load failures log at `warn` level, then trigger fallback to the priority chain documented in `context-integration-standard.md`.
- `npm run test:cli` covers both layout rendering and fallback paths. Add assertions there when extending the DSL.

## Related Resources
- `packages/docs/context-integration-standard.md` — Architectural overview.
- `wbs/wbs-11-layout-spec.md` — Original DSL requirements and examples.
- `templates/agents/default.yaml` — Canonical layout demonstrating every field.
