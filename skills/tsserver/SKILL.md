---
name: tsserver
description: TypeScript/JavaScript code analysis tool. Provides IDE-level code intelligence including symbol search, go to definition, find references, type information, and more.
version: 0.3.0
---

# tsserver Skill

Directly calls tsserver (used internally by VSCode) from the CLI to analyze TypeScript/JavaScript code.

## Installation

```bash
cd skills/tsserver
npm install
```

- Node.js 16+
- `tsconfig.json` recommended

## Already Using VSCode/Cursor?

You're already using the same features in your IDE:

| This Skill Command | VSCode/Cursor Shortcut |
|-------------------|------------------------|
| `find` | `Cmd+T` (Go to Symbol in Workspace) |
| `definition` | `F12` or `Cmd+Click` |
| `references` | `Shift+F12` |
| `symbols` | `Cmd+Shift+O` (Outline) |
| `quickinfo` | Mouse hover |
| `diagnostics` | Problems panel (`Cmd+Shift+M`) |

**When this skill is useful:**
- When AI agents analyze code (CLI environment)
- When automating with scripts
- When working in terminal without an IDE

## Core Principle

```
VSCode/Cursor  ──────►  tsserver  ◄──────  This Skill (CLI)
                            │
                      JSON Protocol
                      (stdin/stdout)
```

> Both VSCode and Cursor use tsserver internally.
> This skill directly calls the same tsserver from CLI.

## Recommended Commands (Search by Symbol Name)

No need to know line/column!

```bash
# Search symbol across entire project
node skills/tsserver/tsserver.js find <symbol>

# Get type info for symbol in file
node skills/tsserver/tsserver.js info <file> <symbol>

# File structure (list all symbols)
node skills/tsserver/tsserver.js symbols <file>
```

### Examples

```bash
# Find BaseAIProvider class
$ node skills/tsserver/tsserver.js find BaseAIProvider
{
  "found": true,
  "count": 3,
  "symbols": [
    { "name": "BaseAIProvider", "kind": "class", "file": ".../base-ai.provider.ts", "line": 32 },
    { "name": "BaseAIProvider", "kind": "alias", "file": ".../index.ts", "line": 1 }
  ]
}

# Get type info for ClaudeProvider in specific file
$ node skills/tsserver/tsserver.js info src/providers/claude.ts ClaudeProvider
{
  "found": true,
  "symbol": "ClaudeProvider",
  "location": { "file": "...", "line": 5, "column": 14 },
  "typeInfo": {
    "kind": "class",
    "displayString": "class ClaudeProvider"
  }
}
```

## Line/Column Based Commands

Use when you know the exact position:

```bash
# Go to Definition
node skills/tsserver/tsserver.js definition <file> <line> <column>

# Find All References
node skills/tsserver/tsserver.js references <file> <line> <column>

# Type Information (Hover)
node skills/tsserver/tsserver.js quickinfo <file> <line> <column>

# Go to Type Definition
node skills/tsserver/tsserver.js typeDefinition <file> <line> <column>

# Go to Implementation (interface → class)
node skills/tsserver/tsserver.js implementation <file> <line> <column>
```

## File-Level Commands

```bash
# All symbols in file (Outline)
node skills/tsserver/tsserver.js symbols <file>

# Error/Warning diagnostics
node skills/tsserver/tsserver.js diagnostics <file>
```

## Code Analysis Workflow

```
1. find <symbol>     → Find symbol location in project
2. info <file> <sym> → Check type info in that file
3. symbols <file>    → Understand file structure
4. references ...    → Track usage (requires line/column)
```

## Supported Commands (ts.server.protocol.CommandTypes)

| Command | VSCode Equivalent | line/col Required |
|---------|-------------------|-------------------|
| `find` | Ctrl+T (Go to Symbol) | No |
| `info` | Mouse hover | No |
| `symbols` | Outline panel | No |
| `definition` | F12 | Yes |
| `references` | Shift+F12 | Yes |
| `quickinfo` | Hover | Yes |
| `implementation` | Ctrl+F12 | Yes |
| `diagnostics` | Problems panel | No |

## Limitations

1. **TypeScript/JavaScript only**
2. **Monorepo**: `find` searches only within one tsconfig scope (SDK ↔ CLI separate)
3. **Startup time**: ~500ms (tsserver initialization)

## Related Documentation

- [tsserver Wiki](https://github.com/microsoft/TypeScript/wiki/Standalone-Server-(tsserver))
- [tsserver-example](https://github.com/mmorearty/tsserver-example)
