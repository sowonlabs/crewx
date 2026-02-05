import type { TimeoutConfig } from '../../config/timeout.config';
import type { LogConfig } from '../../config/log.config';
import type { ToolCallHandler } from './tool-call.types';

export interface LoggerLike {
  log(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
  error(message: string | Error, ...optionalParams: any[]): void;
}

export type ProviderTaskLogLevel = 'STDOUT' | 'STDERR' | 'INFO' | 'ERROR';

export interface ProviderTaskLogEntry {
  taskId: string;
  timestamp: string;
  level: ProviderTaskLogLevel;
  message: string;
}

export type ProviderTaskLogHandler = (entry: ProviderTaskLogEntry) => void;

export interface BaseAIProviderOptions {
  logger?: LoggerLike;
  toolCallHandler?: ToolCallHandler;
  logsDir?: string;
  timeoutConfig?: TimeoutConfig;
  logConfig?: LogConfig;
  crewxVersion?: string;
  taskLogHandler?: ProviderTaskLogHandler;
}

export type AIProviderConfig = BaseAIProviderOptions;
