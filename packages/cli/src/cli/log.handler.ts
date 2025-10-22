import { Logger } from '@nestjs/common';
import { TaskManagementService, TaskLog } from '../services/task-management.service';
import { CliOptions } from '../cli-options';

const logger = new Logger('LogHandler');

/**
 * Handle the log command
 * Default behavior: list all logs (crewx log → crewx log ls)
 * With action: crewx log ls, crewx log <task_id>
 */
export async function handleLog(app: any, args: CliOptions): Promise<void> {
  try {
    const taskManagement = app.get(TaskManagementService);
    const action = args.logAction;

    // Determine if action is a task ID or a command
    const isTaskId = action && action.startsWith('task_');
    const isListCommand = !action || action === 'ls' || action === 'list';

    if (isTaskId) {
      // Show specific task log
      console.log(`\n📋 Task Log\n${'='.repeat(60)}`);
      console.log(`Task ID: ${action}`);
      console.log(`Log File: ${action}.log`);
      console.log('='.repeat(60) + '\n');

      const logContent = taskManagement.getTaskLogsFromFile(action);
      console.log(logContent);
    } else if (isListCommand) {
      // Show all tasks summary with detailed list (default behavior)
      const allTasks = taskManagement.getAllTasks();
      const stats = taskManagement.getTaskStatistics();

      console.log('\nAvailable Task Logs');
      console.log('='.repeat(60));
      console.log(`Total: ${stats.total} | ✅ Completed: ${stats.completed} | ❌ Failed: ${stats.failed} | ⏳ Running: ${stats.running}`);
      console.log('='.repeat(60));
      console.log('');

      if (allTasks.length === 0) {
        console.log('No task logs found in memory.');
        console.log('\nNote: Task logs are only kept in memory during the current session.');
        console.log('For persistent logs, check .crewx/logs/ directory.');
      } else {
        // Display tasks in agent ls style
        allTasks
          .sort((a: TaskLog, b: TaskLog) => b.startTime.getTime() - a.startTime.getTime()) // newest first
          .forEach((task: TaskLog, index: number) => {
            const statusIcon = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏳';
            const duration = task.duration ? `${task.duration}ms` : 'running...';

            console.log(`${index + 1}. ${statusIcon} ${task.id}`);
            console.log(`   Type: ${task.type}`);
            if (task.provider) console.log(`   Provider: ${task.provider}`);
            if (task.agentId) console.log(`   Agent: ${task.agentId}`);
            console.log(`   Started: ${task.startTime.toLocaleString()}`);
            console.log(`   Duration: ${duration}`);
            console.log('');
          });
      }

      console.log('💡 Tip: Use "crewx log <task_id>" to view detailed log');
    } else {
      // Unknown action
      console.error(`❌ Unknown log action: ${action}`);
      console.log('\nUsage:');
      console.log('  crewx log              List all logs (default)');
      console.log('  crewx log ls           List all logs');
      console.log('  crewx log <task_id>    View specific log');
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to handle log command: ${errorMessage}`);
    console.error(`❌ Error: ${errorMessage}`);
    throw error;
  }
}
