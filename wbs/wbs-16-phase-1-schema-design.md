# WBS-16 Phase 1 - SDK Config & Skills Schema Design

**Status**: ✅ Phase 1 Complete
**Date**: 2025-10-20
**Author**: @crewx_claude_dev

---

## Executive Summary

This document presents the complete schema design for integrating Claude `skills.md` format with CrewX YAML configuration. Phase 1 establishes the type system, validation schema, and architectural foundation for SDK-based skill parsing and management.

### Key Deliverables

1. ✅ **TypeScript Types**: `packages/sdk/src/schema/skills.types.ts` (15 interfaces, 4 error classes)
2. ✅ **JSON Schema**: `packages/sdk/schema/skills-config.json` (VS Code autocomplete ready)
3. ✅ **Field Mapping**: `wbs/wbs-16-field-mapping.md` (comprehensive mapping table)
4. ✅ **Design Document**: This document (architecture and implementation guide)

### Design Principles

- **Progressive Disclosure**: Load metadata first, content on demand
- **Backward Compatibility**: Existing `agents.yaml` files work unchanged
- **Explicit Configuration**: No hidden magic, clear skill inclusion/exclusion
- **Multi-Source Support**: Claude skills + project skills + custom paths

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CrewX CLI                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         AgentLoaderService                           │  │
│  │  - Loads agents.yaml / crewx.yaml                    │  │
│  │  - Delegates to SDK parsers                          │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    CrewX SDK                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         SkillParser (Phase 2)                        │  │
│  │  - parseSkillManifest()                              │  │
│  │  - loadSkillMetadata()                               │  │
│  │  - resolveSkillDependencies()                        │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                         │
│  ┌────────────────┴─────────────────────────────────────┐  │
│  │         ConfigParser (Phase 2)                       │  │
│  │  - parseCrewxConfig()                                │  │
│  │  - mergeSkillsConfig()                               │  │
│  │  - validateAgentDefinition()                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Type System (Phase 1) ✅                        │  │
│  │  - SkillMetadata                                     │  │
│  │  - SkillDefinition                                   │  │
│  │  - SkillsConfig                                      │  │
│  │  - AgentDefinition                                   │  │
│  │  - CrewxProjectConfig                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Skill Sources                                  │
│  - Claude Code skills/ directory (default)                  │
│  - Project ./skills directory                               │
│  - Custom skillsPaths                                       │
│  - External skill repositories (future)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Type System Design

### Core Types Hierarchy

```typescript
// Skill Metadata (from skills.md frontmatter)
SkillMetadata {
  name: string;              // Skill identifier
  description: string;       // Short description
  version: string;           // Semantic version
  dependencies?: string[];   // Dependent skills
  runtime?: object;          // Runtime requirements
  visibility?: string;       // public/private/internal
}

// Skill Content (markdown sections)
SkillContent {
  role?: string;             // ## Role section
  task?: string;             // ## Task section
  instructions?: string;     // ## Instructions section
  raw?: string;              // Full markdown (progressive disclosure)
}

// Complete Skill Definition
SkillDefinition {
  metadata: SkillMetadata;
  content?: SkillContent;    // Loaded on demand
  filePath?: string;
  fullyLoaded?: boolean;
}

// Skills Configuration (agent or project level)
SkillsConfig {
  include?: string[];        // Explicitly include skills
  exclude?: string[];        // Explicitly exclude skills
  autoload?: boolean;        // Auto-load from skillsPaths
}

// Agent Definition (extended with skills)
AgentDefinition {
  id: string;
  provider: string | string[];
  skills?: SkillsConfig;     // NEW: Skills configuration
  inline?: {
    version?: string;        // NEW: Agent version
    dependencies?: string[]; // NEW: Skill dependencies
    // ... existing fields
  };
  // ... existing fields
}

// Project Configuration
CrewxProjectConfig {
  skillsPaths?: string[];    // NEW: Global skill directories
  skills?: SkillsConfig;     // NEW: Project-wide skills config
  agents?: AgentDefinition[];
  layouts?: Record<string, string>;
  documents?: Record<string, string>;
  settings?: object;
}
```

### Error Classes

