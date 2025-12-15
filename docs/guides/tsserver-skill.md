# TypeScript Code Intelligence with tsserver Skill

The tsserver skill provides semantic code intelligence for TypeScript/JavaScript projects. It offers significant advantages over plain text search (grep) by understanding the code's structure and type system.

## When to Use tsserver vs grep

| Task | Command | Advantages over grep |
|------|---------|---------------------|
| Find symbol | `node skills/tsserver/tsserver.js find <symbol>` | Type-aware, finds all related symbols |
| Get type info | `node skills/tsserver/tsserver.js info <file> <symbol>` | Accurate type information |
| File structure | `node skills/tsserver/tsserver.js symbols <file>` | Outline view with symbol hierarchy |

## Commands

### Find Symbol
Find all occurrences of a symbol across the codebase with type awareness:
```bash
node skills/tsserver/tsserver.js find <symbol>
```

**Example:**
```bash
node skills/tsserver/tsserver.js find AIProvider
```

This will find:
- Class/interface definitions
- Type aliases
- All references with their types
- Import/export locations

### Get Type Information
Get detailed type information for a specific symbol in a file:
```bash
node skills/tsserver/tsserver.js info <file> <symbol>
```

**Example:**
```bash
node skills/tsserver/tsserver.js info packages/cli/src/ai-provider.service.ts executeAgent
```

Returns:
- Full type signature
- JSDoc documentation
- Parameter types
- Return type

### List File Symbols
Get an outline view of all symbols in a file:
```bash
node skills/tsserver/tsserver.js symbols <file>
```

**Example:**
```bash
node skills/tsserver/tsserver.js symbols packages/cli/src/crewx.tool.ts
```

Returns hierarchical structure:
- Classes, interfaces, types
- Functions and methods
- Variables and constants
- Nested members

## Recommended Workflow

For effective TypeScript code analysis:

1. **Find symbol locations** → Use `tsserver find`
   - Start here to locate definitions and references

2. **Get detailed type info** → Use `tsserver info`
   - Understand the exact type signature

3. **Text/pattern search** → Use grep (still useful for)
   - Searching for comments
   - Finding string literals
   - Pattern matching across non-TypeScript files

## Why tsserver is Better for Code Analysis

1. **Type-aware**: Understands TypeScript's type system
2. **Semantic**: Knows the difference between same-named symbols in different scopes
3. **Accurate**: Follows imports and type inference correctly
4. **Complete**: Finds all references including implicit ones
5. **Structured**: Provides hierarchical symbol information

## Example Session

```bash
# 1. Find where AIProvider is defined and used
node skills/tsserver/tsserver.js find AIProvider

# 2. Get type info for a specific method
node skills/tsserver/tsserver.js info src/ai-provider.service.ts processAgentSystemPrompt

# 3. See all exports from a file
node skills/tsserver/tsserver.js symbols src/index.ts

# 4. Fall back to grep for string search
grep -r "TODO:" packages/cli/src/
```
