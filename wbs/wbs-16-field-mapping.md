# WBS-16 Field Mapping: Claude Skills ↔ CrewX YAML

## Overview

This document maps fields between Claude `skills.md` format and CrewX YAML configuration to create a unified schema for SDK processing.

## Claude Skills Metadata Format

Based on WBS-16 specification examples, Claude skills use YAML frontmatter:

```markdown
---
name: code-formatter
description: "Formats code snippets in various programming languages using established conventions."
version: "1.0.0"
dependencies: []
---

## Role
[Skill role description...]

## Task
[Skill task description...]

## Instructions
[Skill instructions...]
```

### Claude Skills Fields

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | string | ✅ Yes | Skill identifier | "code-formatter" |
| `description` | string | ✅ Yes | Short skill description | "Formats code snippets..." |
| `version` | string | ✅ Yes | Semantic version | "1.0.0" |
| `dependencies` | array | ❌ No | Dependent skills | ["code-analyzer@2.5.0"] |
| `runtime` | object | ❌ No | Runtime requirements | `{ python: ">=3.11" }` |
| `visibility` | string | ❌ No | Public/private visibility | "public" |

### Claude Skills Content Structure

| Section | Type | Required | Description |
|---------|------|----------|-------------|
| `## Role` | markdown | ✅ Yes | Skill role description |
| `## Task` | markdown | ✅ Yes | Primary task description |
| `## Instructions` | markdown | ✅ Yes | Step-by-step instructions |

---

## CrewX YAML Fields

### Agent Configuration (`agents.yaml` / `crewx.yaml`)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string | ✅ Yes | Agent identifier | "crewx_dev" |
| `name` | string | ❌ No | Display name | "CrewX Developer" |
| `role` | string | ❌ No | Agent role | "developer" |
| `team` | string | ❌ No | Team name | "CrewX" |
| `provider` | string\|array | ✅ Yes | AI provider(s) | "cli/claude" or ["cli/claude", "cli/gemini"] |
| `working_directory` | string | ❌ No | Working directory | "." |
| `description` | string | ❌ No | Agent description | "Developer for CrewX project" |
| `specialties` | array | ❌ No | Agent specialties | ["TypeScript", "NestJS"] |
| `capabilities` | array | ❌ No | Agent capabilities | ["Implementation", "Testing"] |
| `inline.type` | string | ❌ No | Inline type | "agent" |
| `inline.model` | string | ❌ No | Default model | "sonnet" |
| `inline.system_prompt` | string | ❌ No | System prompt | "You are a developer..." |
| `inline.layout` | string\|object | ❌ No | Layout reference | "crewx/default" |
| `options.query` | array\|object | ❌ No | Query mode options | ["--add-dir=."] |
| `options.execute` | array\|object | ❌ No | Execute mode options | ["--permission-mode=acceptEdits"] |

### Skills Configuration (NEW - WBS-16)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `skillsPaths` | array | ❌ No | Additional skill directories | ["./skills", "../shared-skills"] |
| `skills.include` | array | ❌ No | Explicitly include skills | ["code-formatter", "git-commit-generator"] |
| `skills.exclude` | array | ❌ No | Explicitly exclude skills | ["deprecated-skill"] |
| `skills.autoload` | boolean | ❌ No | Auto-load from skillsPaths | `true` (default) |

---

## Field Mapping Table

### Direct Mappings

| Claude Skills Field | CrewX YAML Field | Mapping Type | Notes |
|---------------------|------------------|--------------|-------|
| `name` | `id` | 1:1 | Skill name → Agent ID |
| `description` | `description` | 1:1 | Short description |
| `version` | `inline.version` (NEW) | 1:1 | Semantic version |
| Role section | `role` | Content → Meta | Extract from markdown |
| Task section | `inline.system_prompt` | Content → Meta | Extract from markdown |
| Instructions | `inline.system_prompt` | Content → Meta | Append to system prompt |

### Derived Mappings

| Source | Target | Transformation | Example |
|--------|--------|----------------|---------|
| `dependencies` array | `skills.include` | Parse dependency names | `["code-analyzer@2.5.0"]` → `["code-analyzer"]` |
| `runtime.python` | `capabilities` (optional) | Convert to capability | `">=3.11"` → `["python:3.11+"]` |
| Claude skills/ directory | `skillsPaths[0]` | Default path | `~/.claude/skills` or SDK bundled path |

### New Fields for Integration

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `skillsPaths` | string[] | `[]` | Additional directories to scan for skills |
| `skills.include` | string[] | `[]` | Explicitly included skill names |
| `skills.exclude` | string[] | `[]` | Explicitly excluded skill names |
| `skills.autoload` | boolean | `true` | Auto-load skills from skillsPaths |
| `inline.version` | string | `"1.0.0"` | Agent/skill version |
| `inline.dependencies` | string[] | `[]` | Required skills for this agent |

---

## Integration Scenarios

### Scenario 1: Claude Skill → CrewX Agent

**Claude skill (`code-formatter.md`):**
```markdown
---
name: code-formatter
description: "Formats code snippets in various languages"
version: "1.0.0"
dependencies: []
---

## Role
You are an expert code formatter.

## Task
Reformat code according to language standards.

## Instructions
1. Identify language
2. Apply formatting
3. Output formatted code
```