```typescript
class SkillLoadError extends Error
class SkillNotFoundError extends Error
class SkillDependencyError extends Error
class SkillVersionMismatchError extends Error
```

---

## Data Flow Design

### Skill Loading Flow (Phase 2 Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load crewx.yaml                                          │
│    ├─ Parse YAML                                            │
│    └─ Extract skillsPaths, skills config                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Build skill search paths                                 │
│    ├─ Default: Claude Code skills/ directory                │
│    ├─ Add: skillsPaths from config                          │
│    └─ Add: ./skills in project root                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Load agent definitions                                   │
│    └─ For each agent with skills.include:                   │
│       ├─ Scan skill directories                             │
│       ├─ Parse skill frontmatter (metadata only)            │
│       └─ Build skill registry                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Resolve skill dependencies (on demand)                   │
│    ├─ Parse dependency array                                │
│    ├─ Check dependency versions                             │
│    └─ Build dependency graph                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Load full skill content (progressive disclosure)         │
│    └─ When agent is invoked:                                │
│       ├─ Load markdown content                              │
│       ├─ Parse ## Role, ## Task, ## Instructions            │
│       └─ Inject into system prompt                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Field Mapping Summary

### Claude Skills → CrewX Agent

| Claude Skills Field | CrewX Field | Mapping Type |
|---------------------|-------------|--------------|
| `name` | `id` | Direct (1:1) |
| `description` | `description` | Direct (1:1) |
| `version` | `inline.version` | Direct (1:1) |
| `dependencies` | `inline.dependencies` | Direct (1:1) |
| `## Role` section | Extract to `role` field | Content extraction |
| `## Task` + `## Instructions` | Append to `inline.system_prompt` | Content merge |

### CrewX Configuration Additions

New fields added to CrewX YAML:

```yaml
# Project-level (crewx.yaml)
skillsPaths:
  - "./skills"
  - "../shared-skills"
  - "~/.claude/skills"

skills:
  include: ["code-formatter", "git-commit"]
  exclude: ["deprecated-skill"]
  autoload: true

# Agent-level
agents:
  - id: "developer"
    provider: "cli/claude"
    skills:
      include: ["code-formatter"]
      exclude: []
    inline:
      version: "1.0.0"
      dependencies: ["code-analyzer"]
      system_prompt: |
        You are a developer with formatting skills.
```

---

## Validation Strategy

### Metadata Validation Rules

```typescript
interface SkillMetadataValidation {
  name: {
    required: true;
    pattern: /^[a-z0-9-]+$/;  // Kebab-case only
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
      pattern: /^[a-z0-9-]+(@\d+\.\d+\.\d+)?$/;
    };
  };
}
```

### Validation Modes

- **Strict Mode**: All validation errors throw exceptions
- **Lenient Mode**: Validation warnings logged, processing continues

---

## Progressive Disclosure Implementation

### Phase 1: Metadata Only (Current)

```typescript
// Load only frontmatter
const skillMeta: SkillMetadata = await parseSkillFrontmatter(filePath);

// Skip markdown content
const skill: SkillDefinition = {
  metadata: skillMeta,
  filePath,
  fullyLoaded: false
};
```

### Phase 2: Full Content (On Demand)

```typescript
// Load full content when agent is invoked
if (!skill.fullyLoaded) {
  skill.content = await parseSkillContent(skill.filePath);
  skill.fullyLoaded = true;
}
```

---

## JSON Schema Features

### VS Code Autocomplete Support

The `skills-config.json` schema enables:

- ✅ Field autocomplete in `crewx.yaml` and `agents.yaml`
- ✅ Inline validation and error highlighting
- ✅ Hover documentation for all fields
- ✅ Pattern validation (e.g., kebab-case for skill names)

### Schema Registration

Add to `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "packages/sdk/schema/skills-config.json": [
      "crewx.yaml",
      "agents.yaml",
      "templates/agents/*.yaml"
    ]
  }
}
```

---

## Integration Points

### Existing Systems

#### 1. Layout System Integration

Skills can reference layouts:

```yaml
agents:
  - id: "formatter"
    skills:
      include: ["code-formatter"]
    inline:
      layout:
        id: "crewx/default"
        props:
          skillMode: true
```

