#!/usr/bin/env node
/**
 * validate-tool-use.js - PreToolUse hook for Claude Code
 *
 * Validates tool calls before execution. Can be used to:
 * - Block certain tools in specific directories
 * - Require confirmation for dangerous operations
 * - Enforce project-specific policies
 *
 * Environment Variables:
 *   - CREWX_TASK_ID: Current CrewX task ID for correlation
 *   - CLAUDE_FILE_PATHS: Space-separated list of affected file paths
 *
 * Input (via stdin JSON):
 *   - session_id: Claude Code session ID
 *   - tool_name: Name of the tool to be used (e.g., "Write", "Edit", "Bash")
 *   - tool_input: Tool-specific input parameters
 *   - cwd: Current working directory
 *
 * Exit Codes:
 *   - 0: Allow tool execution
 *   - 2: Block tool execution (stderr shown to Claude)
 *   - Other: Error (logged, operation continues)
 *
 * Output (JSON to stdout, optional):
 *   - For PreToolUse, can output JSON to modify the tool input
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

// Protected patterns - files/directories that should not be modified
const PROTECTED_PATTERNS = [
  // Environment and secrets
  /\.env$/i,
  /\.env\.[^.]+$/i,
  /credentials\.json$/i,
  /secrets?\.(json|yaml|yml)$/i,
  /\.pem$/i,
  /\.key$/i,

  // Git internals
  /\.git\//,
  /\.git$/,

  // Package lock files (usually shouldn't be manually edited)
  // Note: Uncomment if you want to protect these
  // /package-lock\.json$/i,
  // /yarn\.lock$/i,
  // /pnpm-lock\.yaml$/i,
];

// Dangerous bash patterns
const DANGEROUS_BASH_PATTERNS = [
  /rm\s+-rf\s+\/(?!tmp|var\/tmp)/i,  // rm -rf / (but allow /tmp)
  /:\(\)\s*\{\s*:\|\:\s*&\s*\}\s*;:\s*/,  // Fork bomb
  />\s*\/dev\/sd[a-z]/i,  // Direct disk write
  /mkfs\s+/i,  // Filesystem formatting
  /dd\s+.*of=\/dev\/sd/i,  // Direct disk dd
];

// Validate tool input
function validateToolUse(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  const cwd = input.cwd || process.cwd();

  // Validate file-based tools (Write, Edit, Read)
  if (['Write', 'Edit', 'Read'].includes(toolName)) {
    const filePath = toolInput.file_path || '';

    // Check against protected patterns
    for (const pattern of PROTECTED_PATTERNS) {
      if (pattern.test(filePath)) {
        return {
          allowed: false,
          reason: `Protected file pattern: ${filePath} matches ${pattern}`,
        };
      }
    }

    // Check if file is outside project directory (potential path traversal)
    if (filePath.includes('..')) {
      const resolvedPath = path.resolve(cwd, filePath);
      if (!resolvedPath.startsWith(cwd)) {
        return {
          allowed: false,
          reason: `Path traversal detected: ${filePath} resolves outside project directory`,
        };
      }
    }
  }

  // Validate Bash tool
  if (toolName === 'Bash') {
    const command = toolInput.command || '';

    // Check against dangerous patterns
    for (const pattern of DANGEROUS_BASH_PATTERNS) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Dangerous command pattern detected: ${command}`,
        };
      }
    }
  }

  // All checks passed
  return { allowed: true };
}

// Main execution
async function main() {
  try {
    const input = await readStdin();
    const result = validateToolUse(input);

    if (result.allowed) {
      // Tool is allowed to proceed
      process.exit(0);
    } else {
      // Block the tool and inform Claude
      console.error(`[validate-tool-use] BLOCKED: ${result.reason}`);
      process.exit(2);
    }
  } catch (err) {
    // Log error but don't block (fail open)
    console.error(`[validate-tool-use] Error: ${err.message}`);
    process.exit(0);
  }
}

main();
