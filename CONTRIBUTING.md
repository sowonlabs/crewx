# Contributing to CrewX

Thanks for taking the time to contribute! This guide walks you through the CrewX monorepo workflow so your changes land smoothly across the CLI and SDK packages.

## 📦 Project Overview
- **Packages**: `packages/sdk` (Apache-2.0 + CLA) and `packages/cli` (MIT)
- **Build tooling**: TypeScript, NestJS CLI, npm workspaces
- **Key docs**: [requirements-monorepo.md](requirements-monorepo.md), [BUILD.md](BUILD.md), [RELEASE.md](RELEASE.md)

Before you start, please read our [Code of Conduct](CODE_OF_CONDUCT.md) and sign the [Contributor License Agreement](docs/CLA.md).

## ✅ Prerequisites
- Node.js 20+
- npm 10+
- Git
- Familiarity with TypeScript and npm workspaces

## 🚀 Getting Started
```bash
# 1. Fork then clone
$ git clone https://github.com/<your-username>/crewx.git
$ cd crewx

# 2. Install dependencies (installs all workspaces)
$ npm install

# 3. Run the full build (SDK → CLI)
$ npm run build

# 4. Run tests (see more commands below)
$ npm test
```

### Workspace Shortcuts
```bash
# SDK only
npm run build:sdk
npm test --workspace @sowonai/crewx-sdk

# CLI only
npm run build:cli
npm test --workspace crewx
```

## 🔐 Contributor License Agreement (CLA)
- Every contributor must sign the CLA before a pull request can be merged.
- Individuals can sign directly in their first pull request by following the bot instructions.
- Corporate contributors should email a signed copy of `docs/CLA.md` to `legal@sowonlabs.com`.

## 🌱 Branch Strategy
| Change type | Branch prefix | Example |
|-------------|---------------|---------|
| Features / Enhancements | `feature/` | `feature/runtime-config` |
| Bug fixes | `bugfix/` | `bugfix/cli-thread-history` |
| Chores / Docs / Tooling | `chore/` | `chore/update-readme` |

Internal maintainers may use git worktrees for parallel bugfix branches, but external contributors can work with standard branches in their fork.

## ✍️ Commit Guidelines
We follow [Conventional Commits](https://www.conventionalcommits.org/) to keep changelog automation healthy.

```
<type>[optional scope]: <description>

feat(cli): add quickstart wizard
fix(sdk): guard undefined provider id
docs: clarify CLA flow
```

- Primary types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`.
- Use a scope (`cli`, `sdk`, `repo`, etc.) when the change targets a specific package.
- Keep descriptions under 72 characters.

## 🧪 Testing Checklist
Before submitting a PR:
1. `npm run build` (or the affected workspace builds)
2. Relevant unit/integration tests
   ```bash
   npm test --workspace @sowonai/crewx-sdk
   npm test --workspace crewx
   ```
3. Update or create tests when behaviour changes.
4. Run `npm run lint` if you touched TypeScript source.

## 🔄 Pull Request Expectations
Every PR should:
- Reference related issues or WBS items when applicable.
- Include a clear summary of changes and motivation.
- Note any cross-package impact (CLI ↔ SDK).
- Confirm the CLA status (first-time contributors).
- Pass CI (build + tests). Failing checks will block reviews.

Maintainers require at least **one approving review** before merging. Critical changes may need two reviews or sign-off from the package owner listed in `OWNERS.md` (coming soon).

## 🐛 Reporting Issues
Use the GitHub issue templates to help us triage:
- **Bug reports** – include reproduction steps, workspace (`cli`/`sdk`), version (`npm view crewx version`), and logs.
- **Feature requests** – describe the problem, proposal, alternatives, and expected impact.
- **Questions / Support** – pick the question template or use GitHub Discussions.

Please include whether the issue affects CLI usage, SDK APIs, or both.

## 📦 Release & Versioning Notes
- SDK uses semantic versioning (SemVer) starting at `0.1.x`.
- CLI is distributed under the `crewx` npm package and depends on the SDK via `workspace:*`.
- Breaking changes require documentation updates and deprecation notes.
- See [RELEASE.md](RELEASE.md) for changeset and publishing flow.

## 🔎 Review Criteria
Maintainers look for:
- Alignment with architecture goals from `requirements-monorepo.md`
- Backwards compatibility and migration guidance
- Tests validating new behaviour or guarding regressions
- Documentation updates for new public APIs or flags

## 📣 Communication
- GitHub Issues / PRs for all technical discussion
- Security disclosures via `security@sowonlabs.com`
- Community chat (coming soon) will follow the Code of Conduct

Thanks again for contributing to CrewX! 🚀
