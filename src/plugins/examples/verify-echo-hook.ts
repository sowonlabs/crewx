#!/usr/bin/env npx tsx
/**
 * Phase 0 e2e verification — EchoHookPlugin logs Claude Code tool calls.
 *
 * Run: npx tsx packages/cli/src/plugins/examples/verify-echo-hook.ts
 * Prereq: claude CLI installed, crewx.yaml with @claude agent
 */

import { Crewx } from '@crewx/sdk';
import { EchoHookPlugin } from './echo-hook';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_PATH = join(homedir(), '.crewx', 'logs', 'echo-hook.log');

async function main() {
  if (existsSync(LOG_PATH)) unlinkSync(LOG_PATH);

  const crewx = await Crewx.loadYaml('crewx.yaml');
  await crewx.use(new EchoHookPlugin());

  console.log('[verify] querying @claude with "ls"...');
  await crewx.query('@claude', 'Run ls in the current directory. Use the Bash tool.');

  await crewx.close();

  if (!existsSync(LOG_PATH)) {
    console.error('[FAIL] echo-hook.log not created');
    process.exit(1);
  }

  const lines = readFileSync(LOG_PATH, 'utf8').trim().split('\n');
  const entries = lines.map((l) => JSON.parse(l));

  const hasBeforeTool = entries.some((e) => e.event === 'beforeTool');
  const hasTraceId    = entries.every((e) => e.traceId?.startsWith('tsk_'));
  const hasToolName   = entries
    .filter((e) => e.event === 'beforeTool')
    .every((e) => typeof e.tool?.rawName === 'string' && e.tool.rawName.length > 0);

  console.log(`[verify] entries: ${entries.length}`);
  console.log(`[verify] beforeTool: ${hasBeforeTool}`);
  console.log(`[verify] traceId:    ${hasTraceId}`);
  console.log(`[verify] toolName:   ${hasToolName}`);

  if (hasBeforeTool && hasTraceId && hasToolName) {
    console.log('[PASS] Phase 0 e2e verification passed');
  } else {
    console.error('[FAIL] Some checks failed');
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
