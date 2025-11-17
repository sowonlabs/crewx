#!/usr/bin/env node
/**
 * Direct SDK test for OpenRouter integration
 *
 * Usage:
 *   OPENROUTER_API_KEY=your-key node test-openrouter-sdk.js
 */

const { MastraAPIProvider } = require('./packages/sdk/dist/index.js');

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not set');
    console.error('Usage: OPENROUTER_API_KEY=your-key node test-openrouter-sdk.js');
    process.exit(1);
  }

  console.log('🚀 Testing OpenRouter integration via SDK...\n');

  const config = {
    provider: 'api/openai',
    url: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    model: 'z-ai/glm-4.5-air:free',
    temperature: 0.7,
    maxTokens: 500,
  };

  const provider = new MastraAPIProvider(config);

  console.log('✅ Provider created');
  console.log(`   Name: ${provider.name}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   URL: ${config.url}\n`);

  // Test 1: Simple math question
  console.log('📝 Test 1: Simple math question');
  const result1 = await provider.query('What is 7 + 5? Answer with only the number.');

  console.log(`   Success: ${result1.success}`);
  console.log(`   Content: ${result1.content}`);
  console.log(`   Model: ${result1.model}`);
  console.log(`   Provider: ${result1.provider}\n`);

  if (!result1.success) {
    console.error('❌ Test 1 failed');
    process.exit(1);
  }

  // Test 2: Simple greeting
  console.log('📝 Test 2: Simple greeting');
  const result2 = await provider.query('Say "Hello from OpenRouter SDK test!"');

  console.log(`   Success: ${result2.success}`);
  console.log(`   Content: ${result2.content.substring(0, 100)}...`);
  console.log(`   Model: ${result2.model}\n`);

  if (!result2.success) {
    console.error('❌ Test 2 failed');
    process.exit(1);
  }

  console.log('✅ All tests passed!');
  console.log('\n🎉 OpenRouter integration working via SDK!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
