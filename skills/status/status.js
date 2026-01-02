#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const USAGE_LOG = path.join(__dirname, 'usage.log');

// ============================================================
// Utility Functions
// ============================================================

function getLocalTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function logUsage(cmd, extra) {
  try {
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [status] ${cmd} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Ignore logging errors
  }
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null; // Return null on error for proper handling
  }
}

function checkGhCli() {
  // Check if gh is installed
  try {
    execSync('which gh', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('❌ Error: GitHub CLI (gh) is not installed.');
    console.error('   Install with: brew install gh');
    process.exit(1);
  }

  // Check if gh is authenticated
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('❌ Error: GitHub CLI (gh) is not authenticated.');
    console.error('   Login with: gh auth login');
    process.exit(1);
  }
}

function countLines(str) {
  if (!str || str === '(없음)') return 0;
  return str.split('\n').filter(line => line.trim()).length;
}

// ============================================================
// Git Functions
// ============================================================

function getCurrentBranch() {
  return exec('git branch --show-current') || '(unknown)';
}

function getUnpushedCommits() {
  const count = exec('git rev-list --count @{u}..HEAD 2>/dev/null');
  return parseInt(count) || 0;
}

function getWorktreeList() {
  const result = exec('git worktree list --porcelain');
  if (!result) return [];

  const worktrees = [];
  const lines = result.split('\n');
  let current = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.replace('worktree ', '') };
    } else if (line.startsWith('branch ')) {
      current.branch = line.replace('branch refs/heads/', '');
    }
  }
  if (current.path) worktrees.push(current);

  // Filter out main directory
  return worktrees.filter(w => w.path.includes('/worktree/'));
}

// ============================================================
// GitHub Issue Functions
// ============================================================

function getInProgressIssues() {
  const cmd = `gh issue list --label "status:in-progress" --state open --json number,title,labels --jq '.[] | "#\\(.number) \\(.title) [\\([.labels[].name] | map(select(startswith("worker:"))) | .[0] // "unassigned")]"'`;
  const result = exec(cmd);
  return result || null;
}

function getResolvedIssues() {
  const cmd = `gh issue list --label "status:resolved" --state open --json number,title,labels --jq '.[] | "#\\(.number) \\(.title) [\\([.labels[].name] | map(select(startswith("worker:"))) | .[0] // "-")]"'`;
  const result = exec(cmd);
  return result || null;
}

function getTriageIssues() {
  // Issues without status label (new/unprocessed)
  const cmd = `gh issue list --state open --json number,title,labels --jq '[.[] | select(.labels | map(.name) | all(startswith("status:") | not))] | .[:5] | .[] | "#\\(.number) \\(.title)"'`;
  const result = exec(cmd);
  return result || null;
}

function getReleaseIssues(version) {
  const cmd = `gh issue list --label "target_release:${version}" --state open --json number,title,labels --jq '.[] | "#\\(.number) \\(.title) [\\([.labels[].name] | map(select(startswith("status:"))) | .[0] // "open")]"'`;
  const result = exec(cmd);
  return result || null;
}

function getResolvedWithPR() {
  // Get resolved issues, then check which have PRs
  const issuesCmd = `gh issue list --label "status:resolved" --state open --json number,title`;
  const issuesResult = exec(issuesCmd);
  if (!issuesResult) return { withPR: [], withoutPR: [], merged: [] };

  const issues = JSON.parse(issuesResult);
  const withPR = [];
  const withoutPR = [];
  const merged = [];

  // Get all open PRs and merged PRs
  const openPRsCmd = `gh pr list --state open --json number,title`;
  const mergedPRsCmd = `gh pr list --state merged --limit 20 --json number,title`;

  const openPRs = JSON.parse(exec(openPRsCmd) || '[]');
  const mergedPRs = JSON.parse(exec(mergedPRsCmd) || '[]');

  for (const issue of issues) {
    // Match PR by title pattern: "(#XX)" or "#XX:" at the start
    const pattern = new RegExp(`[#(]${issue.number}[):]`);

    const openPR = openPRs.find(pr => pattern.test(pr.title));
    const mergedPR = mergedPRs.find(pr => pattern.test(pr.title));

    if (openPR) {
      withPR.push({ ...issue, prNumber: openPR.number, prState: 'open' });
    } else if (mergedPR) {
      merged.push({ ...issue, prNumber: mergedPR.number, prState: 'merged' });
    } else {
      withoutPR.push(issue);
    }
  }

  return { withPR, withoutPR, merged };
}

