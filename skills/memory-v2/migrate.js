#!/usr/bin/env node

/**
 * Migration script: memory v1 (JSON) → memory v2 (Markdown + Frontmatter)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { nanoid } = require('nanoid');

const V1_DATA_DIR = path.join(__dirname, '../memory/data');
const V2_DATA_DIR = path.join(__dirname, 'data');

// Topic inference based on keywords
function inferTopic(content) {
  const contentLower = content.toLowerCase();

  const topicPatterns = [
    { topic: 'vlm-finetuning', keywords: ['vlm', 'finetuning', '파인튜닝', 'qwen', 'unsloth', '합성 데이터', 'synthetic'] },
    { topic: 'observability', keywords: ['observability', 'trace', '추적', 'sqlite'] },
    { topic: 'crewx-strategy', keywords: ['gemini', '전략', 'strategy', 'orchestration', '오케스트레이션', 'governance'] },
    { topic: 'crewx-launcher', keywords: ['launcher', '런처', 'electron', 'gui'] },
    { topic: 'security', keywords: ['cve', 'vulnerability', '취약점', 'injection', '보안', 'security'] },
    { topic: 'wbs', keywords: ['wbs', 'async-worker', '워커'] },
    { topic: 'zero100', keywords: ['제로백', 'zero100', '팝업데이', '세무사', '정찬양'] },
    { topic: 'crewx-dev', keywords: ['template', '템플릿', 'mastra', 'esm', 'windows', 'ci/cd'] },
    { topic: 'organization', keywords: ['에이전트 역할', '@jarvis', '@cso', '@cto', '@crewx_pm', '역할 정의'] },
    { topic: 'memory-skill', keywords: ['메모리 스킬', 'memory skill'] },
    { topic: 'infra', keywords: ['cloudflare', 'tailscale', '인프라', '3090'] },
  ];

  for (const { topic, keywords } of topicPatterns) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return topic;
      }
    }
  }

  return 'general';
}

function generateSlug(content) {
  return content
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
}

function stringifyFrontmatter(data) {
  return matter.stringify('', data).trim();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(agentId) {
  const v1Path = path.join(V1_DATA_DIR, `${agentId}.json`);

  if (!fs.existsSync(v1Path)) {
    console.log(`❌ v1 data not found: ${v1Path}`);
    return;
  }

  const v1Data = JSON.parse(fs.readFileSync(v1Path, 'utf-8'));
  const memories = v1Data.memories || [];

  console.log(`📂 Migrating ${memories.length} memories for ${agentId}...`);

  const entriesDir = path.join(V2_DATA_DIR, agentId, 'entries');
  ensureDir(entriesDir);

  // Clear existing entries
  const existingFiles = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(entriesDir, file));
  }

  let migrated = 0;
  const topicCounts = {};

  for (const mem of memories) {
    const { date, category, content } = mem;
    const id = nanoid(6);  // Generate new nanoid

    // Infer topic
    const topic = inferTopic(content);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    // Generate summary (first 50 chars or full if short)
    const summary = content.length > 80
      ? content.slice(0, 80).replace(/\n/g, ' ') + '...'
      : content.replace(/\n/g, ' ');

    // Generate filename
    const slug = generateSlug(content);
    const filename = `${date}-${slug}.md`;

    // Create frontmatter
    const frontmatter = stringifyFrontmatter({
      id,
      date,
      category: category || 'general',
      tags: [],
      topic,
      summary: summary.slice(0, 100)
    });

    // Create content
    const mdContent = `${frontmatter}\n\n# ${summary.slice(0, 60)}\n\n${content}\n`;

    // Write file
    const filepath = path.join(entriesDir, filename);

    // Handle duplicate filenames
    let finalPath = filepath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalPath = path.join(entriesDir, `${base}-${counter}${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, mdContent, 'utf-8');
    migrated++;
  }

  console.log(`✅ Migrated ${migrated} memories`);
  console.log('\n📊 Topic distribution:');
  for (const [topic, count] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${topic}: ${count}`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`\n💡 Run: node skills/memory-v2/memory-v2.js index ${agentId}`);
}

// Main
const agentId = process.argv[2];
if (!agentId) {
  console.log('Usage: node migrate.js <agent_id>');
  console.log('Example: node migrate.js cto');
  process.exit(1);
}

migrate(agentId);
