/**
 * 마인드맵 공용 모듈
 *
 * memory-v2의 마인드맵 로직을 범용적으로 사용할 수 있도록 추출한 모듈
 *
 * Usage:
 *   const { buildGraph, generateHtml } = require('./mindmap.js');
 *
 *   // 그래프 빌드
 *   const graph = buildGraph('./entries', {
 *     edgeThreshold: 0.3,
 *     onProgress: (current, total) => console.log(`${current}/${total}`)
 *   });
 *
 *   // HTML 생성
 *   const html = generateHtml({ agentId: graph });
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

/**
 * 마크다운 폴더에서 모든 엔트리 로드
 * @param {String} entriesDir - 마크다운 파일이 있는 디렉토리
 * @returns {Array} 파싱된 엔트리 배열
 */
function loadAllEntries(entriesDir) {
  if (!fs.existsSync(entriesDir)) return [];

  const files = fs.readdirSync(entriesDir).filter(f => f.endsWith('.md'));
  const entries = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(entriesDir, file), 'utf-8');
    const { data, content } = matter(raw);
    entries.push({ file, content, ...data });
  }

  return entries;
}

/**
 * 두 엔트리 간 유사도 계산 (규칙 기반)
 * @param {Object} entry1 - 첫 번째 엔트리
 * @param {Object} entry2 - 두 번째 엔트리
 * @param {Object} options - 옵션
 * @param {Boolean} options.includeSameDay - same-day 연결 포함 여부 (기본: false)
 * @returns {Array} 연결 엣지 배열 (type, weight 포함)
 */
function calculateSimilarity(entry1, entry2, options = {}) {
  const { includeSameDay = false } = options;
  const edges = [];

  // 1. 같은 topic → 강한 연결
  if (entry1.topic && entry1.topic === entry2.topic && entry1.topic !== 'general') {
    edges.push({ type: 'same-topic', weight: 0.7 });
  }

  // 2. 공통 tags → 중간 연결 (가중치 상향)
  const tags1 = new Set(entry1.tags || []);
  const tags2 = new Set(entry2.tags || []);
  const commonTags = [...tags1].filter(t => tags2.has(t));

  if (commonTags.length > 0) {
    // 공통 태그 수에 따라 가중치 증가 (1개=0.4, 2개=0.6, 3개+=0.8)
    const weight = Math.min(0.4 + (commonTags.length - 1) * 0.2, 0.8);
    edges.push({ type: 'shared-tags', weight, tags: commonTags });
  }

  // 3. 같은 날짜 → 약한 연결 (옵션으로 제어, 기본 OFF)
  if (includeSameDay && entry1.date === entry2.date) {
    edges.push({ type: 'same-day', weight: 0.3 });
  }

  // 4. 같은 카테고리 → 약한 연결
  if (entry1.category && entry1.category === entry2.category && entry1.category !== 'general') {
    edges.push({ type: 'same-category', weight: 0.2 });
  }

  return edges;
}

/**
 * 마크다운 폴더에서 그래프 빌드
 * @param {String} entriesDir - 마크다운 파일이 있는 디렉토리
 * @param {Object} options - 빌드 옵션
 * @param {Number} options.edgeThreshold - 엣지 저장 최소 weight (기본: 0.3)
 * @param {Boolean} options.includeSameDay - same-day 연결 포함 여부 (기본: false)
 * @param {Function} options.onProgress - 진행 콜백 (current, total)
 * @param {Function} options.calculateSimilarity - 커스텀 유사도 계산 함수
 * @returns {Object|null} { nodes, edges, stats } 또는 null (엔트리 없음)
 */
function buildGraph(entriesDir, options = {}) {
  const {
    edgeThreshold = 0.3,
    includeSameDay = false,
    onProgress = null,
    calculateSimilarity: customSimilarity = null
  } = options;

  const entries = loadAllEntries(entriesDir);

  if (entries.length === 0) {
    return null;
  }

  const nodes = entries.map(e => ({
    id: e.id,
    summary: e.summary,
    topic: e.topic,
    date: e.date,
    tags: e.tags || []
  }));

  const edges = [];
  const similarityOpts = { includeSameDay };

  // 모든 쌍 비교 (O(n^2) but memory count is usually small)
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarities = customSimilarity
        ? customSimilarity(entries[i], entries[j])
        : calculateSimilarity(entries[i], entries[j], similarityOpts);

      if (similarities.length > 0) {
        // 가장 강한 연결만 저장
        const strongest = similarities.reduce((a, b) => a.weight > b.weight ? a : b);
        const totalWeight = similarities.reduce((sum, s) => sum + s.weight, 0);

        if (totalWeight >= edgeThreshold) {
          edges.push({
            from: entries[i].id,
            to: entries[j].id,
            type: strongest.type,
            weight: Math.round(totalWeight * 100) / 100,
            reasons: similarities.map(s => s.type)
          });
        }
      }
    }

    // 진행 콜백 호출
    if (onProgress) {
      onProgress(i + 1, entries.length);
    }
  }

  const graph = {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length
    },
    updated: new Date().toISOString()
  };

  return graph;
}

