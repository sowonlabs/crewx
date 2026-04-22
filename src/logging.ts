/**
 * CLI file-based logging for CrewX SDK events.
 *
 * Subscribe to task:start / task:end events from a Crewx instance
 * and write structured log files to .crewx/logs/ in the workspace root.
 *
 * File name format: {YYYYMMDDTHHmmss}_{traceId}.log
 * e.g. 20260412T145044_tsk_AbCdEfGh.log
 *
 * Format mirrors cli-bak TaskManagementService for backward compatibility.
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { Crewx } from '@crewx/sdk';

const CREWX_VERSION = '0.9.0-alpha.1';

/** Format Date as YYYYMMDDTHHmmss (local time) */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    `T${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  );
}

function ensureLogsDir(logsDir: string): void {
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Attach file-based logging to a Crewx instance.
 * Subscribes to task:start and task:end events and writes log files.
 *
 * @param crewx - The Crewx instance to attach logging to
 * @param workspaceRoot - Root directory for .crewx/logs/ (default: process.cwd())
 * @returns Cleanup function that removes all event listeners
 */
export function attachFileLogger(crewx: Crewx, workspaceRoot?: string): () => void {
  const logsDir = join(workspaceRoot ?? process.cwd(), '.crewx', 'logs');

  // traceId → absolute log file path (in-memory map for the process lifetime)
  const logFiles = new Map<string, string>();

  const unsubStart = crewx.on('task:start', (event) => {
    try {
      ensureLogsDir(logsDir);
      const ts = formatTimestamp(event.timestamp);
      const logFile = join(logsDir, `${ts}_${event.traceId}.log`);
      logFiles.set(event.traceId, logFile);

      const header =
        `=== TASK LOG: ${event.traceId} ===\n` +
        `CrewX Version: ${CREWX_VERSION}\n` +
        `Mode: ${event.mode}\n` +
        `Agent: ${event.agentRef}\n` +
        `Started: ${event.timestamp.toLocaleString()}\n` +
        `Message: ${event.message}\n` +
        `\n`;

      writeFileSync(logFile, header, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Non-fatal: CLI logging must never crash the main process
    }
  });

  const unsubEnd = crewx.on('task:end', (event) => {
    try {
      const logFile = logFiles.get(event.traceId);
      if (!logFile) return;

      const ts = new Date().toLocaleString();
      const status = event.error
        ? `failed: ${event.error.message}`
        : 'completed successfully';

      const completion =
        `[${ts}] INFO: Task ${status} in ${event.durationMs}ms\n` +
        `[${ts}] INFO: Process closed with exit code: ${event.error ? 1 : 0}\n`;

      appendFileSync(logFile, completion, 'utf8');
      logFiles.delete(event.traceId);
    } catch {
      // Non-fatal
    }
  });

  return () => {
    unsubStart();
    unsubEnd();
  };
}
