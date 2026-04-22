/**
 * crewx ps handler.
 * Lists currently running tasks in table format.
 *
 * Usage:
 *   crewx ps           List all running tasks
 *   crewx ps --json    Output as JSON array
 */

import { getRunningTasks } from './task-db';
import type { TaskRow } from './task-db';

/**
 * Format elapsed milliseconds into a human-readable string.
 */
function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * Format a task row into a table row.
 */
function taskToRow(task: TaskRow): string[] {
  const elapsed = formatElapsed(Date.now() - new Date(task.started_at).getTime());
  return [
    task.id,
    task.agent_id,
    task.pid !== null ? String(task.pid) : '—',
    elapsed,
    task.mode,
  ];
}

/**
 * Render a table with padded columns.
 */
function renderTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)),
  );

  const separator = colWidths.map(w => '-'.repeat(w)).join('  ');
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i] ?? h.length)).join('  ');

  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(colWidths[i] ?? cell.length)).join('  '));
  }
}

/**
 * Handle `crewx ps` command.
 */
export async function handlePs(args: string[]): Promise<void> {
  const tasks = getRunningTasks();

  if (tasks.length === 0) {
    console.log('No running tasks.');
    return;
  }

  // --json output
  if (args.includes('--json')) {
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }

  const headers = ['TASK ID', 'AGENT', 'PID', 'ELAPSED', 'MODE'];
  const rows = tasks.map(taskToRow);

  renderTable(headers, rows);
  console.log(`\n  ${tasks.length} running task(s)`);
}
