# Release Management Guide

## Overview

CrewX monorepo uses Changesets for automated version management and releases. This document describes the release process, versioning strategy, and best practices.

## Release Process

### 1. Development Phase

During development, create changesets for changes that should be released:

```bash
# After implementing a feature or bug fix
npm run changeset

# Follow the prompts:
# - Select affected packages (SDK, CLI, or both)
# - Choose version bump type (major, minor, patch)
# - Write a clear, user-facing summary
```

### 2. Version Bump Phase

When ready to release, version the packages:

```bash
# This command will:
# - Read all pending changesets
# - Update package.json versions
# - Generate/update CHANGELOG.md
# - Update workspace dependencies
npm run version

# Review the changes
git diff

# Commit the version changes
git add .
git commit -m "chore: version packages"
```

### 3. Publishing Phase

Publish packages to npm:

```bash
# Pre-flight checks
npm run build
npm run test

# Publish to npm (requires npm authentication)
npm run release

# This will:
# - Build all packages
# - Run tests
# - Publish updated packages to npm
# - Tag the release in git
```

### 4. Post-Release

After successful release:

```bash
# Push changes and tags
git push origin develop --tags

# Merge to main if stable
git checkout main
git merge develop
git push origin main
```

## Versioning Strategy

### Semantic Versioning (SemVer)

Both SDK and CLI follow semantic versioning: `MAJOR.MINOR.PATCH`

#### SDK (@sowonai/crewx-sdk)

**MAJOR** - Breaking changes
- Removed or renamed public APIs
- Changed function signatures
- Changed behavior that breaks existing code

Examples:
```
- Renamed AIProvider.respond() → AIProvider.chat()
- Removed deprecated ConversationManager.legacy()
- Changed return type of DocumentManager.load()
```

**MINOR** - New features (backward compatible)
- New public APIs
- New optional parameters
- New provider implementations

Examples:
```
- Added ContextEnhancementService
- Added optional timeout parameter to AIProvider
- Added GeminiProvider
```

**PATCH** - Bug fixes and internal changes
- Bug fixes
- Performance improvements
- Internal refactoring
- Documentation updates

Examples:
```
- Fixed conversation history serialization
- Improved error handling
- Updated type definitions
```

#### CLI (crewx)

**MAJOR** - Breaking CLI changes
- Removed commands or flags
- Changed command behavior incompatibly
- Changed output format breaking scripts

Examples:
```
- Removed deprecated --old-flag
- Changed crewx query JSON output structure
- Renamed command: crewx chat → crewx converse
```

**MINOR** - New features
- New commands
- New flags (with defaults)
- Enhanced output (backward compatible)

Examples:
```
- Added crewx doctor command
- Added --verbose flag to existing commands
- Added JSON output option
```

**PATCH** - Bug fixes
- Bug fixes
- Performance improvements
- Help text updates

Examples:
```
- Fixed MCP connection error
- Improved error messages
- Updated command examples
```

### Package Coordination

When changes span both packages:

1. **SDK breaking + CLI update required**: Bump SDK major, CLI major/minor
2. **SDK feature + CLI support**: Bump SDK minor, CLI minor
3. **Independent fixes**: Bump affected package only

Example changeset for coordinated release:
```bash
npm run changeset

# Select: @sowonai/crewx-sdk, crewx
# @sowonai/crewx-sdk: major
# crewx: major
# Summary: "BREAKING: Rename AIProvider.respond() to .chat(). Update CLI to use new API."
```

## Release Cadence

### Regular Releases

- **Patch releases**: As needed (bug fixes)
- **Minor releases**: Every 2-4 weeks (features)
- **Major releases**: Quarterly or as needed (breaking changes)

### Hotfix Releases

For critical bugs in production:

