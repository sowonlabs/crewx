#!/usr/bin/env node
/**
 * log-tool-use.js - PostToolUse hook for Claude Code
 *
 * Logs tool calls to CrewX traces.db for observability.
 * This hook is called after each successful tool execution in Claude Code.
 *
 * Environment Variables:
 *   - CREWX_TASK_ID: Current CrewX task ID for correlation
 *   - CLAUDE_FILE_PATHS: Space-separated list of affected file paths
 *
 * Input (via stdin JSON):
 *   - session_id: Claude Code session ID
 *   - tool_name: Name of the tool used (e.g., "Write", "Edit", "Bash")
 *   - tool_input: Tool-specific input parameters
 *   - tool_output: Tool execution result (if available)
 *
 * Exit Codes:
 *   - 0: Success
 *   - Non-zero: Error (logged but doesn't block Claude)
 */

const fs = require('fs');
const path = require('path');

// Read JSON from stdin
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON input: ${err.message}`));
      }
    });

    process.stdin.on('error', reject);

    // Set a timeout in case stdin hangs
    setTimeout(() => {
      if (!data) {
        resolve({});
      }
    }, 1000);
  });
}

// Find traces.db path - walks up from cwd looking for .crewx/traces.db
function findTracesDbPath(startDir) {
  let currentDir = startDir;
  const maxDepth = 10; // Prevent infinite loop

  for (let i = 0; i < maxDepth; i++) {
    const tracesPath = path.join(currentDir, '.crewx', 'traces.db');
    if (fs.existsSync(tracesPath)) {
      return tracesPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

// Log tool call using TracingService CLI helper (if available) or direct SQLite
async function logToolCall(input) {
  const taskId = process.env.CREWX_TASK_ID;
  const filePaths = process.env.CLAUDE_FILE_PATHS || '';

  if (!taskId) {
    // No task ID means we're not in a CrewX session, silently skip
    console.error('[log-tool-use] No CREWX_TASK_ID set, skipping log');
    return;
  }

  const toolName = input.tool_name || 'unknown';
  const toolInput = input.tool_input || {};
  const toolOutput = input.tool_output || null;
  const sessionId = input.session_id || null;
  const cwd = input.cwd || process.cwd();

  // Find traces.db
  const tracesDbPath = findTracesDbPath(cwd);
  if (!tracesDbPath) {
    console.error('[log-tool-use] Could not find .crewx/traces.db');
    return;
  }

  // Parse file paths from environment variable
  const files = filePaths.trim() ? filePaths.trim().split(' ').filter(Boolean) : [];

  // Also extract file path from tool input if available
  if (toolInput.file_path && !files.includes(toolInput.file_path)) {
    files.push(toolInput.file_path);
  }

  try {
    // Use better-sqlite3 directly for logging
    // Note: In production, this should use the TracingService CLI helper
    const Database = require('better-sqlite3');
    const db = new Database(tracesDbPath);

    // Ensure tool_calls table exists (will be created by TracingService migration)
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_calls'"
    ).get();

    if (!tableExists) {
      console.error('[log-tool-use] tool_calls table does not exist yet');
      db.close();
      return;
    }

    // Insert tool call record
    const stmt = db.prepare(`
      INSERT INTO tool_calls (
        id, task_id, session_id, tool_name, files, input, output, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const id = generateUUID();
    const timestamp = new Date().toISOString();

    stmt.run(
      id,
      taskId,
      sessionId,
      toolName,
      JSON.stringify(files),
      JSON.stringify(toolInput),
      toolOutput ? JSON.stringify(toolOutput) : null,
      timestamp
    );

    db.close();

    console.error(`[log-tool-use] Logged tool call: ${toolName} (task: ${taskId})`);
  } catch (err) {
    console.error(`[log-tool-use] Error logging tool call: ${err.message}`);
  }
}

// Generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Main execution
async function main() {
  try {
    const input = await readStdin();
    await logToolCall(input);
    process.exit(0);
  } catch (err) {
    console.error(`[log-tool-use] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