/**
 * 여러 에이전트의 그래프를 받아 시각화 HTML 생성
 * @param {Object} graphs - { agentId: graph } 형태의 객체
 * @param {Object} options - HTML 생성 옵션
 * @param {Array} options.colors - 토픽별 색상 팔레트
 * @param {String} options.title - HTML 제목 (기본: 'Memory Mindmap')
 * @returns {String} HTML 문자열
 */
function generateHtml(graphs, options = {}) {
  const {
    colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
      '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
    ],
    title = 'Memory Mindmap'
  } = options;

  if (Object.keys(graphs).length === 0) {
    return null;
  }

  let totalNodes = 0;
  let totalEdges = 0;

  // 각 에이전트별 그래프 데이터 변환
  const agentData = {};
  for (const [agentId, graph] of Object.entries(graphs)) {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      continue;
    }

    totalNodes += graph.nodes.length;
    totalEdges += graph.edges.length;

    const topics = [...new Set(graph.nodes.map(n => n.topic || 'general'))];
    const topicColors = {};
    topics.forEach((topic, i) => {
      topicColors[topic] = colors[i % colors.length];
    });

    const nodes = graph.nodes.map(n => {
      const summary = n.summary ? String(n.summary) : (n.id ? String(n.id) : 'Unknown');
      return {
        id: n.id || 'unknown',
        label: summary.slice(0, 40),
        fullLabel: summary,
        topic: n.topic || 'general',
        date: n.date || '-',
        color: topicColors[n.topic || 'general']
      };
    });

    const links = graph.edges.map(e => ({
      source: e.from,
      target: e.to,
      weight: e.weight,
      type: e.type
    }));

    agentData[agentId] = {
      nodes,
      links,
      topics,
      topicColors,
      updated: graph.updated
    };
  }

  const agentOptions = Object.keys(agentData).map(agentId =>
    `<option value="${agentId}">${agentId}</option>`
  ).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      overflow: hidden;
    }
    #graph { width: 100vw; height: 100vh; }
    .node circle {
      cursor: pointer;
      stroke: #fff;
      stroke-width: 1.5px;
      transition: all 0.2s;
    }
    .node circle:hover {
      stroke-width: 3px;
      filter: brightness(1.2);
    }
    .node text {
      font-size: 10px;
      fill: #e0e0e0;
      pointer-events: none;
      text-shadow: 0 0 3px #1a1a2e;
    }
    .link {
      stroke: #4a4a6a;
      stroke-opacity: 0.6;
    }
    .tooltip {
      position: absolute;
      background: #2d2d44;
      border: 1px solid #4a4a6a;
      border-radius: 8px;
      padding: 12px;
      color: #fff;
      font-size: 13px;
      max-width: 300px;
      pointer-events: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 10;
    }
    .tooltip .title { font-weight: bold; margin-bottom: 8px; color: #a5b4fc; }
    .tooltip .meta { color: #9ca3af; font-size: 11px; }
    .controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background: #2d2d44;
      border-radius: 8px;
      padding: 15px;
      color: #fff;
      font-size: 13px;
      min-width: 200px;
      z-index: 5;
    }
    .controls h3 { margin-bottom: 10px; color: #a5b4fc; }
    .controls select {
      width: 100%;
      padding: 8px;
      background: #1a1a2e;
      color: #fff;
      border: 1px solid #4a4a6a;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    .controls select:hover {
      border-color: #6366f1;
    }
    .legend {
      position: absolute;
      top: 100px;
      left: 20px;
      background: #2d2d44;
      border-radius: 8px;
      padding: 15px;
      color: #fff;
      font-size: 12px;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
      z-index: 5;
    }
    .legend h4 { margin-bottom: 8px; color: #a5b4fc; font-size: 11px; }
    .legend-item { display: flex; align-items: center; margin: 4px 0; }
    .legend-color { width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }
    .stats {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: #2d2d44;
      border-radius: 8px;
      padding: 10px 15px;
      color: #9ca3af;
      font-size: 11px;
      z-index: 5;
    }
  </style>
</head>
<body>
  <div id="graph"></div>

  <div class="controls">
    <h3>📊 ${title}</h3>
    <select id="agentSelect">${agentOptions}</select>
  </div>

  <div class="legend" id="legend"></div>

  <div class="stats" id="stats"></div>

  <div class="tooltip" style="display:none"></div>

  <script>
    const agentData = ${JSON.stringify(agentData)};

    // URL 파라미터에서 agent 읽기 (?agent=cto)
    const urlParams = new URLSearchParams(window.location.search);
    const agentFromUrl = urlParams.get('agent');
    let currentAgent = (agentFromUrl && agentData[agentFromUrl]) ? agentFromUrl : Object.keys(agentData)[0];

    let simulation = null;
    let svg = null;
    let g = null;

    const width = window.innerWidth;
    const height = window.innerHeight;

    function initSVG() {
      svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      g = svg.append('g');

      svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)));
    }

    function updateLegend() {
      const data = agentData[currentAgent];
      const items = data.topics.map(t =>
        '<div class="legend-item"><div class="legend-color" style="background:' + data.topicColors[t] + '"></div><span>' + t + '</span></div>'
      ).join('');
      document.getElementById('legend').innerHTML = '<h4>토픽</h4>' + items;
    }

    function updateStats() {
      const data = agentData[currentAgent];
      document.getElementById('stats').innerHTML =
        '에이전트: ' + currentAgent + ' | ' +
        '노드: ' + data.nodes.length + ' | ' +
        '엣지: ' + data.links.length + ' | ' +
        '업데이트: ' + (data.updated ? data.updated.slice(0, 10) : '-');
    }

    function renderGraph() {
      const data = agentData[currentAgent];

      if (simulation) {
        simulation.stop();
      }

      g.selectAll('*').remove();

      const nodes = JSON.parse(JSON.stringify(data.nodes));
      const links = JSON.parse(JSON.stringify(data.links));

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke-width', d => Math.sqrt(d.weight) * 2);

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('circle')
        .attr('r', d => {
          const connections = links.filter(l => l.source.id === d.id || l.target.id === d.id).length;
          return Math.max(6, Math.min(20, 6 + connections));
        })
        .attr('fill', d => d.color);

      node.append('text')
        .attr('dx', 15)
        .attr('dy', 4)
        .text(d => d.label);

      const tooltip = d3.select('.tooltip');

      node.on('mouseover', (event, d) => {
        tooltip.style('display', 'block')
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 10) + 'px')
          .html('<div class="title">' + d.fullLabel + '</div><div class="meta">ID: ' + d.id + '<br>토픽: ' + d.topic + '<br>날짜: ' + d.date + '</div>');
      }).on('mouseout', () => {
        tooltip.style('display', 'none');
      });

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
      });

      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      updateLegend();
      updateStats();
    }

    // DOM 준비 후 모든 초기화 수행
    document.addEventListener('DOMContentLoaded', () => {
      // 드롭다운 동기화
      document.getElementById('agentSelect').value = currentAgent;

      // 드롭다운 변경 이벤트
      document.getElementById('agentSelect').addEventListener('change', (e) => {
        currentAgent = e.target.value;
        // URL 파라미터 업데이트
        const url = new URL(window.location);
        url.searchParams.set('agent', currentAgent);
        history.replaceState({}, '', url);
        renderGraph();
      });

      // 그래프 초기화 및 렌더링
      initSVG();
      renderGraph();
    });
  </script>
</body>
</html>`;

  return htmlContent;
}

/**
 * 그래프를 JSON 파일로 저장
 * @param {String} outputPath - 저장할 파일 경로
 * @param {Object} graph - 저장할 그래프
 */
function saveGraph(outputPath, graph) {
  graph.updated = new Date().toISOString();
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8');
}

/**
 * JSON 파일에서 그래프 로드
 * @param {String} inputPath - 로드할 파일 경로
 * @returns {Object} { nodes, edges, stats, updated }
 */
function loadGraph(inputPath) {
  if (!fs.existsSync(inputPath)) {
    return { nodes: [], edges: [], stats: {}, updated: null };
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
}

module.exports = {
  loadAllEntries,
  calculateSimilarity,
  buildGraph,
  generateHtml,
  saveGraph,
  loadGraph
};