#### 2. Document System Integration

Skills can load documents:

```yaml
agents:
  - id: "helper"
    skills:
      include: ["user-guide"]
    inline:
      documents:
        guide: "{{{documents.user-guide.content}}}"
```

#### 3. Template Context Integration

Skill metadata available in templates:

```handlebars
{{#if skills.include}}
<enabled_skills>
  {{#each skills.include}}
  <skill>{{this}}</skill>
  {{/each}}
</enabled_skills>
{{/if}}
```

---

## Usage Examples

### Example 1: Basic Skill Integration

**Claude skill (`code-formatter.md`):**

```markdown
---
name: code-formatter
description: "Formats code in multiple languages"
version: "1.0.0"
dependencies: []
---

## Role
You are an expert code formatter.

## Task
Format code according to language standards.

## Instructions
1. Identify language
2. Apply formatting
3. Output formatted code
```

**CrewX agent:**

```yaml
agents:
  - id: "formatter_agent"
    provider: "cli/claude"
    skills:
      include: ["code-formatter"]
```

### Example 2: Skill Dependencies

```yaml
agents:
  - id: "advanced_dev"
    provider: "cli/claude"
    skills:
      include:
        - "git-commit-generator"  # Depends on code-analyzer
    inline:
      dependencies:
        - "code-analyzer@2.5.0"
```

### Example 3: Custom Skill Paths

```yaml
skillsPaths:
  - "./project-skills"
  - "../company-skills"
  - "~/.claude/skills"

agents:
  - id: "custom_agent"
    skills:
      autoload: false
      include:
        - "company-standard-formatter"
        - "security-checker"
```

---

## Error Handling Design

### Error Hierarchy

```typescript
// Base error
SkillLoadError
  ├─ SkillNotFoundError        // Skill file not found
  ├─ SkillDependencyError      // Missing dependencies
  └─ SkillVersionMismatchError // Version conflict
```

### Error Messages

```typescript
// Skill not found
throw new SkillNotFoundError(
  "code-formatter",
  ["./skills", "~/.claude/skills"]
);
// Error: Skill "code-formatter" not found in paths: ./skills, ~/.claude/skills

// Dependency error
throw new SkillDependencyError(
  "git-commit-generator",
  ["code-analyzer"]
);
// Error: Skill "git-commit-generator" missing dependencies: code-analyzer

// Version mismatch
throw new SkillVersionMismatchError(
  "code-analyzer",
  "2.5.0",
  "2.3.0"
);
// Error: Skill "code-analyzer" version mismatch. Required: 2.5.0, Found: 2.3.0
```

---

## Performance Considerations

### Caching Strategy

```typescript
interface SkillCache {
  metadata: Map<string, SkillMetadata>;      // Metadata cache
  content: Map<string, SkillContent>;         // Content cache
  resolutions: Map<string, SkillResolutionResult>; // Dependency cache
}
```

### Lazy Loading

- **Metadata**: Load on SDK initialization
- **Content**: Load on first agent invocation
- **Dependencies**: Resolve on demand

### Cache Invalidation

- File watcher on skill directories
- TTL-based cache expiration (configurable)
- Manual cache clear via CLI command

---

## Security Considerations

### Skill Source Validation

- Verify skill file permissions
- Validate YAML frontmatter syntax
- Sanitize markdown content
- Prevent directory traversal attacks

### Dependency Safety

- Version pinning required for production
- Dependency resolution limits (max depth: 10)
- Circular dependency detection

---

## Migration Path

### Phase 1 → Phase 2 Migration

**Current State (Phase 1):**
- ✅ Types defined
- ✅ Schema created
- ⬜ No runtime parsing yet

**Phase 2 Implementation Plan:**
1. Implement `parseSkillManifest()` function
2. Implement `parseCrewxConfig()` function
3. Add caching layer
4. Integrate with AgentLoaderService
5. Add CLI commands (`crewx skills ls`, `crewx skills validate`)

### Backward Compatibility

Existing `agents.yaml` files continue to work:

