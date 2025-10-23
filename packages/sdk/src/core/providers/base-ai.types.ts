import type { TimeoutConfig } from '../../config/timeout.config';
import type { ToolCallHandler } from './tool-call.types';

export interface LoggerLike {
  log(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
  error(message: string | Error, ...optionalParams: any[]): void;
}

export interface BaseAIProviderOptions {
  logger?: LoggerLike;
  toolCallHandler?: ToolCallHandler;
  logsDir?: string;
  timeoutConfig?: TimeoutConfig;
  crewxVersion?: string;
}

export type AIProviderConfig = BaseAIProviderOptions;
