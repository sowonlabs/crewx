/**
 * crewx kill handler.
 * Kills a running task by ID or kills all running tasks.
 *
 * Usage:
 *   crewx kill <task-id>   Kill a specific running task
 *   crewx kill --all       Kill all running tasks
 */

import { getRunningTasks, killTask } from './task-db';

/**
 * Handle `crewx kill` command.
 */
export async function handleKill(args: string[]): Promise<void> {
  const killAll = args.includes('--all');
  const taskId = args.find(a => !a.startsWith('--'));

  if (!taskId && !killAll) {
    console.error('Error: Please provide a task ID or use --all to kill all running tasks.');
    console.error('');
    console.error('Usage:');
    console.error('  crewx kill <task-id>    Kill a running task by ID');
    console.error('  crewx kill --all        Kill all running tasks');
    process.exit(1);
    return;
  }

  if (killAll) {
    const running = getRunningTasks();
    if (running.length === 0) {
      console.log('No running tasks found.');
      return;
    }
    console.log(`Found ${running.length} running task(s). Killing...`);
    for (const task of running) {
      const r = killTask(task.id);
      console.log(r.message);
    }
    return;
  }

  const r = killTask(taskId!);
  if (r.ok) {
    console.log(r.message);
  } else {
    console.error(`Error: ${r.message}`);
    process.exit(1);
  }
}
