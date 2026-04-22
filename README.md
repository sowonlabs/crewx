# CrewX CLI

> Build AI agent teams from your terminal. Orchestrate Claude, Gemini, Copilot, and more with a single command.

[![npm version](https://img.shields.io/npm/v/crewx.svg)](https://www.npmjs.com/package/crewx)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Installation

```bash
npm install -g crewx
```

## Quick Start

```bash
# Ask an agent (read-only mode)
crewx q "@assistant What does my repo do?"

# Execute a task (with tools)
crewx x "@coder Add a dark mode toggle"

# List available agents
crewx agent list
```


## Core Commands

| Command | Purpose |
|---------|---------|
| `crewx q <prompt>` | Query mode — agent responds without side effects |
| `crewx x <prompt>` | Execute mode — agent can run tools (bash, file edits, etc.) |
| `crewx agent list\|prompt` | Manage and inspect agents |
| `crewx memory` | Long-term memory (BM25 search, topic drill-down) |
| `crewx search` | BM25 full-text search across your docs |
| `crewx doc` | Markdown TOC extraction and section reader |
| `crewx workflow` | Multi-agent workflow orchestration |
| `crewx wbs` | Work breakdown structure for complex tasks |

Run `crewx --help` for the full list.

## What is CrewX?

CrewX lets you define a team of AI agents in a single `crewx.yaml` file and call them from the terminal — each with their own persona, tools, and memory. Agents can delegate to each other, follow workflows, and maintain context across sessions.

This repository contains the **CrewX CLI** — a thin wrapper over the [`@crewx/sdk`](https://www.npmjs.com/package/@crewx/sdk) runtime, distributed via npm.

## License

The CLI source in this repository is licensed under [Apache-2.0](LICENSE).

The `@crewx/sdk` runtime is available on npm as a proprietary package.

## Links

- npm package: https://www.npmjs.com/package/crewx
- SDK package: https://www.npmjs.com/package/@crewx/sdk
- Issues: https://github.com/sowonlabs/crewx/issues
