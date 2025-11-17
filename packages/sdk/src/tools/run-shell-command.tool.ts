/**
 * run_shell_command tool for CrewX API Provider
 * Executes shell commands with timeout support
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * run_shell_command tool definition
 *
 * Executes shell commands with optional timeout.
 */
export const runShellCommandTool = createTool({
  id: 'run_shell_command',
  description: `Executes a shell command and returns its output (stdout and stderr). Supports optional timeout in seconds. Use with caution as this can execute any shell command.`,

  inputSchema: z.object({
    command: z
      .string()
      .describe('The shell command to execute.'),
    timeout_seconds: z
      .number()
      .int()
      .positive()
      .optional()
      .default(30)
      .describe('Optional: Maximum execution time in seconds (default: 30).'),
  }),

  outputSchema: z.string().describe('Command output or error message'),

  execute: async ({ context }) => {
    const { command, timeout_seconds = 30 } = context;

    // Validation
    if (command.trim() === '') {
      throw new Error("The 'command' parameter must be non-empty.");
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout_seconds * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: process.cwd(),
      });

      let output = '';
      if (stdout) {
        output += `STDOUT:\n${stdout}`;
      }
      if (stderr) {
        output += stdout ? '\n\n' : '';
        output += `STDERR:\n${stderr}`;
      }

      return output || 'Command executed successfully (no output)';
    } catch (error: any) {
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Command timed out after ${timeout_seconds} seconds`);
      }

      let errorMsg = `Command failed: ${command}\n`;
      if (error.stdout) {
        errorMsg += `\nSTDOUT:\n${error.stdout}`;
      }
      if (error.stderr) {
        errorMsg += `\nSTDERR:\n${error.stderr}`;
      }
      if (error.code !== undefined) {
        errorMsg += `\nExit code: ${error.code}`;
      }

      throw new Error(errorMsg);
    }
  },
});
