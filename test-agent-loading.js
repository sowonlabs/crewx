#!/usr/bin/env node
/**
 * Test agent loading from YAML
 */

const { parseCrewxConfigFromFile } = require('./packages/sdk/dist/index.js');

async function main() {
  try {
    console.log('🔍 Testing YAML parsing...\n');

    const config = parseCrewxConfigFromFile('./test-openrouter.yaml', {
      validationMode: 'lenient'
    });

    console.log('✅ YAML parsed successfully!');
    console.log(`   Agents found: ${config.agents?.length || 0}\n`);

    if (config.agents && config.agents.length > 0) {
      config.agents.forEach((agent, idx) => {
        console.log(`Agent ${idx + 1}:`);
        console.log(`  ID: ${agent.id}`);
        console.log(`  Name: ${agent.name}`);
        console.log(`  Provider: ${agent.inline?.provider || agent.provider}`);
        console.log(`  Has inline config: ${!!agent.inline}`);
        if (agent.inline) {
          console.log(`  Inline keys: ${Object.keys(agent.inline).join(', ')}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
