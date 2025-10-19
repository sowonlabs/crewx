/**
 * Basic example of using createCrewxAgent from the SDK.
 * This demonstrates the public API as specified in requirements-monorepo.md
 */

import { createCrewxAgent } from '@sowonai/crewx-sdk';

async function main() {
  console.log('Creating CrewX agent...\n');

  // Create agent with configuration
  const { agent, onEvent } = await createCrewxAgent({
    provider: {
      namespace: 'cli',
      id: 'codex',
      apiKey: process.env.CODEX_TOKEN,
    },
    enableCallStack: true,
    defaultAgentId: 'example-agent',
  });

  // Subscribe to call stack updates
  onEvent('callStackUpdated', (stack) => {
    console.log(
      'Call Stack:',
      stack.map((frame) => `${frame.depth}: ${frame.agentId} (${frame.mode})`),
    );
  });

  // Subscribe to agent lifecycle events
  onEvent('agentStarted', ({ agentId, mode }) => {
    console.log(`\n→ Agent ${agentId} started (${mode} mode)`);
  });

  onEvent('agentCompleted', ({ agentId, success }) => {
    console.log(`← Agent ${agentId} completed (success: ${success})\n`);
  });

  // Example 1: Query (read-only)
  console.log('=== Example 1: Query Mode ===');
  const queryResult = await agent.query({
    prompt: 'What is the current project status?',
    context: [
      '## Current Task',
      '- Working on WBS-8: SDK Public API',
      '- Implementing createCrewxAgent function',
    ].join('\n'),
    messages: [
      {
        id: 'msg-1',
        text: 'What were we working on yesterday?',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        isAssistant: false,
      },
      {
        id: 'msg-2',
        text: 'Yesterday we completed WBS-6 documentation.',
        timestamp: new Date(Date.now() - 86400000 + 1000).toISOString(),
        isAssistant: true,
      },
    ],
  });

  console.log('Query Result:');
  console.log('- Success:', queryResult.success);
  console.log('- Content:', queryResult.content);
  console.log('- Metadata:', queryResult.metadata);

  // Example 2: Execute (write mode)
  console.log('\n=== Example 2: Execute Mode ===');
  const executeResult = await agent.execute({
    prompt: 'Create a summary of completed WBS tasks',
    context: 'Project: CrewX Monorepo Migration',
  });

  console.log('Execute Result:');
  console.log('- Success:', executeResult.success);
  console.log('- Content:', executeResult.content);

  // Example 3: Access call stack
  console.log('\n=== Example 3: Call Stack ===');
  const callStack = agent.getCallStack();
  console.log('Final call stack:', callStack);

  console.log('\n✓ All examples completed successfully!');
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
