#!/usr/bin/env node
/**
 * WBS-10 Phase 5: Core Functionality Regression Test
 *
 * Verifies:
 * 1. createCrewxAgent() from SDK
 * 2. loadAgentConfigFromYaml() from SDK
 * 3. runQueriesParallel() from SDK
 */

import { createCrewxAgent, loadAgentConfigFromYaml, runQueriesParallel } from './packages/sdk/dist/index.js';

console.log('🧪 WBS-10 Phase 5: Core Functionality Regression Test\n');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

async function runTests() {
  // Test 1: createCrewxAgent() basic functionality
  await test('createCrewxAgent() - basic agent creation', async () => {
    const config = {
      provider: {
        namespace: 'cli',
        id: 'claude',
      },
    };

    const result = await createCrewxAgent(config);

    if (!result) throw new Error('Result is null or undefined');
    if (!result.agent) throw new Error('Agent is null or undefined');
    if (typeof result.agent.query !== 'function') throw new Error('query method missing');
    if (typeof result.agent.execute !== 'function') throw new Error('execute method missing');
    if (typeof result.onEvent !== 'function') throw new Error('onEvent method missing');
  });

  // Test 2: createCrewxAgent() with knowledge base
  await test('createCrewxAgent() - with knowledge base', async () => {
    const config = {
      provider: {
        namespace: 'cli',
        id: 'gemini',
      },
      knowledgeBase: {
        path: './docs',
      },
    };

    const result = await createCrewxAgent(config);

    if (!result) throw new Error('Result is null or undefined');
    if (!result.agent) throw new Error('Agent is null or undefined');
  });

  // Test 3: loadAgentConfigFromYaml() - basic YAML
  await test('loadAgentConfigFromYaml() - basic agent config', () => {
    const yaml = `agents:
  backend:
    provider: cli/claude
    inline:
      model: claude-3-opus`;

    const config = loadAgentConfigFromYaml(yaml);

    if (!config.defaultAgentId) throw new Error('defaultAgentId missing');
    if (config.defaultAgentId !== 'backend') throw new Error('defaultAgentId incorrect');
    if (!config.provider) throw new Error('provider missing');
    if (config.provider.namespace !== 'cli') throw new Error('provider.namespace incorrect');
    if (config.provider.id !== 'claude') throw new Error('provider.id incorrect');
    if (config.provider.model !== 'claude-3-opus') throw new Error('provider.model incorrect');
  });

  // Test 4: loadAgentConfigFromYaml() - with knowledge base
  await test('loadAgentConfigFromYaml() - with knowledge base', () => {
    const yaml = `agents:
  backend:
    provider: mcp/custom
    knowledgeBase: ./docs`;

    const config = loadAgentConfigFromYaml(yaml);

    if (!config.knowledgeBase) throw new Error('knowledgeBase missing');
    if (config.knowledgeBase.path !== './docs') throw new Error('knowledgeBase.path incorrect');
  });

  // Test 5: loadAgentConfigFromYaml() - error handling
  await test('loadAgentConfigFromYaml() - error on invalid YAML', () => {
    try {
      loadAgentConfigFromYaml('just a string');
      throw new Error('Should have thrown error for invalid YAML');
    } catch (error) {
      if (!error.message.includes('must contain a valid object')) {
        throw new Error('Wrong error message: ' + error.message);
      }
    }
  });

  // Test 6: runQueriesParallel() - function exists
  await test('runQueriesParallel() - function exported', () => {
    if (typeof runQueriesParallel !== 'function') {
      throw new Error('runQueriesParallel is not a function');
    }
  });

  // Test 7: runQueriesParallel() - basic structure
  await test('runQueriesParallel() - accepts request array', async () => {
    // Just verify it accepts proper structure (won't actually execute)
    const requests = [
      {
        agentId: '@test',
        prompt: 'test prompt',
        context: 'test context',
      },
    ];

    // This will fail with "no agent" error, but that's expected
    // We're just verifying the function accepts the structure
    try {
      await runQueriesParallel(requests, { dryRun: true });
    } catch (error) {
      // Expected to fail - we're just checking structure
      if (!error.message.includes('Agent') && !error.message.includes('not found')) {
        // If it's not an "agent not found" error, something else is wrong
        throw error;
      }
    }
  });

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);

  if (failCount > 0) {
    console.log('\n❌ Regression tests FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ All regression tests PASSED');
    process.exit(0);
  }
}

runTests();
