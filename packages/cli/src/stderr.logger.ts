import { ConsoleLogger, LogLevel } from '@nestjs/common';

export class StderrLogger extends ConsoleLogger {
  constructor(context?: string, options?: { logLevels?: LogLevel[]; timestamp?: boolean }) {
    super(context ?? 'StderrLogger', options ?? {});
  }

  protected printMessage(
    message: any,
    color: (message: string) => string,
    context: string = '',
    isTimeDiffEnabled?: boolean,
    includeContext?: boolean,
  ) {
    const output = typeof message === 'string' ? message : JSON.stringify(message);
    const localeStringOptions = {
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      day: '2-digit',
      month: '2-digit',
    };
    const timestamp = new Date(Date.now()).toLocaleString(
      undefined,
      localeStringOptions as any,
    );

    const pidMessage = color(`[Nest] ${process.pid}  - `);
    const contextMessage = includeContext ? `[${context}] ` : '';

    process.stderr.write(
      `${pidMessage}${timestamp}   ${contextMessage}${output}\n`,
    );
  }
}