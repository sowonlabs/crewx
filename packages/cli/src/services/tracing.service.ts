import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Span kind enum (similar to OpenTelemetry)
 */
export enum SpanKind {
  INTERNAL = 'internal',
  CLIENT = 'client',
  SERVER = 'server',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
}

/**
 * Task record interface
 */
export interface TaskRecord {
  id: string;
  agent_id: string;
  user_id?: string;
  prompt: string;
  mode: 'query' | 'execute';
  status: TaskStatus;
  result?: string;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Span record interface
 */
export interface SpanRecord {
  id: string;
  task_id: string;
  parent_span_id?: string;
  name: string;
  kind: SpanKind;
  status: 'ok' | 'error';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  input?: string;
  output?: string;
  error?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Task creation input
 */
export interface CreateTaskInput {
  agent_id: string;
  user_id?: string;
  prompt: string;
  mode: 'query' | 'execute';
  metadata?: Record<string, unknown>;
}

/**
 * Span creation input
 */
export interface CreateSpanInput {
  task_id: string;
  parent_span_id?: string;
  name: string;
  kind?: SpanKind;
  input?: string;
  attributes?: Record<string, unknown>;
}

/**
 * TracingService options
 */
export interface TracingServiceOptions {
  /** Custom database path (for testing) */
  dbPath?: string;
}

/**
 * TracingService - SQLite-based tracing for agent execution
 *
 * Features:
 * - Stores traces in .crewx/traces.db
 * - Tasks table: tracks agent executions
 * - Spans table: tracks individual operations within tasks
 * - Supports hierarchical span structure for nested operations
 */
@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TracingService.name);
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(
    @Optional() @Inject('TRACING_OPTIONS') options?: TracingServiceOptions,
  ) {
    if (options?.dbPath) {
      this.dbPath = options.dbPath;
    } else {
      const crewxDir = path.join(process.cwd(), '.crewx');
      this.dbPath = path.join(crewxDir, 'traces.db');
    }
  }

  onModuleInit() {
    this.initializeDatabase();
  }

  onModuleDestroy() {
    this.close();
  }

  /**
   * Initialize SQLite database and create tables
   */
  private initializeDatabase(): void {
    try {
      // Ensure .crewx directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');

      // Create tasks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          user_id TEXT,
          prompt TEXT NOT NULL,
          mode TEXT NOT NULL CHECK (mode IN ('query', 'execute')),
          status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
          result TEXT,
          error TEXT,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          metadata TEXT
        )
      `);

      // Create spans table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS spans (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          parent_span_id TEXT,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('internal', 'client', 'server', 'producer', 'consumer')),
          status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          input TEXT,
          output TEXT,
          error TEXT,
          attributes TEXT,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_span_id) REFERENCES spans(id) ON DELETE SET NULL
        )
      `);

