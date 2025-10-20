import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CREWX_VERSION } from '../version';

// Task log interface
export interface TaskLog {
  id: string;
  type: 'query' | 'execute' | 'init' | 'doctor';
  agentId?: string;
  provider?: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  duration?: number; // in milliseconds
  memoryUsage?: {
    start: number; // in bytes
    end: number; // in bytes
  };
  prompt?: string;
  command?: string;
  options?: any;
  result?: any;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
}

// Task creation options
export interface TaskCreationOptions {
  type: 'query' | 'execute' | 'init' | 'doctor';
  provider?: string;
  prompt?: string;
  command?: string;
  options?: any;
  agentId?: string;
}

@Injectable()
export class TaskManagementService {
  private readonly logger = new Logger(TaskManagementService.name);
  private readonly taskLogs = new Map<string, TaskLog>();
  private readonly logsDir = path.join(process.cwd(), '.crewx', 'logs');

  constructor() {
    // Ensure logs directory exists
    this.ensureLogsDirectory();
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new task and return its ID
   */
  createTask(options: TaskCreationOptions): string {
    const taskId = this.generateTaskId();
    
    const task: TaskLog = {
      id: taskId,
      type: options.type,
      agentId: options.agentId,
      provider: options.provider,
      startTime: new Date(),
      status: 'running',
      prompt: options.prompt,
      logs: [],
      memoryUsage: {
        start: process.memoryUsage().heapUsed,
        end: 0,
      },
    };

    this.taskLogs.set(taskId, task);
    
    // Create task log file
    this.createTaskLogFile(taskId, task);
    
    this.logger.log(`Created new task: ${taskId} (${options.type}, ${options.provider})`);
    
    return taskId;
  }

  /**
   * Add a log entry to a task
   */
  addTaskLog(taskId: string, log: { level: 'info' | 'warn' | 'error'; message: string }): void {
    const task = this.taskLogs.get(taskId);
    if (task) {
      const logEntry = {
        timestamp: new Date(),
        ...log
      };
      
      task.logs.push(logEntry);
      
      // Append to log file
      this.appendToLogFile(taskId, logEntry);
      
      this.logger.debug(`Added log to task ${taskId}: [${log.level.toUpperCase()}] ${log.message}`);
    } else {
      this.logger.warn(`Attempted to add log to non-existent task: ${taskId}`);
    }
  }

  /**
   * Complete a task with result
   */
  completeTask(taskId: string, result: any, success: boolean): void {
    const task = this.taskLogs.get(taskId);
    if (task) {
      task.endTime = new Date();
      task.status = success ? 'completed' : 'failed';
      task.result = result;
      task.duration = task.endTime.getTime() - task.startTime.getTime();
      if (task.memoryUsage) {
        task.memoryUsage.end = process.memoryUsage().heapUsed;
      }

      // Update log file with completion info
      this.updateLogFileWithCompletion(taskId, task, success);
      
      const duration = task.duration;
      this.logger.log(`Task ${taskId} ${success ? 'completed' : 'failed'} in ${duration}ms`);
    } else {
      this.logger.warn(`Attempted to complete non-existent task: ${taskId}`);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskLog | undefined {
    return this.taskLogs.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskLog[] {
    return Array.from(this.taskLogs.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: 'running' | 'completed' | 'failed'): TaskLog[] {
    return this.getAllTasks().filter(task => task.status === status);
  }

  /**
   * Get tasks by provider
   */
  getTasksByProvider(provider: string): TaskLog[] {
    return this.getAllTasks().filter(task => task.provider === provider);
  }

  /**
   * Get task logs from file system
   */
  getTaskLogsFromFile(taskId?: string): string {
    try {
      if (taskId) {
        // Get specific task log
        const logFile = path.join(this.logsDir, `${taskId}.log`);
        if (fs.existsSync(logFile)) {
          return fs.readFileSync(logFile, 'utf-8');
        } else {
          return `Task log not found: ${taskId}`;
        }
      } else {
        // Get all task logs summary
        const logFiles = fs.readdirSync(this.logsDir).filter(file => file.endsWith('.log'));
        if (logFiles.length === 0) {
          return 'No task logs found';
        }
        
        return `Found ${logFiles.length} task logs:\n${logFiles.map(file => `- ${file}`).join('\n')}`;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read task logs: ${errorMessage}`);
      return `Error reading task logs: ${errorMessage}`;
    }
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): void {
    try {
      // Clear in-memory logs
      this.taskLogs.clear();
      
      // Clear log files
      if (fs.existsSync(this.logsDir)) {
        const logFiles = fs.readdirSync(this.logsDir).filter(file => file.endsWith('.log'));
        logFiles.forEach(file => {
          const filePath = path.join(this.logsDir, file);
          fs.unlinkSync(filePath);
        });
        this.logger.log(`Cleared ${logFiles.length} log files`);
      }
      
      this.logger.log('All task logs cleared');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clear logs: ${errorMessage}`);
    }
  }

  /**
   * Get task statistics
   */
  getTaskStatistics(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    byProvider: Record<string, number>;
    byType: Record<string, number>;
  } {
    const allTasks = this.getAllTasks();
    
    const stats = {
      total: allTasks.length,
      running: allTasks.filter(t => t.status === 'running').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      byProvider: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    // Count by provider
    allTasks.forEach(task => {
      if (task.provider) {
        stats.byProvider[task.provider] = (stats.byProvider[task.provider] || 0) + 1;
      }
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clean up old tasks (keep last 100 tasks)
   */
  cleanupOldTasks(keepCount: number = 100): void {
    const allTasks = this.getAllTasks();
    
    if (allTasks.length <= keepCount) {
      return;
    }

    // Sort by start time (newest first) and keep only the newest ones
    const sortedTasks = allTasks.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    const tasksToRemove = sortedTasks.slice(keepCount);

    tasksToRemove.forEach(task => {
      // Remove from memory
      this.taskLogs.delete(task.id);
      
      // Remove log file
      try {
        const logFile = path.join(this.logsDir, `${task.id}.log`);
        if (fs.existsSync(logFile)) {
          fs.unlinkSync(logFile);
        }
      } catch (error) {
        this.logger.warn(`Failed to remove log file for task ${task.id}: ${error}`);
      }
    });

    this.logger.log(`Cleaned up ${tasksToRemove.length} old tasks`);
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogsDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
        this.logger.log(`Created logs directory: ${this.logsDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create logs directory: ${error}`);
    }
  }

  /**
   * Create initial task log file
   */
  private createTaskLogFile(taskId: string, task: TaskLog): void {
    try {
      const logFile = path.join(this.logsDir, `${taskId}.log`);
      const timestamp = new Date().toLocaleString();
      
    const header = `=== TASK LOG: ${taskId} ===
CrewX Version: ${CREWX_VERSION}
Provider: ${task.provider}
Type: ${task.type}
Agent: ${task.agentId || 'N/A'}
Started: ${timestamp}

`;
      
      fs.writeFileSync(logFile, header, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to create log file for task ${taskId}: ${error}`);
    }
  }

  /**
   * Append log entry to file
   */
  private appendToLogFile(taskId: string, logEntry: TaskLog['logs'][0]): void {
    try {
      const logFile = path.join(this.logsDir, `${taskId}.log`);
      const timestamp = logEntry.timestamp.toLocaleString();
      const logLine = `[${timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}\n`;
      
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to append to log file for task ${taskId}: ${error}`);
    }
  }

  /**
   * Update log file with completion info
   */
  private updateLogFileWithCompletion(taskId: string, task: TaskLog, success: boolean): void {
    try {
      const logFile = path.join(this.logsDir, `${taskId}.log`);
      const timestamp = new Date().toLocaleString();
      const duration = task.endTime && task.startTime 
        ? task.endTime.getTime() - task.startTime.getTime() 
        : 0;
      
      const completionInfo = `
[${timestamp}] INFO: Process closed with exit code: ${success ? 0 : 1}
[${timestamp}] INFO: Task ${success ? 'completed successfully' : 'failed'} in ${duration}ms
`;
      
      fs.appendFileSync(logFile, completionInfo, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to update log file for task ${taskId}: ${error}`);
    }
  }
}
