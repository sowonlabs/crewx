# Monorepo Migration Guide

This guide helps you migrate from the legacy CrewX single-package structure to the new monorepo architecture.

## Overview

SowonAI CrewX has been restructured into a monorepo with two packages:

- **`@sowonai/crewx-sdk`** (Apache-2.0): Core SDK for building custom AI integrations
- **`crewx`** (MIT): Full-featured CLI tool for immediate use

## For End Users (CLI Users)

### No Changes Required

If you're using CrewX CLI via `npm install -g crewx`, nothing changes:

```bash
# Same installation
npm install -g crewx

# Same usage
crewx query "@claude analyze code"
crewx execute "@gemini implement feature"
```

All existing commands, configuration files, and workflows remain compatible.

### Configuration Files

Your existing `crewx.yaml` or `agents.yaml` files work without modification:

```yaml
# This still works
agents:
  - id: "my_agent"
    provider: "cli/claude"
    # ... rest of config
```

## For SDK Users

### Before (Legacy)

```typescript
// ❌ Old way (no longer available)
import { AIProvider } from 'crewx';
```

### After (Monorepo)

```typescript
// ✅ New way
import { AIProvider } from '@sowonai/crewx-sdk';
```

### Installation

```bash
# Remove old package (if installed)
npm uninstall crewx

# Install new SDK
npm install @sowonai/crewx-sdk

# Peer dependencies (if using NestJS)
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

### Import Changes

Update your imports:

```typescript
// Before
import { AIProvider, AgentConfig } from 'crewx';

// After
import { AIProvider, AgentConfig } from '@sowonai/crewx-sdk';
```

### Breaking Changes

#### 1. Package Name

- **Old**: `crewx` (mixed CLI and SDK)
- **New**: `@sowonai/crewx-sdk` (pure SDK)

#### 2. No CLI in SDK

The SDK no longer includes CLI functionality. For CLI features, use the `crewx` package:

```typescript
// ❌ Won't work with SDK
import { CLIHandler } from '@sowonai/crewx-sdk'; // No longer available

// ✅ Use CLI package instead
npm install -g crewx
// Then use: crewx query/execute
```

#### 3. Export Structure

Some internal exports have been moved to `@sowonai/crewx-sdk/internal`:

```typescript
// Public API (stable)
import { AIProvider } from '@sowonai/crewx-sdk';

// Internal API (may change)
import { InternalUtil } from '@sowonai/crewx-sdk/internal';
```

### API Compatibility

Most SDK APIs remain unchanged:

| Feature | Legacy | Monorepo | Status |
|---------|--------|----------|--------|
| AIProvider | ✅ | ✅ | Compatible |
| AgentConfig | ✅ | ✅ | Compatible |
| MentionParser | ✅ | ✅ | Compatible |
| DocumentManager | ✅ | ✅ | Compatible |
| ConversationHistory | ✅ | ✅ | Compatible |
| TimeoutConfig | ✅ | ✅ | Compatible |

## For Contributors

### Development Setup

```bash
# Clone repository
git clone https://github.com/sowonlabs/crewx.git
cd crewx

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Package-Specific Commands

```bash
# Build specific package
npm run build --workspace @sowonai/crewx-sdk
npm run build --workspace crewx

# Test specific package
npm test --workspace @sowonai/crewx-sdk
npm test --workspace crewx

# Watch mode
npm run test:watch --workspace @sowonai/crewx-sdk
```

### Directory Structure

```
crewx/
├── packages/
│   ├── sdk/              # @sowonai/crewx-sdk
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── README.md
│   └── cli/              # crewx
│       ├── src/
│       ├── tests/
│       ├── package.json
│       └── README.md
├── docs/                 # Shared documentation
├── package.json          # Root workspace config
└── README.md             # Main README
```

### Working with Workspaces

```bash
# Add dependency to SDK
npm install some-package --workspace @sowonai/crewx-sdk

# Add dependency to CLI
npm install some-package --workspace crewx

# Add dev dependency to root
npm install -D some-tool
```

### Building & Testing

```bash
# Build order (SDK first, then CLI)
npm run build --workspace @sowonai/crewx-sdk
npm run build --workspace crewx

# Or build all at once
npm run build --workspaces

# Run all tests
npm test --workspaces
```

### Publishing

Packages are published independently:

```bash
# Publish SDK
cd packages/sdk
npm publish

# Publish CLI
cd packages/cli
npm publish
```

See [BUILD.md](../BUILD.md) for detailed release process.

## Migration Checklist

### For SDK Users

- [ ] Update `package.json` to use `@sowonai/crewx-sdk` instead of `crewx`
- [ ] Update imports from `crewx` to `@sowonai/crewx-sdk`
- [ ] Install peer dependencies if using NestJS
- [ ] Test your application
- [ ] Update documentation

### For CLI Users

- [ ] No changes required!
- [ ] Verify `crewx` commands still work
- [ ] Check `crewx.yaml` is still valid

### For Contributors

- [ ] Clone new monorepo structure
- [ ] Run `npm install` at root
- [ ] Build packages: `npm run build --workspaces`
- [ ] Run tests: `npm test --workspaces`
- [ ] Read [Contributing Guide](../CONTRIBUTING.md)

## FAQ

### Why the monorepo?

1. **Clear separation**: SDK vs CLI are distinct packages
2. **Better licensing**: Apache-2.0 for SDK, MIT for CLI
3. **Easier maintenance**: Shared tooling, single repo
4. **Better DX**: Type-safe workspace dependencies

### Will legacy version be maintained?

No. Please migrate to the monorepo version. The last legacy version is `0.2.x`.

### Can I use both old and new?

No. They use different package names and may conflict. Choose one:

- **End users**: Use `crewx` CLI (globally installed)
- **Developers**: Use `@sowonai/crewx-sdk` for custom integrations

### What about version numbers?

- **SDK**: Starts at `0.1.0` (new package)
- **CLI**: Continues from `0.3.0+` (maintains version continuity)

### Do I need both packages?

**Most users only need one:**

- **CLI only**: `npm install -g crewx`
- **SDK only**: `npm install @sowonai/crewx-sdk`

**Both** (rare, for custom CLI tools):
```bash
npm install -g crewx
npm install @sowonai/crewx-sdk
```

## Support

- [GitHub Issues](https://github.com/sowonlabs/crewx/issues)
- [Documentation](../docs/)
- [Main README](../README.md)

## Related Guides

- [SDK README](../packages/sdk/README.md) - SDK API reference
- [CLI README](../packages/cli/README.md) - CLI usage guide
- [Build Guide](../BUILD.md) - Building and releasing
- [Contributing Guide](../CONTRIBUTING.md) - Contributing guidelines

---

**Migration questions?** Open an issue on [GitHub](https://github.com/sowonlabs/crewx/issues).