      // Create indexes for efficient queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);
        CREATE INDEX IF NOT EXISTS idx_spans_task_id ON spans(task_id);
        CREATE INDEX IF NOT EXISTS idx_spans_parent_span_id ON spans(parent_span_id);
      `);

      this.logger.log(`Tracing database initialized at ${this.dbPath}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize tracing database: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - tracing is non-critical, app should continue without it
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.log('Tracing database connection closed');
    }
  }

  /**
   * Generate unique ID (UUID v4-like)
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get current ISO timestamp
   */
  private now(): string {
    return new Date().toISOString();
  }

  /**
   * Create a new task record
   */
  createTask(input: CreateTaskInput): string | null {
    if (!this.db) {
      return null;
    }

    const id = this.generateId();
    const now = this.now();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (id, agent_id, user_id, prompt, mode, status, started_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        input.agent_id,
        input.user_id ?? null,
        input.prompt,
        input.mode,
        TaskStatus.RUNNING,
        now,
        input.metadata ? JSON.stringify(input.metadata) : null,
      );

      this.logger.debug(`Task created: ${id} for agent ${input.agent_id}`);
      return id;
    } catch (error) {
      this.logger.error(
        `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Complete a task with success
   */
  completeTask(taskId: string, result?: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = ?, result = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `);

      const info = stmt.run(TaskStatus.SUCCESS, result ?? null, now, now, taskId);
      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to complete task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Fail a task with error
   */
  failTask(taskId: string, error: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = ?, error = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `);

      const info = stmt.run(TaskStatus.FAILED, error, now, now, taskId);
      return info.changes > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fail task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): TaskRecord | null {
    if (!this.db) {
      return null;
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
      const row = stmt.get(taskId) as any;

      if (!row) {
        return null;
      }

      return {
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * List recent tasks
   */
  listTasks(options?: { limit?: number; offset?: number; agentId?: string }): TaskRecord[] {
    if (!this.db) {
      return [];
    }

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    try {
      let query = 'SELECT * FROM tasks';
      const params: any[] = [];

      if (options?.agentId) {
        query += ' WHERE agent_id = ?';
        params.push(options.agentId);
      }

      query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map((row) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Create a new span record
   */
  createSpan(input: CreateSpanInput): string | null {
    if (!this.db) {
      return null;
    }

    const id = this.generateId();
    const now = this.now();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO spans (id, task_id, parent_span_id, name, kind, status, started_at, input, attributes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        input.task_id,
        input.parent_span_id ?? null,
        input.name,
        input.kind ?? SpanKind.INTERNAL,
        'ok',
        now,
        input.input ?? null,
        input.attributes ? JSON.stringify(input.attributes) : null,
      );

      this.logger.debug(`Span created: ${id} for task ${input.task_id}`);
      return id;
    } catch (error) {
      this.logger.error(
        `Failed to create span: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Complete a span with success
   */
  completeSpan(spanId: string, output?: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();
      const stmt = this.db.prepare(`
        UPDATE spans
        SET status = 'ok', output = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `);

      const info = stmt.run(output ?? null, now, now, spanId);
      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to complete span ${spanId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Fail a span with error
   */
  failSpan(spanId: string, error: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();
      const stmt = this.db.prepare(`
        UPDATE spans
        SET status = 'error', error = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER)
        WHERE id = ?
      `);

      const info = stmt.run(error, now, now, spanId);
      return info.changes > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fail span ${spanId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get spans for a task
   */
  getSpansForTask(taskId: string): SpanRecord[] {
    if (!this.db) {
      return [];
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM spans WHERE task_id = ? ORDER BY started_at ASC');
      const rows = stmt.all(taskId) as any[];

      return rows.map((row) => ({
        ...row,
        attributes: row.attributes ? JSON.parse(row.attributes) : undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get spans for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Get a span by ID
   */
  getSpan(spanId: string): SpanRecord | null {
    if (!this.db) {
      return null;
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM spans WHERE id = ?');
      const row = stmt.get(spanId) as any;

      if (!row) {
        return null;
      }

      return {
        ...row,
        attributes: row.attributes ? JSON.parse(row.attributes) : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get span ${spanId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Delete old tasks and their spans (cleanup)
   */
  cleanupOldTasks(daysToKeep: number = 30): number {
    if (!this.db) {
      return 0;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoff = cutoffDate.toISOString();

      // Spans will be deleted automatically due to CASCADE
      const stmt = this.db.prepare('DELETE FROM tasks WHERE started_at < ?');
      const info = stmt.run(cutoff);

      if (info.changes > 0) {
        this.logger.log(`Cleaned up ${info.changes} old tasks`);
      }

      return info.changes;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old tasks: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): { taskCount: number; spanCount: number; dbSizeBytes: number } | null {
    if (!this.db) {
      return null;
    }

    try {
      const taskCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM tasks');
      const spanCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM spans');

      const taskCount = (taskCountStmt.get() as { count: number }).count;
      const spanCount = (spanCountStmt.get() as { count: number }).count;

      // Get file size
      let dbSizeBytes = 0;
      if (fs.existsSync(this.dbPath)) {
        const stats = fs.statSync(this.dbPath);
        dbSizeBytes = stats.size;
      }

      return { taskCount, spanCount, dbSizeBytes };
    } catch (error) {
      this.logger.error(
        `Failed to get stats: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Check if tracing is enabled (database initialized)
   */
  isEnabled(): boolean {
    return this.db !== null;
  }

  /**
   * Get database file path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}
