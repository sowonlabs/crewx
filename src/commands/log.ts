/**
 * crewx log handler.
 * Lists task execution logs or shows a specific task log.
 *
 * Usage:
 *   crewx log              List all tasks (newest first)
 *   crewx log ls           Same as above
 *   crewx log <task_id>    Show specific task details
 */

import { getAllTasks, getTask } from './task-db';
import type { TaskRow } from './task-db';

function statusIcon(status: TaskRow['status']): string {
  switch (status) {
    case 'running': return '⏳';
    case 'success': return '✅';
    case 'failed': return '❌';
  }
}

/**
 * Handle `crewx log` command.
 */
export async function handleLog(args: string[]): Promise<void> {
  const action = args[0];

  const isTaskId = action && (action.startsWith('tsk_') || action.startsWith('task_'));
  const isListCommand = !action || action === 'ls' || action === 'list';

  if (isTaskId) {
    // Show specific task
    const task = getTask(action);
    if (!task) {
      console.error(`Task not found: ${action}`);
      process.exit(1);
      return;
    }

    console.log(`\nTask Log\n${'='.repeat(60)}`);
    console.log(`Task ID: ${task.id}`);
    console.log(`Status: ${statusIcon(task.status)} ${task.status}`);
    console.log(`Agent: ${task.agent_id}`);
    console.log(`Mode: ${task.mode}`);
    console.log(`Started: ${new Date(task.started_at).toLocaleString()}`);
    if (task.completed_at) {
      const duration = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
      console.log(`Completed: ${new Date(task.completed_at).toLocaleString()} (${duration}ms)`);
    }
    console.log('='.repeat(60));
    console.log('');

    if (task.status === 'success' && task.result) {
      console.log('Result:');
      console.log(task.result);
    } else if (task.status === 'failed' && task.error) {
      console.log(`Error: ${task.error}`);
    } else if (task.status === 'running') {
      console.log('(task is still running)');
    }
    return;
  }

  if (isListCommand) {
    const allTasks = getAllTasks();

    console.log('\nAvailable Task Logs');
    console.log('='.repeat(60));

    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'success').length;
    const failed = allTasks.filter(t => t.status === 'failed').length;
    const running = allTasks.filter(t => t.status === 'running').length;

    console.log(`Total: ${total} | ✅ Completed: ${completed} | ❌ Failed: ${failed} | ⏳ Running: ${running}`);
    console.log('='.repeat(60));
    console.log('');

    if (allTasks.length === 0) {
      console.log('No task logs found.');
      console.log('Tip: Run `crewx query` or `crewx execute` to create tasks.');
      return;
    }

    allTasks.forEach((task, idx) => {
      const icon = statusIcon(task.status);
      const duration = task.completed_at
        ? `${new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()}ms`
        : 'running...';
      console.log(`${idx + 1}. ${icon} ${task.id}`);
      console.log(`   Agent: ${task.agent_id}  Mode: ${task.mode}`);
      console.log(`   Started: ${new Date(task.started_at).toLocaleString()}`);
      console.log(`   Duration: ${duration}`);
      console.log('');
    });

    console.log('Tip: Use "crewx log <task_id>" to view detailed log');
    return;
  }

  console.error(`Unknown log action: ${action}`);
  console.error('');
  console.error('Usage:');
  console.error('  crewx log              List all logs (default)');
  console.error('  crewx log ls           List all logs');
  console.error('  crewx log <task_id>    View specific log');
  process.exit(1);
}
