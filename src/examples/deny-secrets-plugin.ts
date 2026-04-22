/**
 * DenyIfTouchesSecretsPlugin — Phase 0 demo HookPlugin.
 *
 * Denies Bash tool calls whose command string contains ".env".
 * Pure string matching — trivially bypassable (see README).
 *
 * SECURITY NOTE:
 *   Do NOT include tool.input content in deny reasons.
 *   Use static messages only to prevent prompt injection.
 *   ✅ return ctx.deny('Secrets-related command');
 *   ❌ return ctx.deny(`Blocked: ${cmd}`);
 */

import { HookPlugin } from '@crewx/sdk/hooks';
import type { HookContext, HookResult } from '@crewx/sdk/hooks';

const SECRET_PATTERNS = ['.env', 'credentials.json', 'service-account-key.json'];

const SHELL_TOOL_NAMES = new Set(['Bash', 'shell', 'local_shell']);

export class DenyIfTouchesSecretsPlugin extends HookPlugin {
  readonly name = 'deny-secrets';
  readonly version = '0.1.0';
  readonly capabilities = { required: ['deny'] as const };

  async run(ctx: HookContext): Promise<HookResult> {
    if (!SHELL_TOOL_NAMES.has(ctx.tool.rawName) && ctx.tool.name !== 'shell') {
      return ctx.pass();
    }

    const input = ctx.tool.input as { command?: string } | undefined;
    const command = input?.command;

    if (typeof command !== 'string') {
      return ctx.pass();
    }

    for (const pattern of SECRET_PATTERNS) {
      if (command.includes(pattern)) {
        return ctx.deny('Secrets-related command');
      }
    }

    return ctx.pass();
  }
}
