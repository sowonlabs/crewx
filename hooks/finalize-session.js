#!/usr/bin/env node
/**
 * finalize-session.js - Stop hook for Claude Code
 *
 * Called when Claude Code completes its response. Used for:
 * - Finalizing tool call statistics
 * - Cleanup tasks
 * - Summary logging
 *
 * Environment Variables:
 *   - CREWX_TASK_ID: Current CrewX task ID for correlation
 *
 * Input (via stdin JSON):
 *   - session_id: Claude Code session ID
 *   - cwd: Current working directory
 *   - stop_reason: Reason for stopping (e.g., "end_turn", "max_tokens")
 *
 * Exit Codes:
 *   - 0: Success
 *   - Non-zero: Error (logged but doesn't affect Claude)
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
  const maxDepth = 10;

  for (let i = 0; i < maxDepth; i++) {
    const tracesPath = path.join(currentDir, '.crewx', 'traces.db');
    if (fs.existsSync(tracesPath)) {
      return tracesPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

// Finalize session - update tool call statistics for the task
async function finalizeSession(input) {
  const taskId = process.env.CREWX_TASK_ID;

  if (!taskId) {
    // No task ID means we're not in a CrewX session, silently skip
    console.error('[finalize-session] No CREWX_TASK_ID set, skipping finalization');
    return;
  }

  const sessionId = input.session_id || null;
  const cwd = input.cwd || process.cwd();
  const stopReason = input.stop_reason || 'unknown';

  // Find traces.db
  const tracesDbPath = findTracesDbPath(cwd);
  if (!tracesDbPath) {
    console.error('[finalize-session] Could not find .crewx/traces.db');
    return;
  }

  try {
    const Database = require('better-sqlite3');
    const db = new Database(tracesDbPath);

    // Check if tool_calls table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_calls'"
    ).get();

    if (!tableExists) {
      console.error('[finalize-session] tool_calls table does not exist');
      db.close();
      return;
    }

    // Get tool call statistics for this task
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        COUNT(DISTINCT tool_name) as unique_tools,
        GROUP_CONCAT(DISTINCT tool_name) as tools_used
      FROM tool_calls
      WHERE task_id = ?
    `).get(taskId);

    // Get per-tool breakdown
    const toolBreakdown = db.prepare(`
      SELECT tool_name, COUNT(*) as count
      FROM tool_calls
      WHERE task_id = ?
      GROUP BY tool_name
      ORDER BY count DESC
    `).all(taskId);

    db.close();

    // Log summary
    console.error(`[finalize-session] Task ${taskId} completed`);
    console.error(`  Stop reason: ${stopReason}`);
    console.error(`  Total tool calls: ${stats.total_calls}`);
    console.error(`  Unique tools used: ${stats.unique_tools}`);

    if (toolBreakdown.length > 0) {
      console.error('  Tool breakdown:');
      for (const tool of toolBreakdown) {
        console.error(`    - ${tool.tool_name}: ${tool.count}`);
      }
    }
  } catch (err) {
    console.error(`[finalize-session] Error finalizing session: ${err.message}`);
  }
}

// Main execution
async function main() {
  try {
    const input = await readStdin();
    await finalizeSession(input);
    process.exit(0);
  } catch (err) {
    console.error(`[finalize-session] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
