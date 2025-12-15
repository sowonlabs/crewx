# CrewX Project Structure

> Bring Your Own AI(BYOA) team in Slack/IDE(MCP) with your existing subscriptions

---

## 📦 Packages

### [@sowonai/crewx-cli](packages/cli/CREWX.md)
NestJS-based CLI & MCP application
- CLI commands (query, execute, chat, agent, doctor, init, templates, mcp)
- Layout-driven prompt pipeline (WBS-13~15) with secure `<user_query>` wrappers
- TemplateContext + AgentMetadata integration, feature flag `CREWX_APPEND_LEGACY`
- Slack bot + MCP server surfaces (VS Code, Claude Desktop, Cursor)
- Dynamic provider loading (plugin/remote namespaces) with JSON Schema validation (WBS-16)

### [@sowonai/crewx-sdk](packages/sdk/CREWX.md)
Shared SDK & type system
- TemplateContext & AgentMetadata exports (WBS-14)
- LayoutLoader/LayoutRenderer/PropsValidator for prompt layouts (WBS-11~13)
- SkillRuntime architecture + progressive disclosure loader (WBS-17 Phase 1)
- Configuration + conversation management utilities
- Provider interfaces, dynamic provider schema, remote agent helpers (WBS-16)

## 🚀 Recent Highlights

- **WBS-13/14/15**: CLI now renders prompts through SDK layouts, with TemplateContext + secure `<user_query>` handling documented in `packages/cli/src/CREWX.md`.
- **WBS-16**: crewx.yaml/skills schema consolidated; config validator enforces JSON Schema in CLI.
- **WBS-17 Phase 1**: SkillRuntime + progressive loader landed in the SDK; CLI wiring pending future phases.

---

## 🗂️ Directory Structure

```
crewx/
├── packages/
│   ├── cli/                # @sowonai/crewx-cli
│   ├── sdk/                # @sowonai/crewx-sdk
│   └── crewx/              # npm distribution package (wrapper)
├── docs/                   # Documentation
├── templates/              # Project templates
├── scripts/                # Build & automation
├── wbs/                    # Work breakdown schedules
└── worktree/               # Git worktrees (parallel development)
```

---

## 🚨 Release Branch Workflow

During active release cycles, **work on the release branch directly** (not develop).

```bash
# Check current branch
git branch --show-current
# Expected: release/X.X.X (during release cycle)

# Feature branches created FROM release branch
git checkout -b feature/42-fix-bug
```

See [docs/process/development-workflow.md](docs/process/development-workflow.md) for details.

## 🧪 Development

```bash
# Build
npm run build              # All packages
npm run build:cli          # CLI only
npm run build:sdk          # SDK only

# Test
npm test                   # All packages
npm run test:cli           # CLI only
npm run test:sdk           # SDK only
npm run test:coverage      # Coverage report

# Run
npm run dev:cli            # CLI dev mode
```

---

## 📚 Learn More

- 🔗 [packages/cli/CREWX.md](packages/cli/CREWX.md) - CLI package
- 🔗 [packages/sdk/CREWX.md](packages/sdk/CREWX.md) - SDK package

---

**Last Updated**: 2025-10-20