// ============================================================
// GitHub PR Functions
// ============================================================

function getOpenPRs() {
  // Include CI status and review decision
  const cmd = `gh pr list --state open --json number,title,headRefName,statusCheckRollup,reviewDecision --jq '.[] | "PR #\\(.number) \\(.title) (\\(.headRefName)) [\\(if .statusCheckRollup then (.statusCheckRollup | map(.conclusion) | if all(. == "SUCCESS") then "PASS" elif any(. == "FAILURE") then "FAIL" else "PENDING" end) else "-" end)] [\\(.reviewDecision // "-")]"'`;
  const result = exec(cmd);

  // Fallback to simple format if complex query fails
  if (!result) {
    const fallbackCmd = `gh pr list --state open --json number,title,headRefName --jq '.[] | "PR #\\(.number) \\(.title) (\\(.headRefName))"'`;
    return exec(fallbackCmd) || null;
  }
  return result;
}

function getRecentMergedPRs() {
  const cmd = `gh pr list --state merged --limit 3 --json number,title,mergedAt --jq '.[] | "PR #\\(.number) \\(.title) (\\(.mergedAt | split("T")[0]))"'`;
  const result = exec(cmd);
  return result || null;
}

// ============================================================
// Display Functions
// ============================================================

function showSummary(inProgress, resolved, prs, triage) {
  const inProgressCount = countLines(inProgress);
  const resolvedCount = countLines(resolved);
  const prCount = countLines(prs);
  const triageCount = countLines(triage);

  console.log(`📊 요약: 진행 ${inProgressCount} | 완료대기 ${resolvedCount} | PR ${prCount} | 신규 ${triageCount}`);
  console.log('');
}

function showSection(title, content, showEmpty = true) {
  console.log(`## ${title}`);
  if (content) {
    console.log(content);
  } else if (showEmpty) {
    console.log('(없음)');
  }
  console.log('');
}

function showWorktrees(worktrees) {
  if (worktrees.length === 0) return;

  console.log('## 활성 Worktree');
  for (const wt of worktrees) {
    const dir = wt.path.split('/').pop();
    console.log(`${dir} → ${wt.branch || '(detached)'}`);
  }
  console.log('');
}

