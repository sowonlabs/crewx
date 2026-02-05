# CrewX Claude Code Hooks

This directory contains hooks for Claude Code that integrate with CrewX's observability system.

## Overview

These hooks are automatically installed when you run `crewx init`. They enable detailed tracking of Claude Code tool usage during CrewX task execution.

## Hooks

### log-tool-use.js (PostToolUse)

Logs tool calls to CrewX's traces.db after each successful tool execution.

**Features:**
- Records tool name, input parameters, and affected files
- Correlates tool calls with CrewX task ID
- Stores data in the `tool_calls` table

**Environment Variables:**
- `CREWX_TASK_ID`: Required - The current CrewX task ID for correlation

### validate-tool-use.js (PreToolUse)

Validates tool calls before execution to enforce project policies.

**Features:**
- Blocks access to protected files (`.env`, credentials, etc.)
- Prevents dangerous bash commands (fork bombs, disk wiping, etc.)
- Detects path traversal attempts

**Exit Codes:**
- `0`: Allow tool execution
- `2`: Block tool execution (stderr shown to Claude)

### finalize-session.js (Stop)

Called when Claude Code completes its response. Summarizes tool usage.

**Features:**
- Logs tool call statistics for the session
- Reports unique tools used and call counts

## Installation

Hooks are installed by `crewx init` which updates `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/crewx/hooks/log-tool-use.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/crewx/hooks/validate-tool-use.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/crewx/hooks/finalize-session.js"
          }
        ]
      }
    ]
  }
}
```

## Manual Testing

```bash
# Test log-tool-use.js
echo '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.txt"}}' | \
  CREWX_TASK_ID=test-task node hooks/log-tool-use.js

# Test validate-tool-use.js (should allow)
echo '{"tool_name": "Write", "tool_input": {"file_path": "/tmp/test.txt"}}' | \
  node hooks/validate-tool-use.js

# Test validate-tool-use.js (should block)
echo '{"tool_name": "Write", "tool_input": {"file_path": ".env"}}' | \
  node hooks/validate-tool-use.js

# Test finalize-session.js
echo '{"session_id": "test", "stop_reason": "end_turn"}' | \
  CREWX_TASK_ID=test-task node hooks/finalize-session.js
```

## Database Schema

Tool calls are stored in `.crewx/traces.db`:

```sql
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  session_id TEXT,
  tool_name TEXT NOT NULL,
  files TEXT,          -- JSON array of file paths
  input TEXT,          -- JSON object of tool input
  output TEXT,         -- JSON object of tool output
  duration_ms INTEGER,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [CrewX Tracing Service](../packages/cli/src/services/tracing.service.ts)
