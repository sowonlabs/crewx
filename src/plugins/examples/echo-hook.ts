/**
 * EchoObserverPlugin — Tool observer that echoes events to a JSONL log.
 *
 * Observes tool:before / tool:after events from the Crewx event bus
 * and appends them as JSONL to ~/.crewx/logs/echo-hook.log.
 * Pure observer — no flow control (deny/inject/modify not applicable).
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

import { ToolObserverPlugin } from '@crewx/sdk/hooks';
import type { ObserverContext, ObserverResult } from '@crewx/sdk/hooks';

export class EchoHookPlugin extends ToolObserverPlugin {
  readonly name = 'echo-hook';
  readonly version = '0.0.1';

  readonly on = {
    beforeTool: true as const,
    afterTool: true as const,
    beforePrompt: true as const,
    sessionStart: true as const,
  };

  private readonly logPath: string;

  constructor(logDir?: string) {
    super();
    this.logPath = join(logDir ?? homedir(), '.crewx', 'logs', 'echo-hook.log');
    this.ensureLogDir();
  }

  async run(ctx: ObserverContext): Promise<ObserverResult> {
    this.echo(ctx);
    return ctx.pass();
  }

  private ensureLogDir(): void {
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private echo(ctx: ObserverContext): void {
    try {
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        event: ctx.event,
        traceId: ctx.traceId,
        agent: ctx.agent,
        provider: ctx.provider,
        thread: ctx.thread,
        tool: ctx.tool,
        cwd: ctx.cwd,
        sessionId: ctx.sessionId,
      });
      appendFileSync(this.logPath, line + '\n', { encoding: 'utf8', mode: 0o600 });
    } catch {
      // Non-fatal
    }
  }
}