function detectReleaseVersion(branch) {
  const match = branch.match(/release\/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

// ============================================================
// Main Display Functions
// ============================================================

function showFullStatus(options = {}) {
  const branch = getCurrentBranch();
  const unpushed = getUnpushedCommits();
  const releaseVersion = detectReleaseVersion(branch);

  const inProgress = getInProgressIssues();
  const resolved = getResolvedIssues();
  const prs = getOpenPRs();
  const triage = getTriageIssues();
  const worktrees = getWorktreeList();

  // JSON output
  if (options.json) {
    const data = {
      branch,
      unpushed,
      releaseVersion,
      issues: {
        inProgress: inProgress ? inProgress.split('\n') : [],
        resolved: resolved ? resolved.split('\n') : [],
        triage: triage ? triage.split('\n') : []
      },
      prs: prs ? prs.split('\n') : [],
      worktrees
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Text output
  console.log('# CrewX 프로젝트 상태\n');
  console.log(`브랜치: ${branch}`);
  if (unpushed > 0) {
    console.log(`미푸시 커밋: ${unpushed}개`);
  }
  if (releaseVersion) {
    console.log(`릴리스: v${releaseVersion}`);
  }
  console.log('');

  // Summary
  showSummary(inProgress, resolved, prs, triage);

  // Sections
  showSection('진행 중 (in-progress)', inProgress);
  showSection('완료 대기 (resolved)', resolved);
  showSection('신규/미분류 (triage)', triage);
  showSection('열린 PR', prs);

  // Worktrees
  showWorktrees(worktrees);

  // Auto-show release issues if on release branch
  if (releaseVersion) {
    const releaseIssues = getReleaseIssues(releaseVersion);
    if (releaseIssues) {
      showSection(`Release ${releaseVersion} 이슈`, releaseIssues);
    }
  }

  console.log('---');
  console.log('Source: GitHub (single source of truth)');
}

function showHelp() {
  console.log(`Usage: node status.js [command] [args] [options]

Commands:
  (none)        전체 상태 조회
  in-progress   진행 중인 이슈
  resolved      완료된 이슈 (PR/머지 대기)
  review        PR 있는/없는 이슈 구분 (리뷰 대기 현황)
  triage        신규/미분류 이슈
  prs           열린 PR 목록
  release <ver> 특정 릴리스 타겟 이슈
  worktrees     활성 worktree 목록
  merged        최근 머지된 PR

Options:
  --json        JSON 형식으로 출력

Examples:
  node status.js
  node status.js --json
  node status.js review
  node status.js release 0.8.0
`);
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--'));
const options = {
  json: args.includes('--json')
};

// Check gh CLI before running (except for help)
if (command !== 'help' && command !== '--help' && command !== '-h' && command !== 'worktrees') {
  checkGhCli();
}

// Log usage
logUsage(command || 'all', options.json ? '--json' : '');

switch (command) {
  case undefined:
  case 'all':
    showFullStatus(options);
    break;

  case 'in-progress':
    const inProgress = getInProgressIssues();
    console.log('## 진행 중 (in-progress)');
    console.log(inProgress || '(없음)');
    break;

  case 'resolved':
    const resolved = getResolvedIssues();
    console.log('## 완료 대기 (resolved)');
    console.log(resolved || '(없음)');
    break;

  case 'review':
    console.log('## 리뷰 대기 현황\n');
    console.log('PR 확인 중...');
    const { withPR, withoutPR, merged } = getResolvedWithPR();
    console.log('\x1b[2K\x1b[1A'); // Clear "확인 중" line

    console.log(`### ✅ PR 열림 (리뷰/머지 대기) - ${withPR.length}건`);
    if (withPR.length > 0) {
      for (const issue of withPR) {
        console.log(`#${issue.number} ${issue.title} → PR #${issue.prNumber}`);
      }
    } else {
      console.log('(없음)');
    }
    console.log('');

    console.log(`### 🎉 PR 머지됨 (이슈 닫아도 됨) - ${merged.length}건`);
    if (merged.length > 0) {
      for (const issue of merged) {
        console.log(`#${issue.number} ${issue.title} → PR #${issue.prNumber} (merged)`);
      }
    } else {
      console.log('(없음)');
    }
    console.log('');

    console.log(`### ⚠️ PR 없음 (확인 필요) - ${withoutPR.length}건`);
    if (withoutPR.length > 0) {
      for (const issue of withoutPR) {
        console.log(`#${issue.number} ${issue.title}`);
      }
    } else {
      console.log('(없음)');
    }
    break;

  case 'triage':
    const triage = getTriageIssues();
    console.log('## 신규/미분류 (triage)');
    console.log(triage || '(없음)');
    break;

  case 'prs':
    const prs = getOpenPRs();
    console.log('## 열린 PR');
    console.log(prs || '(없음)');
    break;

  case 'merged':
    const recentMerged = getRecentMergedPRs();
    console.log('## 최근 머지된 PR');
    console.log(recentMerged || '(없음)');
    break;

  case 'worktrees':
    const worktrees = getWorktreeList();
    console.log('## 활성 Worktree');
    if (worktrees.length === 0) {
      console.log('(없음)');
    } else {
      for (const wt of worktrees) {
        const dir = wt.path.split('/').pop();
        console.log(`${dir} → ${wt.branch || '(detached)'}`);
      }
    }
    break;

  case 'release':
    const version = args.find(a => a !== 'release' && !a.startsWith('--'));
    if (!version) {
      // Auto-detect from current branch
      const branch = getCurrentBranch();
      const detected = detectReleaseVersion(branch);
      if (detected) {
        console.log(`## Release ${detected} 이슈 (auto-detected)`);
        console.log(getReleaseIssues(detected) || '(없음)');
      } else {
        console.error('Error: version required. Example: node status.js release 0.8.0');
        process.exit(1);
      }
    } else {
      console.log(`## Release ${version} 이슈`);
      console.log(getReleaseIssues(version) || '(없음)');
    }
    break;

  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
