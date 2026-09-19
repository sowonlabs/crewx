# CrewX

> Bring Your Own AI (BYOA) team — in your terminal or as a Windows desktop app.

[![npm version](https://img.shields.io/npm/v/@crewx/cli.svg)](https://www.npmjs.com/package/@crewx/cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

CrewX lets you define AI agents in a single `crewx.yaml` and run them as a team — planning, writing, reviewing, and remembering context across sessions.

## Download

**[Download CrewX for Windows →](https://www.crewx.dev/download)**

- Windows x64 installer, with in-app auto-update.
- macOS: in progress — not yet available.
- Prefer the terminal? Use the CLI below instead of the desktop app.

## CLI

```bash
npm install -g @crewx/cli
```

```bash
crewx q "@assistant hello"
crewx x "@coder implement feature X"
crewx agent list
```

Run `crewx --help` for the full command list.

## Help

- Docs & guides: https://www.crewx.dev/docs/intro
- Release notes: https://github.com/sowonlabs/crewx/releases

## Issues

Found a bug or have a feature request? **[Open an issue](https://github.com/sowonlabs/crewx/issues/new/choose)**.

This is a **public** issue tracker. Please don't paste API keys, tokens, or private conversation content into a report — only the version, OS, and steps needed to reproduce.

## Source & license

- **This repository** (`src/`, CLI source) is a public snapshot released under [Apache-2.0](LICENSE). It tracks the CLI, not every internal commit in real time.
- **`@crewx/sdk`**, the runtime the CLI wraps, is proprietary and distributed only via npm — its source is not in this repository.
- **CrewX Desktop** (the Windows app you download above) is also proprietary source and is not in this repository. Each GitHub Release's auto-generated "Source code (zip)" is a snapshot of this CLI repo only — it is **not** the Desktop app's source.

Apache-2.0 above covers the CLI source in this repository only; it does not extend to the SDK or the Desktop app.
