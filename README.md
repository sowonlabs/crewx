# CrewX CLI

> Build AI agent teams from your terminal.

[![npm version](https://img.shields.io/npm/v/@crewx/cli.svg)](https://www.npmjs.com/package/@crewx/cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Installation

```bash
npm install -g @crewx/cli
```

## Quick Start

```bash
crewx q "@assistant hello"
crewx x "@coder implement feature X"
crewx agent list
```

Run `crewx --help` for the full list.

## What is CrewX?

CrewX lets you define AI agents in a single `crewx.yaml` and call them from the terminal.

This repository contains the **CrewX CLI** — a thin wrapper over the [`@crewx/sdk`](https://www.npmjs.com/package/@crewx/sdk) runtime (distributed via npm).

## License

CLI source: [Apache-2.0](LICENSE).
`@crewx/sdk` runtime: proprietary on npm.