```bash
# Create hotfix branch from main
git checkout -b hotfix/critical-bug main

# Fix the bug
# ...

# Create changeset
npm run changeset
# Select: affected package
# Type: patch
# Summary: "Hotfix: [description]"

# Version and release
npm run version
git commit -m "chore: hotfix version"
npm run release

# Merge back to main and develop
git checkout main
git merge hotfix/critical-bug
git push origin main --tags

git checkout develop
git merge main
git push origin develop
```

### Pre-releases (Beta/Alpha)

For testing before stable release:

```bash
# Enter pre-release mode
npx changeset pre enter beta

# Add changesets as normal
npm run changeset

# Version as pre-release
npm run version
# This creates versions like 1.2.0-beta.0

# Publish with beta tag
npm run release -- --tag beta

# Exit pre-release mode when ready
npx changeset pre exit
```

## CI/CD Integration

### Automated Workflows

**Pull Requests** (`.github/workflows/ci.yml`)
- ✅ Build validation
- ✅ Test execution
- ✅ Changeset check (warning if missing)

**Main Branch** (`.github/workflows/release.yml`)
- ✅ Automatic versioning
- ✅ npm publishing
- ✅ GitHub release creation

**Nightly** (`.github/workflows/nightly.yml`)
- ✅ Full test suite
- ✅ Smoke tests
- ✅ Failure notifications

### GitHub Actions Secrets

Required secrets for automated releases:

```
NPM_TOKEN        - npm authentication token
GITHUB_TOKEN     - (automatically provided)
CODECOV_TOKEN    - Code coverage reporting (optional)
```

To set up NPM_TOKEN:

1. Login to npmjs.com
2. Go to Access Tokens
3. Generate new token (Automation type)
4. Add to GitHub repo secrets

## Manual Release Checklist

For manual releases without CI/CD:

- [ ] All tests passing (`npm run test`)
- [ ] All packages build successfully (`npm run build`)
- [ ] Changesets created for all changes
- [ ] Version bumps reviewed (`npm run version`)
- [ ] CHANGELOG.md updated correctly
- [ ] Dependencies between packages correct
- [ ] README.md up to date
- [ ] npm authentication configured
- [ ] Release notes prepared
- [ ] Publish packages (`npm run release`)
- [ ] Verify on npmjs.com
- [ ] Push tags to GitHub
- [ ] Create GitHub release
- [ ] Announce in community channels

## Troubleshooting

### Failed npm Publish

```bash
# Check npm authentication
npm whoami

# Re-login if needed
npm login

# Verify package.json publishConfig
cat packages/sdk/package.json | grep publishConfig
cat packages/cli/package.json | grep publishConfig

# Retry publish
cd packages/sdk && npm publish
cd packages/cli && npm publish
```

### Version Conflicts

```bash
# If versions are out of sync
npm run clean
npm ci
npm run build

# Re-run version
npm run version
```

### Changesets Not Found

```bash
# List existing changesets
ls -la .changeset/

# Create a new changeset if missing
npm run changeset
```

### Rollback a Release

```bash
# Deprecate bad version on npm
npm deprecate @sowonai/crewx-sdk@1.2.3 "Version 1.2.3 has critical bugs, use 1.2.4"
npm deprecate crewx@0.4.0 "Version 0.4.0 has critical bugs, use 0.4.1"

# Publish fixed version
npm run changeset  # Create patch changeset
npm run version
npm run release

# Do NOT unpublish (npm policy: can't unpublish after 24h)
```

## Version History

### SDK (@sowonai/crewx-sdk)

- **0.1.0** - Initial SDK extraction from monorepo
- (Future versions tracked in packages/sdk/CHANGELOG.md)

### CLI (crewx)

- **0.3.0** - Current monorepo version
- **0.2.x** - Legacy single-package versions
- (Future versions tracked in packages/cli/CHANGELOG.md)

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions](https://docs.github.com/en/actions)

## Support

For release-related questions:
- Check GitHub Actions logs
- Review changeset documentation
- Open an issue on GitHub
- Contact maintainers
