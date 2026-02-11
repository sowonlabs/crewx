import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { TracingService, TaskStatus, SpanKind } from '../../../src/services/tracing.service';

describe('TracingService', () => {
  let service: TracingService;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create temp directory with custom db path
    tempDir = mkdtempSync(path.join(tmpdir(), 'crewx-tracing-'));
    dbPath = path.join(tempDir, '.crewx', 'traces.db');

    // Create service instance with custom dbPath
    service = new TracingService({ dbPath });
    service.onModuleInit();
  });

  afterEach(() => {
    // Close service and cleanup
    if (service) {
      service.onModuleDestroy();
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('database initialization', () => {
    it('creates .crewx directory and traces.db file', () => {
      expect(service.isEnabled()).toBe(true);
      expect(existsSync(dbPath)).toBe(true);
    });

    it('returns correct db path', () => {
      expect(service.getDbPath()).toBe(dbPath);
    });
  });

  describe('task operations', () => {
    it('creates a task and returns id', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');
    });

    it('retrieves a created task', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        user_id: 'user123',
        prompt: 'Test prompt',
        mode: 'execute',
        metadata: { key: 'value' },
      });

      const task = service.getTask(taskId!);
      expect(task).toBeTruthy();
      expect(task!.agent_id).toBe('test_agent');
      expect(task!.user_id).toBe('user123');
      expect(task!.prompt).toBe('Test prompt');
      expect(task!.mode).toBe('execute');
      expect(task!.status).toBe(TaskStatus.RUNNING);
      expect(task!.metadata).toEqual({ key: 'value' });
    });

    it('completes a task with success', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const result = service.completeTask(taskId!, 'Success result');
      expect(result).toBe(true);

      const task = service.getTask(taskId!);
      expect(task!.status).toBe(TaskStatus.SUCCESS);
      expect(task!.result).toBe('Success result');
      expect(task!.completed_at).toBeTruthy();
      expect(task!.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('fails a task with error', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const result = service.failTask(taskId!, 'Something went wrong');
      expect(result).toBe(true);

      const task = service.getTask(taskId!);
      expect(task!.status).toBe(TaskStatus.FAILED);
      expect(task!.error).toBe('Something went wrong');
      expect(task!.completed_at).toBeTruthy();
    });

    it('lists tasks in descending order by started_at', () => {
      service.createTask({ agent_id: 'agent1', prompt: 'First', mode: 'query' });
      service.createTask({ agent_id: 'agent2', prompt: 'Second', mode: 'execute' });
      service.createTask({ agent_id: 'agent1', prompt: 'Third', mode: 'query' });

      const tasks = service.listTasks({ limit: 10 });
      expect(tasks.length).toBe(3);
      expect(tasks[0].prompt).toBe('Third'); // Most recent first
    });

    it('filters tasks by agent_id', () => {
      service.createTask({ agent_id: 'agent1', prompt: 'First', mode: 'query' });
      service.createTask({ agent_id: 'agent2', prompt: 'Second', mode: 'execute' });
      service.createTask({ agent_id: 'agent1', prompt: 'Third', mode: 'query' });

      const tasks = service.listTasks({ agentId: 'agent1' });
      expect(tasks.length).toBe(2);
      tasks.forEach(task => expect(task.agent_id).toBe('agent1'));
    });
  });

  describe('span operations', () => {
    it('creates a span for a task', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const spanId = service.createSpan({
        task_id: taskId!,
        name: 'tool_execution',
        kind: SpanKind.CLIENT,
        input: '{"command": "test"}',
      });

      expect(spanId).toBeTruthy();
      expect(typeof spanId).toBe('string');
    });

    it('retrieves a created span', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const spanId = service.createSpan({
        task_id: taskId!,
        name: 'skill_call',
        kind: SpanKind.INTERNAL,
        input: 'input data',
        attributes: { skill_name: 'search' },
      });

      const span = service.getSpan(spanId!);
      expect(span).toBeTruthy();
      expect(span!.name).toBe('skill_call');
      expect(span!.kind).toBe(SpanKind.INTERNAL);
      expect(span!.status).toBe('ok');
      expect(span!.input).toBe('input data');
      expect(span!.attributes).toEqual({ skill_name: 'search' });
    });

    it('creates nested spans with parent_span_id', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const parentSpanId = service.createSpan({
        task_id: taskId!,
        name: 'parent_operation',
      });

      const childSpanId = service.createSpan({
        task_id: taskId!,
        parent_span_id: parentSpanId!,
        name: 'child_operation',
      });

      const childSpan = service.getSpan(childSpanId!);
      expect(childSpan!.parent_span_id).toBe(parentSpanId);
    });

    it('completes a span with output', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const spanId = service.createSpan({
        task_id: taskId!,
        name: 'operation',
      });

      const result = service.completeSpan(spanId!, 'output data');
      expect(result).toBe(true);

      const span = service.getSpan(spanId!);
      expect(span!.status).toBe('ok');
      expect(span!.output).toBe('output data');
      expect(span!.completed_at).toBeTruthy();
      expect(span!.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('fails a span with error', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      const spanId = service.createSpan({
        task_id: taskId!,
        name: 'operation',
      });

      const result = service.failSpan(spanId!, 'Span error');
      expect(result).toBe(true);

      const span = service.getSpan(spanId!);
      expect(span!.status).toBe('error');
      expect(span!.error).toBe('Span error');
    });

    it('gets all spans for a task', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      service.createSpan({ task_id: taskId!, name: 'span1' });
      service.createSpan({ task_id: taskId!, name: 'span2' });
      service.createSpan({ task_id: taskId!, name: 'span3' });

      const spans = service.getSpansForTask(taskId!);
      expect(spans.length).toBe(3);
    });
  });

  describe('statistics and cleanup', () => {
    it('returns correct stats', () => {
      const taskId = service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });
      service.createSpan({ task_id: taskId!, name: 'span1' });
      service.createSpan({ task_id: taskId!, name: 'span2' });

      const stats = service.getStats();
      expect(stats).toBeTruthy();
      expect(stats!.taskCount).toBe(1);
      expect(stats!.spanCount).toBe(2);
      expect(stats!.dbSizeBytes).toBeGreaterThan(0);
    });

    it('cleans up old tasks', () => {
      // Create a task (will have current timestamp)
      service.createTask({
        agent_id: 'test_agent',
        prompt: 'Test prompt',
        mode: 'query',
      });

      // Cleanup with -1 days means cutoff is in the future, so current task is "old"
      const deleted = service.cleanupOldTasks(-1);
      expect(deleted).toBe(1);

      const stats = service.getStats();
      expect(stats!.taskCount).toBe(0);
    });
  });
});