```yaml
# Old format (still works)
agents:
  - id: "old_agent"
    provider: "cli/claude"
    inline:
      system_prompt: "You are an assistant."

# New format (enhanced)
agents:
  - id: "new_agent"
    provider: "cli/claude"
    skills:
      include: ["code-formatter"]
    inline:
      system_prompt: "You are an assistant with formatting skills."
```

---

## Testing Strategy

### Unit Tests (Phase 2)

```typescript
describe('SkillParser', () => {
  it('parses valid skill frontmatter');
  it('validates skill metadata');
  it('handles missing required fields');
  it('resolves skill dependencies');
  it('detects circular dependencies');
  it('loads content on demand');
});
```

### Integration Tests (Phase 2)

```typescript
describe('CrewX Config Integration', () => {
  it('loads skills from multiple paths');
  it('merges project and agent skill configs');
  it('applies include/exclude filters');
  it('handles skill not found errors');
});
```

---

## Documentation Plan

### User Documentation

1. **Getting Started Guide**: Using Claude skills in CrewX
2. **Configuration Reference**: `skillsPaths`, `skills.include/exclude`
3. **Skill Development Guide**: Creating custom skills
4. **Migration Guide**: Adding skills to existing agents

### Developer Documentation

1. **API Reference**: SDK types and functions
2. **Parser Implementation**: How to extend skill parsing
3. **Plugin System**: Creating skill source plugins (future)

---

## Success Metrics

### Phase 1 (Design) - ✅ COMPLETE

- ✅ TypeScript types defined (15 interfaces)
- ✅ JSON Schema created (VS Code ready)
- ✅ Field mapping documented
- ✅ Design document completed
- ✅ Build passes without errors

### Phase 2 (Implementation) - Next Sprint

- ⬜ Parser functions implemented
- ⬜ Unit test coverage >90%
- ⬜ Integration tests pass
- ⬜ CLI integration complete
- ⬜ Documentation published

---

## Risks and Mitigation

### Risk 1: Claude Skills Spec Changes

**Impact**: High
**Probability**: Medium
**Mitigation**:
- Version schema with `$id` for compatibility tracking
- Feature flags for experimental fields
- Deprecation warnings for breaking changes

### Risk 2: Performance Degradation

**Impact**: Medium
**Probability**: Low
**Mitigation**:
- Lazy loading strategy
- Aggressive caching
- Performance benchmarks in CI

### Risk 3: Dependency Hell

**Impact**: High
**Probability**: Medium
**Mitigation**:
- Limit dependency depth (max: 10 levels)
- Circular dependency detection
- Version pinning in production

---

## Next Steps

### Immediate (Phase 1 Completion)

1. ✅ Update SDK exports to include new types
2. ✅ Update wbs.md to mark Phase 1 complete
3. ✅ Run `npm run build` to verify compilation

### Phase 2 Kickoff

1. Create parser implementation tickets
2. Set up test fixtures (sample skills)
3. Implement `parseSkillManifest()` function
4. Integrate with AgentLoaderService

---

## Appendix

### File Structure

```
packages/sdk/
├── src/
│   └── schema/
│       └── skills.types.ts        # ✅ TypeScript types
├── schema/
│   └── skills-config.json         # ✅ JSON Schema
└── tests/
    └── unit/
        └── skill-parser.spec.ts   # ⬜ Phase 2

wbs/
├── wbs-16-sdk-config-schema.md    # Phase overview
├── wbs-16-field-mapping.md        # ✅ Field mapping
└── wbs-16-phase-1-schema-design.md # ✅ This document
```

### References

- WBS-16 Overview: [wbs/wbs-16-sdk-config-schema.md](./wbs-16-sdk-config-schema.md)
- Field Mapping: [wbs/wbs-16-field-mapping.md](./wbs-16-field-mapping.md)
- Layout Types: [packages/sdk/src/types/layout.types.ts](../packages/sdk/src/types/layout.types.ts)
- Agent Types: [packages/sdk/src/types/agent.types.ts](../packages/sdk/src/types/agent.types.ts)
- Template Types: [packages/sdk/src/types/template.types.ts](../packages/sdk/src/types/template.types.ts)

---

**Phase 1 Status**: ✅ **COMPLETE**
**Next Phase**: WBS-16 Phase 2 - SDK Parser/Validator Implementation
