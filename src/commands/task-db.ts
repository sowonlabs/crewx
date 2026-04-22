/**
 * Shared SQLite helper for ps/kill/result CLI commands.
 * Reads from (or writes to) the global ~/.crewx/crewx.db
 * populated by SqliteTracingPlugin.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import BetterSqlite3 from 'better-sqlite3';

export type TaskStatus = 'running' | 'success' | 'failed';

export interface TaskRow {
  id: string;
  agent_id: string;
  prompt: string;
  mode: string;
  status: TaskStatus;
  pid: number | null;
  started_at: string;
  completed_at: string | null;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
}

export function getDbPath(dbRoot?: string): string {
  return join(dbRoot ?? homedir(), '.crewx', 'crewx.db');
}

export function openDb(
  readonly = true,
  dbRoot?: string,
): InstanceType<typeof BetterSqlite3> | null {
  const dbPath = getDbPath(dbRoot);
  if (!existsSync(dbPath)) return null;
  return new BetterSqlite3(dbPath, { readonly });
}

/** Return all tasks with status='running'. */
export function getRunningTasks(dbRoot?: string): TaskRow[] {
  const db = openDb(true, dbRoot);
  if (!db) return [];
  try {
    return db.prepare(
      `SELECT id, agent_id, prompt, mode, status, pid, started_at, completed_at,
              result, error, duration_ms
       FROM tasks WHERE status = 'running' ORDER BY started_at DESC`,
    ).all() as TaskRow[];
  } finally {
    db.close();
  }
}

/** Return all tasks ordered by started_at desc. */
export function getAllTasks(dbRoot?: string): TaskRow[] {
  const db = openDb(true, dbRoot);
  if (!db) return [];
  try {
    return db.prepare(
      `SELECT id, agent_id, prompt, mode, status, pid, started_at, completed_at,
              result, error, duration_ms
       FROM tasks ORDER BY started_at DESC`,
    ).all() as TaskRow[];
  } finally {
    db.close();
  }
}

/** Return a single task by id, or undefined if not found. */
export function getTask(id: string, dbRoot?: string): TaskRow | undefined {
  const db = openDb(true, dbRoot);
  if (!db) return undefined;
  try {
    return db.prepare(
      `SELECT id, agent_id, prompt, mode, status, pid, started_at, completed_at,
              result, error, duration_ms
       FROM tasks WHERE id = ?`,
    ).get(id) as TaskRow | undefined;
  } finally {
    db.close();
  }
}

/** Send SIGTERM to the task's pid and mark it failed. Returns ok/message. */
export function killTask(
  id: string,
  dbRoot?: string,
): { ok: boolean; message: string } {
  const db = openDb(false, dbRoot);
  if (!db) return { ok: false, message: `crewx.db not found — no running tasks.` };

  try {
    const task = db.prepare(
      `SELECT id, status, pid FROM tasks WHERE id = ?`,
    ).get(id) as { id: string; status: string; pid: number | null } | undefined;

    if (!task) {
      return { ok: false, message: `Task not found: ${id}` };
    }
    if (task.status !== 'running') {
      return { ok: false, message: `Task ${id} is not running (status: ${task.status})` };
    }

    if (task.pid) {
      try {
        process.kill(task.pid, 'SIGTERM');
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ESRCH') {
          return {
            ok: false,
            message: `Failed to kill PID ${task.pid}: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        // ESRCH = process already gone — still clean up the record
      }
    }

    db.prepare(
      `UPDATE tasks SET status='failed', error='killed by user',
       completed_at=?, pid=NULL WHERE id=?`,
    ).run(new Date().toISOString(), id);

    return { ok: true, message: `Killed task ${id}${task.pid ? ` (PID: ${task.pid})` : ''}` };
  } finally {
    db.close();
  }
}
