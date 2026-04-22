/**
 * crewx result handler.
 * Retrieves the result of a completed task by its ID.
 *
 * Usage:
 *   crewx result <task-id>         Print raw result
 *   crewx result <task-id> --json  Print full task record as JSON
 *   crewx result                   List recent tasks (latest 10)
 */

import { getTask, getAllTasks } from './task-db';
import type { TaskRow } from './task-db';

function statusIcon(status: TaskRow['status']): string {
  switch (status) {
    case 'running': return '⏳';
    case 'success': return '✅';
    case 'failed': return '❌';
  }
}

/**
 * Handle `crewx result` command.
 */
export async function handleResult(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json');
  const taskId = args.find(a => !a.startsWith('--'));

  if (!taskId) {
    // Show recent tasks
    const all = getAllTasks();
    const recent = all.slice(0, 10);

    if (recent.length === 0) {
      console.log('No tasks found.');
      console.log('Tip: Run `crewx query` or `crewx execute` to start a task.');
      return;
    }

    console.log('Recent Tasks (latest 10)\n');
    recent.forEach((task, idx) => {
      const icon = statusIcon(task.status);
      console.log(`${idx + 1}. ${icon} ${task.id}`);
      console.log(`   Agent: ${task.agent_id}  Mode: ${task.mode}`);
      console.log(`   Started: ${new Date(task.started_at).toLocaleString()}`);
      if (task.completed_at) {
        console.log(`   Completed: ${new Date(task.completed_at).toLocaleString()}`);
      }
      console.log('');
    });

    console.log('Tip: Run `crewx result <task-id>` to see full output.');
    return;
  }

  const task = getTask(taskId);

  if (!task) {
    console.error(`Error: Task not found: ${taskId}`);
    process.exit(1);
    return;
  }

  if (jsonMode) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  if (task.status === 'running') {
    console.error(`Task ${taskId} is still running.`);
    console.error(`Use \`crewx kill ${taskId}\` to stop it.`);
    process.exit(1);
    return;
  }

  if (task.status === 'failed') {
    console.error(`Task ${taskId} failed: ${task.error ?? 'unknown error'}`);
    process.exit(1);
    return;
  }

  // Completed (success) — print raw result
  console.log(task.result ?? '');
}
