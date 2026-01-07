/**
 * Logger Adapter for SDK
 *
 * Adapts NestJS Logger to SDK's logger interface.
 * This allows SDK components to log through CLI's logging infrastructure.
 */

import { Logger } from '@nestjs/common';
import type { LoggerLike, ProviderTaskLogEntry, ProviderTaskLogHandler } from '@sowonai/crewx-sdk';
import type { TaskLogEntry, TracingService } from '../services/tracing.service';

/**
 * Create a logger function that wraps a NestJS Logger instance
 * Compatible with SDK RemoteAgentManager's logger interface
 */
export function createSdkLoggerAdapter(logger: Logger) {
  return (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => {
    switch (level) {
      case 'debug':
        logger.debug(message);
        break;
      case 'info':
        logger.log(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
      default:
        logger.log(message);
    }
  };
}

/**
 * Create a logger adapter for SDK providers (BaseAIProvider)
 * Compatible with SDK LoggerLike interface
 */
export function createLoggerAdapter(context: string): LoggerLike {
  const logger = new Logger(context);

  return {
    log(message: string, ...optionalParams: any[]): void {
      logger.log(message, ...optionalParams);
    },
    warn(message: string, ...optionalParams: any[]): void {
      logger.warn(message, ...optionalParams);
    },
    error(message: string | Error, ...optionalParams: any[]): void {
      if (message instanceof Error) {
        logger.error(message.message, message.stack);
      } else {
        logger.error(message);
      }

      for (const param of optionalParams) {
        if (param instanceof Error) {
          logger.error(param.message, param.stack);
        } else if (typeof param === 'string') {
          logger.error(param);
        } else if (param !== undefined) {
          logger.error(JSON.stringify(param));
        }
      }
    },
  };
}

export function createTaskLogHandler(tracingService?: TracingService): ProviderTaskLogHandler | undefined {
  if (!tracingService) {
    return undefined;
  }

  const TASK_CACHE_LIMIT = 1000;
  const knownTasks = new Map<string, true>();

  const touchTask = (cache: Map<string, true>, taskId: string): boolean => {
    if (!cache.has(taskId)) {
      return false;
    }
    cache.delete(taskId);
    cache.set(taskId, true);
    return true;
  };

  const rememberTask = (cache: Map<string, true>, taskId: string): void => {
    if (cache.has(taskId)) {
      cache.delete(taskId);
    }
    cache.set(taskId, true);
    if (cache.size > TASK_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
  };

  return (entry: ProviderTaskLogEntry) => {
    if (!touchTask(knownTasks, entry.taskId)) {
      const task = tracingService.getTask(entry.taskId);
      if (!task) {
        return;
      }
      rememberTask(knownTasks, entry.taskId);
    }

    if (entry.level !== 'STDOUT' && entry.level !== 'STDERR') {
      return;
    }

    const level: TaskLogEntry['level'] = entry.level === 'STDOUT' ? 'stdout' : 'stderr';
    tracingService.appendTaskLog(entry.taskId, {
      timestamp: entry.timestamp,
      level,
      message: entry.message,
    });
  };
}
