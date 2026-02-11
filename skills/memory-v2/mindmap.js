#!/usr/bin/env node

/**
 * Memory Mindmap - 기억 간 연결 그래프 관리
 *
 * Usage:
 *   node mindmap.js build <agent_id>                    # 그래프 빌드 (규칙 기반)
 *   node mindmap.js show <agent_id>                     # 그래프 요약 출력
 *   node mindmap.js related <agent_id> <memory_id>      # 연결된 기억 조회
 *   node mindmap.js add <agent_id> <from> <to> [type]   # 수동 연결 추가
 *   node mindmap.js remove <agent_id> <from> <to>       # 연결 제거
 *   node mindmap.js html                                # 공용 HTML 생성 (모든 에이전트)
 *   node mindmap.js open [agent_id]                     # 브라우저에서 마인드맵 열기
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const {
  loadAllEntries: libLoadAllEntries,
  calculateSimilarity: libCalculateSimilarity,
  buildGraph: libBuildGraph,
  generateHtml: libGenerateHtml,
  saveGraph: libSaveGraph,
  loadGraph: libLoadGraph
} = require('../lib/mindmap');

const DATA_DIR = path.join(__dirname, 'data');
const USAGE_LOG = path.join(__dirname, 'usage.log');

// ============ Usage Logging ============

function getLocalTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function logUsage(cmd, agentId, extra) {
  try {
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [mindmap] ${cmd} ${agentId || ''} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Silently fail
  }
}

// ============ Utilities ============

function getAgentDir(agentId) {
  return path.join(DATA_DIR, agentId);
}

function getEntriesDir(agentId) {
  return path.join(getAgentDir(agentId), 'entries');
}

function getGraphPath(agentId) {
  return path.join(getAgentDir(agentId), 'graph.json');
}

function parseArgs(args) {
  const result = { positional: [], options: {} };
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result.options[key] = value || true;
    } else {
      result.positional.push(arg);
    }
  }
  return result;
}

// memory-v2 특화: agentId로 entriesDir 경로 변환 후 lib 함수 호출
function loadAllEntries(agentId) {
  const entriesDir = getEntriesDir(agentId);
  return libLoadAllEntries(entriesDir);
}

function loadGraph(agentId) {
  const graphPath = getGraphPath(agentId);
  return libLoadGraph(graphPath);
}

function saveGraph(agentId, graph) {
  const graphPath = getGraphPath(agentId);
  libSaveGraph(graphPath, graph);
}

// ============ Graph Building ============

// lib의 calculateSimilarity 재사용
const calculateSimilarity = libCalculateSimilarity;

function buildGraph(agentId, options = {}) {
  const entriesDir = getEntriesDir(agentId);

  const graph = libBuildGraph(entriesDir, {
    edgeThreshold: 0.3,
    ...options
  });

  if (!graph) {
    console.log('기억이 없습니다.');
    return null;
  }

  // graph를 agentId 경로에 저장
  saveGraph(agentId, graph);

  return graph;
}

// ============ Commands ============

function cmdBuild(agentId, options = {}) {
  console.log(`🔨 ${agentId} 마인드맵 빌드 중...\n`);

  const graph = buildGraph(agentId, options);

  if (!graph) return;

  console.log(`✅ 마인드맵 빌드 완료!`);
  console.log(`   노드: ${graph.stats.nodeCount}개`);
  console.log(`   엣지: ${graph.stats.edgeCount}개`);
  console.log(`   파일: data/${agentId}/graph.json`);

  // Top connections
  if (graph.edges.length > 0) {
    console.log(`\n📊 주요 연결 (weight 상위 10개):`);
    const topEdges = graph.edges.sort((a, b) => b.weight - a.weight).slice(0, 10);

    const nodeMap = {};
    graph.nodes.forEach(n => nodeMap[n.id] = n.summary);

    for (const edge of topEdges) {
      const fromSummary = (nodeMap[edge.from] || edge.from).slice(0, 25);
      const toSummary = (nodeMap[edge.to] || edge.to).slice(0, 25);
      console.log(`   [${edge.weight}] ${fromSummary}... ↔ ${toSummary}...`);
    }
  }
}

function cmdShow(agentId) {
  const graph = loadGraph(agentId);

  if (!graph.nodes || graph.nodes.length === 0) {
    console.log('마인드맵이 없습니다. 먼저 build 명령을 실행하세요.');
    return;
  }

  console.log(`# ${agentId} 마인드맵\n`);
  console.log(`> 최종 업데이트: ${graph.updated || '-'}`);
  console.log(`> 노드: ${graph.nodes.length}개 | 엣지: ${graph.edges.length}개\n`);

  // Topic clusters
  const byTopic = {};
  for (const node of graph.nodes) {
    const topic = node.topic || 'general';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(node);
  }

  console.log(`## 토픽별 클러스터\n`);
  for (const [topic, nodes] of Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`### ${topic} (${nodes.length}개)`);
    for (const node of nodes.slice(0, 5)) {
      // Count connections for this node
      const connectionCount = graph.edges.filter(e => e.from === node.id || e.to === node.id).length;
      console.log(`- [${node.id}] ${node.summary} (연결: ${connectionCount})`);
    }
    if (nodes.length > 5) {
      console.log(`- ... 외 ${nodes.length - 5}개`);
    }
    console.log('');
  }

  // Hub nodes (most connected)
  const connectionCounts = {};
  for (const edge of graph.edges) {
    connectionCounts[edge.from] = (connectionCounts[edge.from] || 0) + 1;
    connectionCounts[edge.to] = (connectionCounts[edge.to] || 0) + 1;
  }

  const hubs = Object.entries(connectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (hubs.length > 0) {
    console.log(`## 허브 노드 (연결 많은 기억)\n`);
    const nodeMap = {};
    graph.nodes.forEach(n => nodeMap[n.id] = n);

    for (const [id, count] of hubs) {
      const node = nodeMap[id];
      if (node) {
        console.log(`- [${id}] ${node.summary} - ${count}개 연결`);
      }
    }
  }
}

function cmdRelated(agentId, memoryId) {
  const graph = loadGraph(agentId);

  if (!graph.nodes || graph.nodes.length === 0) {
    console.log('마인드맵이 없습니다. 먼저 build 명령을 실행하세요.');
    return;
  }

  const node = graph.nodes.find(n => n.id === memoryId);
  if (!node) {
    console.log(`ID '${memoryId}'를 찾을 수 없습니다.`);
    return;
  }

  console.log(`## 🔗 [${memoryId}] ${node.summary}\n`);
  console.log(`- 토픽: ${node.topic || '-'}`);
  console.log(`- 날짜: ${node.date || '-'}`);
  console.log(`- 태그: ${(node.tags || []).join(', ') || '-'}\n`);

  // Find connected edges
  const connectedEdges = graph.edges.filter(e => e.from === memoryId || e.to === memoryId);

  if (connectedEdges.length === 0) {
    console.log('연결된 기억이 없습니다.');
    return;
  }

  console.log(`### 연결된 기억 (${connectedEdges.length}개)\n`);

  const nodeMap = {};
  graph.nodes.forEach(n => nodeMap[n.id] = n);

  // Sort by weight
  connectedEdges.sort((a, b) => b.weight - a.weight);

  for (const edge of connectedEdges) {
    const otherId = edge.from === memoryId ? edge.to : edge.from;
    const otherNode = nodeMap[otherId];

    if (otherNode) {
      const reasons = edge.reasons.join(', ');
      console.log(`[${edge.weight}] [${otherId}] ${otherNode.summary}`);
      console.log(`    └─ 연결 이유: ${reasons}`);
    }
  }
}

function cmdAdd(agentId, fromId, toId, type = 'manual') {
  const graph = loadGraph(agentId);

  if (!graph.nodes || graph.nodes.length === 0) {
    console.log('마인드맵이 없습니다. 먼저 build 명령을 실행하세요.');
    return;
  }

  // Check if nodes exist
  const fromNode = graph.nodes.find(n => n.id === fromId);
  const toNode = graph.nodes.find(n => n.id === toId);

  if (!fromNode) {
    console.log(`ID '${fromId}'를 찾을 수 없습니다.`);
    return;
  }
  if (!toNode) {
    console.log(`ID '${toId}'를 찾을 수 없습니다.`);
    return;
  }

  // Check if edge already exists
  const existingEdge = graph.edges.find(e =>
    (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
  );

  if (existingEdge) {
    console.log(`이미 연결되어 있습니다: weight ${existingEdge.weight}`);
    return;
  }

  // Add edge
  graph.edges.push({
    from: fromId,
    to: toId,
    type: type,
    weight: 1.0,
    reasons: [type],
    manual: true
  });

  saveGraph(agentId, graph);

  console.log(`✅ 연결 추가 완료!`);
  console.log(`   ${fromNode.summary.slice(0, 30)}...`);
  console.log(`   ↔`);
  console.log(`   ${toNode.summary.slice(0, 30)}...`);
}

function cmdRemove(agentId, fromId, toId) {
  const graph = loadGraph(agentId);

  if (!graph.edges || graph.edges.length === 0) {
    console.log('연결이 없습니다.');
    return;
  }

  const edgeIndex = graph.edges.findIndex(e =>
    (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
  );

  if (edgeIndex === -1) {
    console.log('해당 연결을 찾을 수 없습니다.');
    return;
  }

  graph.edges.splice(edgeIndex, 1);
  saveGraph(agentId, graph);

  console.log(`🗑️ 연결 제거 완료: ${fromId} ↔ ${toId}`);
}

function cmdOpen(agentId) {
  const htmlPath = path.join(__dirname, 'mindmap.html');

  if (!fs.existsSync(htmlPath)) {
    console.log('mindmap.html이 없습니다. 먼저 html 명령을 실행하세요.');
    return;
  }

  const url = `file://${htmlPath}${agentId ? '?agent=' + agentId : ''}`;

  // macOS: Chrome으로 열기 (query param 유지)
  const { execSync } = require('child_process');
  try {
    execSync(`osascript -e 'tell application "Google Chrome" to open location "${url}"'`);
    console.log(`✅ Chrome에서 마인드맵 열기: ${agentId || '전체'}`);
  } catch (e) {
    // Chrome 없으면 Safari로 시도
    try {
      execSync(`osascript -e 'tell application "Safari" to open location "${url}"'`);
      console.log(`✅ Safari에서 마인드맵 열기: ${agentId || '전체'}`);
    } catch (e2) {
      // 기본 open 명령
      execSync(`open "${url}"`);
      console.log(`✅ 기본 브라우저에서 마인드맵 열기: ${agentId || '전체'}`);
    }
  }
}

function cmdHtml() {
  // 모든 에이전트의 graph.json 로드
  if (!fs.existsSync(DATA_DIR)) {
    console.log('data 디렉토리가 없습니다.');
    return;
  }

  const agentDirs = fs.readdirSync(DATA_DIR).filter(name => {
    const dirPath = path.join(DATA_DIR, name);
    return fs.statSync(dirPath).isDirectory();
  });

  const agentGraphs = {};
  let totalNodes = 0;
  let totalEdges = 0;

  for (const agentId of agentDirs) {
    const graph = loadGraph(agentId);
    if (graph.nodes && graph.nodes.length > 0) {
      agentGraphs[agentId] = graph;
      totalNodes += graph.nodes.length;
      totalEdges += graph.edges.length;
    }
  }

  if (Object.keys(agentGraphs).length === 0) {
    console.log('마인드맵이 없습니다. 먼저 build 명령을 실행하세요.');
    return;
  }

  // lib의 generateHtml 사용
  const htmlContent = libGenerateHtml(agentGraphs, {
    title: 'Memory Mindmap - All Agents'
  });

  if (!htmlContent) {
    console.log('HTML 생성 실패');
    return;
  }

  const htmlPath = path.join(__dirname, 'mindmap.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

  console.log(`✅ 공용 마인드맵 시각화 생성 완료!`);
  console.log(`   파일: skills/memory-v2/mindmap.html`);
  console.log(`   에이전트: ${Object.keys(agentGraphs).length}개`);
  console.log(`   전체 노드: ${totalNodes}개 | 전체 엣지: ${totalEdges}개`);
  console.log(`\n브라우저에서 열기: open ${htmlPath}`);
}

// ============ Main ============

function main() {
  const args = process.argv.slice(2);
  const { positional, options } = parseArgs(args);
  const [command, agentId, ...rest] = positional;

  if (!command) {
    console.log('Usage: node mindmap.js <command> [args]');
    console.log('');
    console.log('Commands:');
    console.log('  build <agent_id>              - 마인드맵 빌드 (규칙 기반)');
    console.log('  show <agent_id>               - 마인드맵 요약 출력');
    console.log('  related <agent_id> <id>       - 연결된 기억 조회');
    console.log('  add <agent_id> <from> <to>    - 수동 연결 추가');
    console.log('  remove <agent_id> <from> <to> - 연결 제거');
    console.log('  html                          - 공용 시각화 HTML 생성 (모든 에이전트)');
    console.log('  open [agent_id]               - 브라우저에서 마인드맵 열기');
    process.exit(1);
  }

  logUsage(command, agentId, rest.join(' '));

  switch (command) {
    case 'build':
      if (!agentId) {
        console.log('Error: agent_id is required');
        process.exit(1);
      }
      cmdBuild(agentId, options);
      break;

    case 'show':
      if (!agentId) {
        console.log('Error: agent_id is required');
        process.exit(1);
      }
      cmdShow(agentId);
      break;

    case 'related':
      if (!agentId || !rest[0]) {
        console.log('Error: agent_id and memory_id are required');
        process.exit(1);
      }
      cmdRelated(agentId, rest[0]);
      break;

    case 'add':
      if (!agentId || !rest[0] || !rest[1]) {
        console.log('Error: agent_id, from_id and to_id are required');
        process.exit(1);
      }
      cmdAdd(agentId, rest[0], rest[1], rest[2]);
      break;

    case 'remove':
      if (!agentId || !rest[0] || !rest[1]) {
        console.log('Error: agent_id, from_id and to_id are required');
        process.exit(1);
      }
      cmdRemove(agentId, rest[0], rest[1]);
      break;

    case 'html':
      cmdHtml();
      break;

    case 'open':
      cmdOpen(agentId);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// CLI로 직접 실행할 때만 main() 호출
if (require.main === module) {
  main();
}

// 다른 모듈에서 import 가능하도록 export
module.exports = { buildGraph };
