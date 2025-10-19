# Changesets

## Overview

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation in the monorepo.

## Workflow

### 1. Creating a Changeset

When you make changes that should be released, create a changeset:

```bash
npm run changeset
```

This will:
- Prompt you to select which packages changed
- Ask for the type of change (major, minor, patch)
- Request a summary of the changes

### 2. Versioning Packages

To bump versions based on changesets:

```bash
npm run version
```

This will:
- Update package versions according to changesets
- Update dependencies between workspace packages
- Generate/update CHANGELOG.md files
- Delete consumed changeset files

### 3. Publishing Packages

To publish packages to npm:

```bash
npm run release
```

This will:
- Build all packages
- Run tests
- Publish packages with updated versions to npm
- Push git tags

## Version Guidelines

### SDK (@sowonai/crewx-sdk)
- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, internal improvements

### CLI (@sowonai/crewx-cli & legacy `crewx`)
- **Major**: Breaking CLI interface changes
- **Minor**: New commands or options
- **Patch**: Bug fixes, performance improvements
- Changesets automatically keep `crewx` (wrapper) in sync with `@sowonai/crewx-cli`

## Examples

### Bug Fix in SDK
```bash
npm run changeset
# Select: @sowonai/crewx-sdk
# Type: patch
# Summary: "Fix conversation history serialization"
```

### New Feature in CLI
```bash
npm run changeset
# Select: @sowonai/crewx-cli
# Type: minor
# Summary: "Add --verbose flag to query command"
```

### Breaking Change in SDK
```bash
npm run changeset
# Select: @sowonai/crewx-sdk, @sowonai/crewx-cli
# SDK Type: major
# CLI Type: patch (or minor if new features added)
# Summary: "BREAKING: Rename AIProvider.respond() to AIProvider.chat()"
```

## CI/CD Integration

Changesets are integrated with GitHub Actions:
- PRs automatically get changeset status checks
- Merges to `develop` trigger version bumps
- Tags on `main` trigger npm publishes

## Manual Override

If you need to manually version without changesets:

```bash
cd packages/sdk
npm version patch  # or minor, major

cd packages/cli
npm version patch  # or minor, major

cd ../crewx
npm version patch  # keep in sync with @sowonai/crewx-cli
```

⚠️ This is NOT recommended as it bypasses changelog generation.
