#!/usr/bin/env node
/**
 * Debug YAML config loading
 */

const yaml = require('js-yaml');
const fs = require('fs');

const yamlContent = fs.readFileSync('./crewx.yaml', 'utf8');
const config = yaml.load(yamlContent);

console.log('📄 YAML Content:');
console.log(JSON.stringify(config, null, 2));

console.log('\n🔍 Agents:');
if (config.agents) {
  config.agents.forEach((agent, idx) => {
    console.log(`\nAgent ${idx + 1}:`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Name: ${agent.name}`);
    console.log(`  Inline: ${JSON.stringify(agent.inline, null, 4)}`);
  });
} else {
  console.log('  No agents found!');
}
