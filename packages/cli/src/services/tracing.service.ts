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
 * Task log entry interface (Phase 4)
 */
export interface TaskLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'stdout' | 'stderr';
  message: string;
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
  /** Phase 3a: Extended fields */
  trace_id?: string;
  parent_task_id?: string;
  caller_agent_id?: string;
  model?: string;
  platform?: string;
  crewx_version?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  /** Phase 4: Enhanced task tracking */
  pid?: number;
  rendered_prompt?: string;
  command?: string;
  coding_agent_command?: string;
  exit_code?: number;
  logs?: TaskLogEntry[];
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
  /** Optional external ID. If provided, used as task ID; otherwise, auto-generated. */
  id?: string;
  agent_id: string;
  user_id?: string;
  prompt: string;
  mode: 'query' | 'execute';
  metadata?: Record<string, unknown>;
  /** Phase 3a: Extended fields */
  trace_id?: string;
  parent_task_id?: string;
  caller_agent_id?: string;
  model?: string;
  platform?: 'cli' | 'slack' | 'mcp';
  crewx_version?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  /** Phase 4: Enhanced task tracking */
  pid?: number;
  rendered_prompt?: string;
  command?: string;
  coding_agent_command?: string;
  exit_code?: number;
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

      // Phase 3a: Run schema migration for new columns
      this.migrateSchemaPhase3a();

      // Phase 4: Run schema migration for enhanced task tracking
      this.migrateSchemaPhase4();

      this.logger.log(`Tracing database initialized at ${this.dbPath}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize tracing database: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - tracing is non-critical, app should continue without it
    }
  }

  /**
   * Check if a column exists in a table
   */
  private columnExists(tableName: string, columnName: string): boolean {
    if (!this.db) return false;
    try {
      const result = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
      return result.some(col => col.name === columnName);
    } catch {
      return false;
    }
  }

  /**
   * Phase 3a: Migrate schema to add new columns for enhanced tracing
   * Uses columnExists check to safely add columns only if they don't exist
   */
  private migrateSchemaPhase3a(): void {
    if (!this.db) return;

    const newColumns = [
      { name: 'trace_id', type: 'TEXT' },
      { name: 'parent_task_id', type: 'TEXT' },
      { name: 'caller_agent_id', type: 'TEXT' },
      { name: 'model', type: 'TEXT' },
      { name: 'platform', type: 'TEXT', default: "'cli'" },
      { name: 'crewx_version', type: 'TEXT' },
      { name: 'input_tokens', type: 'INTEGER', default: '0' },
      { name: 'output_tokens', type: 'INTEGER', default: '0' },
      { name: 'cost_usd', type: 'REAL', default: '0' },
    ];

    let migratedCount = 0;

    for (const col of newColumns) {
      if (!this.columnExists('tasks', col.name)) {
        try {
          const defaultClause = col.default ? ` DEFAULT ${col.default}` : '';
          this.db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}${defaultClause}`);
          migratedCount++;
          this.logger.debug(`Added column tasks.${col.name}`);
        } catch (error) {
          this.logger.warn(`Failed to add column ${col.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Create indexes for new columns (if they don't exist)
    const indexes = [
      { name: 'idx_tasks_trace_id', column: 'trace_id' },
      { name: 'idx_tasks_parent_task_id', column: 'parent_task_id' },
      { name: 'idx_tasks_crewx_version', column: 'crewx_version' },
    ];

    for (const idx of indexes) {
      try {
        this.db.exec(`CREATE INDEX IF NOT EXISTS ${idx.name} ON tasks(${idx.column})`);
      } catch (error) {
        this.logger.warn(`Failed to create index ${idx.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (migratedCount > 0) {
      this.logger.log(`Phase 3a migration: Added ${migratedCount} new columns to tasks table`);
    }
  }

  /**
   * Phase 4: Migrate schema to add enhanced task tracking columns
   * - pid: Process ID for running tasks
   * - rendered_prompt: Full rendered prompt (10MB limit handled in createTask)
   * - command: CrewX CLI command executed
   * - coding_agent_command: Underlying coding agent CLI command executed
   * - exit_code: CLI process exit code
   * - logs: JSON array of log entries for real-time storage
   */
  private migrateSchemaPhase4(): void {
    if (!this.db) return;

    const newColumns = [
      { name: 'pid', type: 'INTEGER' },
      { name: 'rendered_prompt', type: 'TEXT' },
      { name: 'command', type: 'TEXT' },
      { name: 'coding_agent_command', type: 'TEXT' },
      { name: 'exit_code', type: 'INTEGER' },
      { name: 'logs', type: 'TEXT' }, // JSON array
    ];

    let migratedCount = 0;

    for (const col of newColumns) {
      if (!this.columnExists('tasks', col.name)) {
        try {
          this.db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`);
          migratedCount++;
          this.logger.debug(`Added column tasks.${col.name}`);
        } catch (error) {
          this.logger.warn(`Failed to add column ${col.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Create index for pid (useful for finding running tasks by process)
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_pid ON tasks(pid)`);
    } catch (error) {
      this.logger.warn(`Failed to create index idx_tasks_pid: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (migratedCount > 0) {
      this.logger.log(`Phase 4 migration: Added ${migratedCount} new columns to tasks table`);
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
   * Estimate token count from text (chars * 0.4 approximation)
   * More accurate parsing (JSON extraction) is a future enhancement
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length * 0.4);
  }

  /**
   * Create a new task record
   * Phase 3b: Token estimation removed - will be populated via JSON parsing in future
   * Issue #77: Uses external id if provided, otherwise generates one
   * Phase 4: Added pid, rendered_prompt, command, coding_agent_command, exit_code fields
   */
  createTask(input: CreateTaskInput): string | null {
    if (!this.db) {
      return null;
    }

    const id = input.id ?? this.generateId();
    const now = this.now();

    // Phase 3a: Merge provider_version into metadata if provided
    const metadata = input.metadata ? { ...input.metadata } : {};
    // Note: provider_version can be added to metadata by the caller

    // Phase 4: Truncate rendered_prompt if exceeds 10MB limit
    const MAX_RENDERED_PROMPT_SIZE = 10 * 1024 * 1024; // 10MB
    let renderedPrompt = input.rendered_prompt ?? null;
    if (renderedPrompt && renderedPrompt.length > MAX_RENDERED_PROMPT_SIZE) {
      renderedPrompt = renderedPrompt.slice(0, MAX_RENDERED_PROMPT_SIZE) + '\n[TRUNCATED]';
      this.logger.warn(`Rendered prompt for task ${id} truncated to 10MB limit`);
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (
          id, agent_id, user_id, prompt, mode, status, started_at, metadata,
          trace_id, parent_task_id, caller_agent_id, model, platform, crewx_version,
          input_tokens, output_tokens, cost_usd,
          pid, rendered_prompt, command, coding_agent_command, exit_code, logs
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        input.agent_id,
        input.user_id ?? null,
        input.prompt,
        input.mode,
        TaskStatus.RUNNING,
        now,
        Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        input.trace_id ?? null,
        input.parent_task_id ?? null,
        input.caller_agent_id ?? null,
        input.model ?? null,
        input.platform ?? 'cli',
        input.crewx_version ?? null,
        input.input_tokens ?? 0,  // Phase 3b: Token counting deferred to future JSON parsing
        input.output_tokens ?? 0,
        input.cost_usd ?? 0,
        input.pid ?? null,  // Phase 4: Process ID
        renderedPrompt,     // Phase 4: Rendered prompt (with 10MB limit)
        input.command ?? null, // Phase 4: CrewX CLI command
        input.coding_agent_command ?? null, // Phase 4: Coding agent CLI command
        input.exit_code ?? null,
        '[]',               // Phase 4: Initialize logs as empty JSON array
      );

      this.logger.debug(`Task created: ${id} for agent ${input.agent_id} (model: ${input.model ?? 'default'})`);
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
   * Phase 3b: output_tokens left at 0 - will be populated via JSON parsing in future
   */
  completeTask(taskId: string, result?: string, exitCode?: number | null): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();

      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = ?, result = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
            output_tokens = ?,
            exit_code = ?
        WHERE id = ?
      `);

      const info = stmt.run(TaskStatus.SUCCESS, result ?? null, now, now, 0, exitCode ?? null, taskId);
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
  failTask(taskId: string, error: string, exitCode?: number | null): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const now = this.now();
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET status = ?, error = ?, completed_at = ?,
            duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
            exit_code = ?
        WHERE id = ?
      `);

      const info = stmt.run(TaskStatus.FAILED, error, now, now, exitCode ?? null, taskId);
      return info.changes > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fail task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Phase 4: Update task PID (process ID)
   * Used to track which process is running a task
   */
  updateTaskPid(taskId: string, pid: number): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET pid = ?
        WHERE id = ?
      `);

      const info = stmt.run(pid, taskId);
      if (info.changes > 0) {
        this.logger.debug(`Updated task ${taskId} with PID ${pid}`);
      }
      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to update PID for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Phase 4: Update coding agent command
   * Stores the underlying CLI command executed for the coding agent
   */
  updateTaskCodingAgentCommand(taskId: string, command: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET coding_agent_command = ?
        WHERE id = ?
      `);

      const info = stmt.run(command, taskId);
      if (info.changes > 0) {
        this.logger.debug(`Updated task ${taskId} with coding agent command`);
      }
      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to update coding agent command for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Phase 4: Update task rendered_prompt
   * Used to store the full rendered prompt after it's built
   */
  updateTaskRenderedPrompt(taskId: string, renderedPrompt: string): boolean {
    if (!this.db) {
      return false;
    }

    try {
      // Apply 10MB limit
      const MAX_RENDERED_PROMPT_SIZE = 10 * 1024 * 1024;
      let truncatedPrompt = renderedPrompt;
      if (renderedPrompt.length > MAX_RENDERED_PROMPT_SIZE) {
        truncatedPrompt = renderedPrompt.slice(0, MAX_RENDERED_PROMPT_SIZE) + '\n[TRUNCATED]';
        this.logger.warn(`Rendered prompt for task ${taskId} truncated to 10MB limit`);
      }

      const stmt = this.db.prepare(`
        UPDATE tasks
        SET rendered_prompt = ?
        WHERE id = ?
      `);

      const info = stmt.run(truncatedPrompt, taskId);
      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to update rendered_prompt for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Phase 4: Append a log entry to a task's logs array
   * Stores logs in real-time as JSON array in the logs column
   */
  appendTaskLog(taskId: string, entry: TaskLogEntry): boolean {
    if (!this.db) {
      return false;
    }

    try {
      // First, get existing logs
      const getStmt = this.db.prepare('SELECT logs FROM tasks WHERE id = ?');
      const row = getStmt.get(taskId) as { logs: string | null } | undefined;

      if (!row) {
        this.logger.warn(`Task ${taskId} not found when appending log`);
        return false;
      }

      // Parse existing logs or create empty array
      let logs: TaskLogEntry[] = [];
      if (row.logs) {
        try {
          logs = JSON.parse(row.logs);
        } catch {
          // If parsing fails, start fresh
          logs = [];
        }
      }

      // Append new entry
      logs.push(entry);

      // Update the logs column
      const updateStmt = this.db.prepare('UPDATE tasks SET logs = ? WHERE id = ?');
      const info = updateStmt.run(JSON.stringify(logs), taskId);

      return info.changes > 0;
    } catch (error) {
      this.logger.error(
        `Failed to append log for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get a task by ID
   * Phase 4: Parse logs JSON column
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
        logs: row.logs ? JSON.parse(row.logs) : undefined,
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
        logs: row.logs ? JSON.parse(row.logs) : undefined,
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