**CrewX agent (generated):**
```yaml
agents:
  - id: "code-formatter"
    name: "Code Formatter"
    description: "Formats code snippets in various languages"
    provider: "cli/claude"
    inline:
      version: "1.0.0"
      role: "code-formatter"
      system_prompt: |
        ## Role
        You are an expert code formatter.

        ## Task
        Reformat code according to language standards.

        ## Instructions
        1. Identify language
        2. Apply formatting
        3. Output formatted code
```

### Scenario 2: CrewX Agent with Skill Selection

```yaml
agents:
  - id: "developer"
    name: "CrewX Developer"
    provider: "cli/claude"
    skills:
      include:
        - "code-formatter"
        - "git-commit-generator"
      exclude:
        - "deprecated-formatter"
    inline:
      system_prompt: |
        You are a developer with access to code formatting and git commit skills.
```

### Scenario 3: Custom Skills Paths

```yaml
settings:
  skillsPaths:
    - "./project-skills"
    - "../shared-team-skills"
    - "~/.claude/skills"  # Default Claude skills directory

agents:
  - id: "custom_agent"
    skills:
      autoload: true  # Load all skills from skillsPaths
      exclude:
        - "experimental-skill"
```

---

## Progressive Disclosure Strategy

### Phase 1 (WBS-16): Metadata Only

**Load:**
- Frontmatter (name, description, version, dependencies)
- File paths and references

**Skip (for now):**
- Full markdown content
- Role/Task/Instructions sections

### Phase 2 (WBS-17): Full Content Loading

**Load on demand:**
- Parse markdown sections
- Build system prompts
- Handle runtime requirements

---

## Schema Design Principles

### 1. **Backward Compatibility**

- Existing `agents.yaml` files work without changes
- New `skills` fields are optional
- Default behavior: no skills loaded unless explicitly configured

### 2. **Progressive Enhancement**

- Start with simple metadata (name, description, version)
- Load full content only when needed
- Cache parsed results

### 3. **Explicit Over Implicit**

- `skills.include` explicitly lists desired skills
- `skills.exclude` explicitly blocks unwanted skills
- No hidden magic, clear configuration

### 4. **Multi-Source Support**

- Default: Claude Code `skills/` directory
- Additional: `skillsPaths` array
- Project-specific: `./skills` in project root
- Global: User's home directory

---

## Validation Rules

### Skill Metadata Validation

```typescript
interface SkillMetadataValidation {
  name: {
    required: true;
    pattern: /^[a-z0-9-]+$/;  // Kebab-case
    maxLength: 50;
  };
  description: {
    required: true;
    minLength: 10;
    maxLength: 200;
  };
  version: {
    required: true;
    pattern: /^\d+\.\d+\.\d+$/;  // Semantic versioning
  };
  dependencies: {
    required: false;
    items: {
      pattern: /^[a-z0-9-]+(@\d+\.\d+\.\d+)?$/;  // name or name@version
    };
  };
}
```

### CrewX Skills Configuration Validation

```typescript
interface SkillsConfigValidation {
  skillsPaths: {
    required: false;
    items: {
      type: 'string';
      validate: (path) => isValidDirectory(path);
    };
  };
  skills: {
    include: {
      required: false;
      items: { pattern: /^[a-z0-9-]+$/ };
    };
    exclude: {
      required: false;
      items: { pattern: /^[a-z0-9-]+$/ };
    };
    autoload: {
      type: 'boolean';
      default: true;
    };
  };
}
```

---

## Error Handling

### Skill Not Found

```typescript
class SkillNotFoundError extends Error {
  constructor(skillName: string, searchPaths: string[]) {
    super(`Skill "${skillName}" not found in paths: ${searchPaths.join(', ')}`);
  }
}
```

### Dependency Resolution Failure

```typescript
class SkillDependencyError extends Error {
  constructor(skillName: string, missingDeps: string[]) {
    super(`Skill "${skillName}" missing dependencies: ${missingDeps.join(', ')}`);
  }
}
```

### Version Mismatch

```typescript
class SkillVersionMismatchError extends Error {
  constructor(skillName: string, required: string, found: string) {
    super(`Skill "${skillName}" version mismatch. Required: ${required}, Found: ${found}`);
  }
}
```

---

## Next Steps (Phase 2)

1. **Parser Implementation**: Create `parseSkillManifest()` in SDK
2. **Loader Integration**: Integrate skill loading into `AgentLoaderService`
3. **Dependency Resolution**: Build dependency graph and resolve order
4. **Cache Strategy**: Implement metadata caching for performance
5. **CLI Integration**: Update CLI to use SDK parsers

---

## References

- WBS-16 Specification: [wbs/wbs-16-sdk-config-schema.md](./wbs-16-sdk-config-schema.md)
- Layout System: [packages/sdk/src/types/layout.types.ts](../packages/sdk/src/types/layout.types.ts)
- Agent Types: [packages/sdk/src/types/agent.types.ts](../packages/sdk/src/types/agent.types.ts)
