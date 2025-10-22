/**
 * Logger Adapter for SDK
 *
 * Adapts NestJS Logger to SDK's logger interface.
 * This allows SDK components to log through CLI's logging infrastructure.
 */

import { Logger } from '@nestjs/common';
import type { LoggerLike } from '@sowonai/crewx-sdk';

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
