/**
 * crewx execute handler.
 * Parses args, loads config via Crewx SDK, and executes the task.
 *
 * Flags:
 *   --thread <name>          Conversation thread name
 *   --provider <cli/xxx>     Provider override
 *   --metadata <json>        Extra metadata JSON (double-quoted object). Propagated to events/hooks/tracing.
 *                           e.g. --metadata='{"workflow_id":"wf-1"}'
 *   --verbose                Debug output mode (default: raw agent response only)
 *   --config/-c <path>       Config file path override
 *   --output-format <fmt>    Output format (json|text|stream-json)
 *   --effort <level>         Model effort (high|medium|low)
 */

import { setAuditVerbose } from '@crewx/sdk';
import { parseAgentMessage } from './parse-agent-message';
import { parseCommonFlags, parseMetadata } from './parse-common-flags';
import { createCliCrewx } from '../bootstrap/crewx-cli';

/**
 * Handle `crewx execute <agentRef> <message>` command.
 *
 * Default output: raw agent response only (stdout).
 * --verbose: debug info written to stderr, response to stdout.
 */
export async function handleExecute(args: string[]): Promise<void> {
  const { thread, provider, metadata, verbose, config, outputFormat, effort, rest } = parseCommonFlags(args);

  const { agentRef: parsedAgentRef, message } = parseAgentMessage(rest);

  // No @mention → default to @crewx agent (matches cli-bak behaviour)
  const agentRef = parsedAgentRef || '@crewx';

  if (!message) {
    console.error('Usage: crewx execute [@agent] <task> [options]');
    console.error('       crewx x [@agent] <task> [options]');
    console.error('');
    console.error('  @agent is optional. Defaults to @crewx when omitted.');
    console.error('');
    console.error('Options:');
    console.error('  --thread <name>        Conversation thread name');
    console.error('  --provider <cli/xxx>   Provider override');
    console.error('  --metadata <json>      Extra metadata (JSON object, double-quoted).');
    console.error('                         Propagated to events/hooks/tracing.');
    console.error('                         Invalid JSON aborts with exit code 2.');
    console.error('                         e.g. --metadata=\'{"workflow_id":"wf-1"}\'');
    console.error('  --verbose              Debug output mode');
    console.error('  --config/-c <path>     Config file path');
    console.error('  --output-format <fmt>  Output format (json|text|stream-json)');
    console.error('  --effort <level>       Model effort (high|medium|low)');
    process.exit(1);
  }

  const configPath = config ?? process.env.CREWX_CONFIG ?? 'crewx.yaml';

  // Only show exec audit span JSON in verbose mode
  setAuditVerbose(verbose);

  const crewx = await createCliCrewx(configPath);
  // file:// remote agent delegation is handled transparently inside Crewx.query/execute.

  if (verbose) {
    process.stderr.write(`📋 Task: ${message}\n`);
    process.stderr.write(`🤖 Agent: ${agentRef}\n`);
    if (thread) process.stderr.write(`🔗 Thread: ${thread}\n`);
    if (provider) process.stderr.write(`🔌 Provider: ${provider}\n`);
    if (outputFormat) process.stderr.write(`📄 Output-format: ${outputFormat}\n`);
    if (effort) process.stderr.write(`⚡ Effort: ${effort}\n`);
    process.stderr.write('─'.repeat(60) + '\n');
  }

  let parsedMetadata: Record<string, unknown> = {};
  try {
    parsedMetadata = parseMetadata(metadata);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(2);
  }

  let exitCode = 0;
  try {
    const result = await crewx.execute(agentRef, message, {
      provider,
      threadId: thread,
      metadata: Object.keys(parsedMetadata).length > 0 ? parsedMetadata : undefined,
    });

    if (!result.ok) {
      const errMsg = result.error?.message ?? 'Execute failed';
      console.error(errMsg);
      exitCode = 1;
    } else {
      if (verbose) {
        process.stderr.write(`\n📊 Results from ${agentRef}:\n`);
        process.stderr.write('═'.repeat(60) + '\n');
        process.stderr.write('🟢 Status: Success\n');
        process.stderr.write(`🤖 Provider: ${result.meta.provider}\n`);
        process.stderr.write(`⏱️  Duration: ${result.meta.durationMs}ms\n`);
        process.stderr.write('\n📄 Response:\n');
        process.stderr.write('─'.repeat(40) + '\n');
      }

      console.log(result.data);

      if (verbose) {
        process.stderr.write('\n✅ Execute completed successfully\n');
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${errMsg}`);
    exitCode = 1;
  } finally {
    await crewx.close();
  }

  if (exitCode !== 0) process.exit(exitCode);
}
