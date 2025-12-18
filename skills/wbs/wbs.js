#!/usr/bin/env node

/**
 * WBS Coordinator
 *
 * State management + Worker execution for Work Breakdown Structure.
 * AI agents make intelligent decisions; this code handles CRUD + execution.
 */

const alasql = require('alasql');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Data file for persistence
const DATA_FILE = path.join(__dirname, '.wbs-data.json');
const USAGE_LOG = path.join(__dirname, 'usage.log');
const DAEMON_PID_FILE = path.join(__dirname, '.daemon.pid');
const DAEMON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ZOMBIE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Get project root (git root) for running crewx commands
function getProjectRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Fallback to parent of skills directory
    return path.resolve(__dirname, '../..');
  }
}

// Log facade calls
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
    const dataDir = path.dirname(USAGE_LOG);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const timestamp = getLocalTimestamp();
    const logLine = `${timestamp} | [wbs.js] ${cmd} ${extra || ''}\n`;
    fs.appendFileSync(USAGE_LOG, logLine);
  } catch (e) {
    // Silently fail
  }
}

// Initialize database
function initDB() {
  alasql('CREATE TABLE IF NOT EXISTS wbs (id STRING PRIMARY KEY, title STRING, detail_path STRING, status STRING, created_at STRING)');
  alasql('CREATE TABLE IF NOT EXISTS jobs (id STRING PRIMARY KEY, wbs_id STRING, title STRING, description STRING, agent STRING, status STRING, seq INT, created_at STRING, completed_at STRING, issue_number INT)');
  alasql('CREATE TABLE IF NOT EXISTS executions (id STRING PRIMARY KEY, job_id STRING, pid INT, status STRING, started_at STRING, ended_at STRING, exit_code INT, error STRING)');

  // Load persisted data if exists
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (data.wbs && data.wbs.length > 0) {
        data.wbs.forEach(w => {
          alasql('INSERT INTO wbs VALUES (?, ?, ?, ?, ?)', [w.id, w.title, w.detail_path || null, w.status, w.created_at]);
        });
      }
      if (data.jobs && data.jobs.length > 0) {
        data.jobs.forEach(j => {
          alasql('INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [j.id, j.wbs_id, j.title, j.description || null, j.agent, j.status, j.seq, j.created_at, j.completed_at, j.issue_number || null]);
        });
      }
      if (data.executions && data.executions.length > 0) {
        data.executions.forEach(e => {
          alasql('INSERT INTO executions VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [e.id, e.job_id, e.pid, e.status, e.started_at, e.ended_at, e.exit_code, e.error]);
        });
      }
    } catch (e) {
      console.error('Warning: Could not load persisted data:', e.message);
    }
  }
}

// Track running processes for kill functionality
const runningProcesses = new Map();

// Helper functions for sequential ID generation
function getNextWbsId() {
  const result = alasql("SELECT MAX(CAST(SUBSTR(id, 5) AS INT)) as max FROM wbs")[0];
  const maxId = result.max || 0;
  return `wbs-${maxId + 1}`;
}

function getNextJobId() {
  const result = alasql("SELECT MAX(CAST(SUBSTR(id, 5) AS INT)) as max FROM jobs")[0];
  const maxId = result.max || 0;
  return `job-${maxId + 1}`;
}

function getNextExecId() {
  const result = alasql("SELECT MAX(CAST(SUBSTR(id, 6) AS INT)) as max FROM executions")[0];
  const maxId = result.max || 0;
  return `exec-${maxId + 1}`;
}

// Save data to file
function saveData() {
  const data = {
    wbs: alasql('SELECT * FROM wbs'),
    jobs: alasql('SELECT * FROM jobs'),
    executions: alasql('SELECT * FROM executions')
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Initialize on module load
initDB();

const wbs = {
  /**
   * Create a new WBS project
   * @param {string} title - Project title
   * @param {object} [options] - Project options
   * @param {string} [options.detailPath] - Path to detail document (e.g., wbs/wbs-xxx-detail.md)
   * @returns {string} Project ID
   */
  create(title, options = {}) {
    const id = getNextWbsId();
    const now = new Date().toISOString();
    const detailPath = options.detailPath || null;
    alasql('INSERT INTO wbs VALUES (?, ?, ?, ?, ?)', [id, title, detailPath, 'planning', now]);
    saveData();
    return id;
  },

  /**
   * Add a job to the project
   * @param {string} wbsId - Project ID
   * @param {object} options - Job options
   * @param {string} options.title - Job title (short name)
   * @param {string} [options.description] - Detailed instructions for the agent
   * @param {string} options.agent - Worker agent mention (e.g., "@crewx_codex_dev")
   * @param {number} [options.seq=0] - Execution sequence
   * @param {number} [options.issue_number] - Related GitHub issue number
   * @returns {string} Job ID
   */
  addJob(wbsId, { title, description = null, agent, seq = 0, issue_number = null }) {
    const id = getNextJobId();
    const now = new Date().toISOString();
    alasql('INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, wbsId, title, description, agent, 'pending', seq, now, null, issue_number]);
    saveData();
    return id;
  },

  /**
   * Get the next pending job
   * @param {string} wbsId - Project ID
   * @returns {object|null} Next job or null
   */
  getNextJob(wbsId) {
    const jobs = alasql(
      'SELECT * FROM jobs WHERE wbs_id = ? AND status = ? ORDER BY seq',
      [wbsId, 'pending']
    );
    return jobs[0] || null;
  },

  /**
   * Update job status
   * @param {string} jobId - Job ID
   * @param {string} status - New status (pending, running, completed, failed)
   */
  updateJob(jobId, status) {
    if (status === 'completed' || status === 'failed') {
      alasql('UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?',
        [status, new Date().toISOString(), jobId]);
    } else {
      alasql('UPDATE jobs SET status = ? WHERE id = ?', [status, jobId]);
    }
    saveData();
  },

  /**
   * Execute a single worker with Execution tracking
   * @param {object} job - Job object
   * @returns {Promise<object>} Result { success, error?, execId }
   */
  async runWorker(job) {
    this.updateJob(job.id, 'running');
    console.log(`[WBS] Running job: ${job.title}`);
    console.log(`[WBS] Agent: ${job.agent}`);
    if (job.description) {
      console.log(`[WBS] Description: ${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}`);
    }

    // Get project detail document if exists
    const project = alasql('SELECT * FROM wbs WHERE id = ?', [job.wbs_id])[0];
    let detailContent = null;
    if (project && project.detail_path) {
      const detailFullPath = path.isAbsolute(project.detail_path)
        ? project.detail_path
        : path.join(process.cwd(), project.detail_path);
      if (fs.existsSync(detailFullPath)) {
        try {
          detailContent = fs.readFileSync(detailFullPath, 'utf8');
          console.log(`[WBS] Detail: ${project.detail_path}`);
        } catch (e) {
          console.warn(`[WBS] Warning: Could not read detail file: ${e.message}`);
        }
      } else {
        console.warn(`[WBS] Warning: Detail file not found: ${detailFullPath}`);
      }
    }

    console.log(`[WBS] Timeout: 30 minutes`);
    console.log('─'.repeat(50));

    // Build prompt: detail context + title + description
    let prompt = job.title;
    if (detailContent) {
      prompt = `[프로젝트 상세]\n${detailContent}\n\n[작업]\n${prompt}`;
    }
    if (job.description) {
      prompt += `\n\n상세 지시:\n${job.description}`;
    }

    // Build job context based on whether issue exists
    if (job.issue_number) {
      // Issue 기반 작업: 개발자의 기존 프로세스 활용
      prompt += `

## 작업 지시
GitHub Issue #${job.issue_number}를 처리하세요.

**당신의 기존 개발 프로세스를 따르세요:**
1. \`gh issue view ${job.issue_number}\`로 이슈 확인
2. 브랜치 생성 및 작업
3. PR 생성
4. 이슈에 결과 코멘트

WBS 추적 정보:
- WBS: ${job.wbs_id}
- Job: ${job.id}
`;
    } else {
      // 독립 작업: WBS 전용 워크플로우
      const branchName = `feature/wbs-${job.wbs_id.replace('wbs-', '')}-${job.id.replace('job-', '')}`;
      prompt += `

## 작업 지시 (WBS 독립 작업)

이 작업은 GitHub Issue 없이 WBS에서 직접 생성된 작업입니다.

### Git 워크플로우
\`\`\`bash
# 1. worktree 생성
git worktree add worktree/${branchName} -b ${branchName}

# 2. 해당 디렉토리에서 작업
cd worktree/${branchName}

# 3. 작업 완료 후 PR 생성
gh pr create --title "[WBS-${job.wbs_id}] ${job.title}" --body "WBS Job: ${job.id}"
\`\`\`

### 주의사항
- main/develop에서 직접 작업 금지
- 반드시 worktree에서 작업
- PR 생성 후 링크 출력

WBS 추적 정보:
- WBS: ${job.wbs_id}
- Job: ${job.id}
- 브랜치: ${branchName}
`;
    }

    return new Promise((resolve) => {
      // Build command: crewx x "@agent prompt"
      // Note: Don't use shell: true to avoid shell interpretation of special characters
      const command = `${job.agent} ${prompt}`;
      const child = spawn('crewx', ['x', command], {
        stdio: 'inherit',
        cwd: getProjectRoot()
      });

      // Create execution record with PID
      const execId = this.createExecution(job.id, child.pid);
      runningProcesses.set(execId, child);

      console.log(`[WBS] Execution ID: ${execId}`);
      console.log(`[WBS] PID: ${child.pid}`);

      // Set timeout (30 minutes)
      const timeout = setTimeout(() => {
        console.error(`[WBS] Timeout reached, killing process...`);
        child.kill('SIGTERM');
        this.updateExecution(execId, 'failed', { error: 'Timeout (30 minutes)' });
        this.updateJob(job.id, 'failed');
        runningProcesses.delete(execId);
        resolve({ success: false, error: 'Timeout', execId });
      }, 30 * 60 * 1000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        runningProcesses.delete(execId);
        console.log('─'.repeat(50));

        if (code === 0) {
          this.updateExecution(execId, 'completed', { exitCode: code });
          this.updateJob(job.id, 'completed');
          console.log(`[WBS] Job completed: ${job.title}`);
          resolve({ success: true, execId });
        } else {
          this.updateExecution(execId, 'failed', { exitCode: code, error: `Exit code: ${code}` });
          this.updateJob(job.id, 'failed');
          console.error(`[WBS] Job failed: ${job.title}`);
          console.error(`[WBS] Exit code: ${code}`);
          resolve({ success: false, error: `Exit code: ${code}`, execId });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        runningProcesses.delete(execId);
        this.updateExecution(execId, 'failed', { error: err.message });
        this.updateJob(job.id, 'failed');
        console.error('─'.repeat(50));
        console.error(`[WBS] Job failed: ${job.title}`);
        console.error(`[WBS] Error: ${err.message}`);
        resolve({ success: false, error: err.message, execId });
      });
    });
  },

  /**
   * Run all pending jobs sequentially
   * @param {string} wbsId - Project ID
   */
  async run(wbsId) {
    const project = alasql('SELECT * FROM wbs WHERE id = ?', [wbsId])[0];
    if (!project) {
      console.error(`[WBS] Project not found: ${wbsId}`);
      return;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`[WBS] Starting project: ${project.title}`);
    console.log(`${'═'.repeat(50)}\n`);

    alasql('UPDATE wbs SET status = ? WHERE id = ?', ['running', wbsId]);
    saveData();

    let job;
    let completed = 0;
    let failed = 0;

    while ((job = this.getNextJob(wbsId))) {
      const result = await this.runWorker(job);
      if (result.success) {
        completed++;
      } else {
        failed++;
      }
    }

    const finalStatus = failed === 0 ? 'completed' : 'partial';
    alasql('UPDATE wbs SET status = ? WHERE id = ?', [finalStatus, wbsId]);
    saveData();

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`[WBS] Project ${finalStatus}: ${project.title}`);
    console.log(`[WBS] Completed: ${completed}, Failed: ${failed}`);
    console.log(`${'═'.repeat(50)}\n`);
  },

  /**
   * Get project and jobs status
   * @param {string} wbsId - Project ID
   * @returns {object} Status object
   */
  status(wbsId) {
    const project = alasql('SELECT * FROM wbs WHERE id = ?', [wbsId])[0];
    const jobs = alasql('SELECT * FROM jobs WHERE wbs_id = ? ORDER BY seq', [wbsId]);
    return { project, jobs };
  },

  /**
   * List all WBS projects
   * @returns {array} All projects
   */
  list() {
    return alasql('SELECT * FROM wbs ORDER BY created_at DESC');
  },

  /**
   * Delete a WBS project and its jobs
   * @param {string} wbsId - Project ID
   */
  delete(wbsId) {
    // Delete executions for all jobs in this project
    const jobs = alasql('SELECT id FROM jobs WHERE wbs_id = ?', [wbsId]);
    jobs.forEach(j => {
      alasql('DELETE FROM executions WHERE job_id = ?', [j.id]);
    });
    alasql('DELETE FROM jobs WHERE wbs_id = ?', [wbsId]);
    alasql('DELETE FROM wbs WHERE id = ?', [wbsId]);
    saveData();
  },

  // ==========================================
  // Execution Management
  // ==========================================

  /**
   * Create a new execution record
   * @param {string} jobId - Job ID
   * @param {number} pid - Process ID
   * @returns {string} Execution ID
   */
  createExecution(jobId, pid) {
    const id = getNextExecId();
    const now = new Date().toISOString();
    alasql('INSERT INTO executions VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, jobId, pid, 'running', now, null, null, null]);
    saveData();
    return id;
  },

  /**
   * Update execution status
   * @param {string} execId - Execution ID
   * @param {string} status - New status (running, completed, failed, killed)
   * @param {object} [options] - Additional options
   * @param {number} [options.exitCode] - Exit code
   * @param {string} [options.error] - Error message
   */
  updateExecution(execId, status, options = {}) {
    const now = new Date().toISOString();
    if (status !== 'running') {
      alasql('UPDATE executions SET status = ?, ended_at = ?, exit_code = ?, error = ? WHERE id = ?',
        [status, now, options.exitCode || null, options.error || null, execId]);
    } else {
      alasql('UPDATE executions SET status = ? WHERE id = ?', [status, execId]);
    }
    saveData();
  },

  /**
   * Get execution by ID
   * @param {string} execId - Execution ID
   * @returns {object|null} Execution object
   */
  getExecution(execId) {
    const execs = alasql('SELECT * FROM executions WHERE id = ?', [execId]);
    return execs[0] || null;
  },

  /**
   * List executions for a job
   * @param {string} jobId - Job ID
   * @returns {array} Executions
   */
  listExecutions(jobId) {
    return alasql('SELECT * FROM executions WHERE job_id = ? ORDER BY started_at DESC', [jobId]);
  },

  /**
   * Get the latest execution for a job
   * @param {string} jobId - Job ID
   * @returns {object|null} Latest execution
   */
  getLatestExecution(jobId) {
    const execs = alasql('SELECT * FROM executions WHERE job_id = ? ORDER BY started_at DESC LIMIT 1', [jobId]);
    return execs[0] || null;
  },

  /**
   * Kill a running execution
   * @param {string} execId - Execution ID
   * @returns {boolean} Success
   */
  killExecution(execId) {
    const exec = this.getExecution(execId);
    if (!exec || exec.status !== 'running') {
      return false;
    }

    // Try to kill the process
    const proc = runningProcesses.get(execId);
    if (proc) {
      try {
        process.kill(exec.pid, 'SIGTERM');
        runningProcesses.delete(execId);
      } catch (e) {
        // Process may have already exited
      }
    } else {
      // Try to kill by PID directly
      try {
        process.kill(exec.pid, 'SIGTERM');
      } catch (e) {
        // Process may have already exited
      }
    }

    this.updateExecution(execId, 'killed');

    // Also update the job status
    const job = alasql('SELECT * FROM jobs WHERE id = ?', [exec.job_id])[0];
    if (job && job.status === 'running') {
      this.updateJob(exec.job_id, 'failed');
    }

    return true;
  },

  /**
   * Get all running executions
   * @returns {array} Running executions
   */
  getRunningExecutions() {
    return alasql('SELECT * FROM executions WHERE status = ?', ['running']);
  }
};

// ==========================================
// Formatting Helpers for Human-Readable Output
// ==========================================

/**
 * Status icon mapping
 */
const STATUS_ICONS = {
  pending: '⬜️',
  running: '🟡',
  completed: '✅',
  failed: '❌',
  on_hold: '⏸️',
  planning: '📝',
  partial: '⚠️'
};

/**
 * Get status icon
 * @param {string} status - Status string
 * @returns {string} Status icon
 */
function getStatusIcon(status) {
  return STATUS_ICONS[status] || '❓';
}

/**
 * Get display width of a string (CJK/Korean = 2, emoji = 2, others = 1)
 * @param {string} str - Input string
 * @returns {number} Display width
 */
function getDisplayWidth(str) {
  let width = 0;
  for (const char of String(str)) {
    const code = char.codePointAt(0);
    // CJK characters (Korean, Chinese, Japanese)
    if (
      (code >= 0x1100 && code <= 0x11FF) ||   // Hangul Jamo
      (code >= 0x3000 && code <= 0x303F) ||   // CJK Punctuation
      (code >= 0x3040 && code <= 0x309F) ||   // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) ||   // Katakana
      (code >= 0x3130 && code <= 0x318F) ||   // Hangul Compatibility Jamo
      (code >= 0x3200 && code <= 0x32FF) ||   // Enclosed CJK
      (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
      (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility
      (code >= 0xFF00 && code <= 0xFFEF)      // Fullwidth Forms
    ) {
      width += 2;
    // Emoji (common ranges)
    } else if (
      (code >= 0x1F300 && code <= 0x1F9FF) || // Misc Symbols, Emoticons, etc.
      (code >= 0x2600 && code <= 0x26FF) ||   // Misc Symbols
      (code >= 0x2700 && code <= 0x27BF)      // Dingbats
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Pad string to target display width
 * @param {string} str - Input string
 * @param {number} targetWidth - Target display width
 * @returns {string} Padded string
 */
function padToWidth(str, targetWidth) {
  const s = String(str);
  const currentWidth = getDisplayWidth(s);
  const padding = targetWidth - currentWidth;
  return padding > 0 ? s + ' '.repeat(padding) : s;
}

/**
 * Calculate column widths for a table
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Row data
 * @returns {number[]} Column widths
 */
function calculateColumnWidths(headers, rows) {
  const widths = headers.map(h => getDisplayWidth(h));
  rows.forEach(row => {
    row.forEach((cell, i) => {
      const cellWidth = getDisplayWidth(String(cell));
      if (cellWidth > widths[i]) {
        widths[i] = cellWidth;
      }
    });
  });
  return widths;
}

/**
 * Format a table row
 * @param {string[]} cells - Cell values
 * @param {number[]} widths - Column widths
 * @returns {string} Formatted row
 */
function formatRow(cells, widths) {
  return '| ' + cells.map((cell, i) => padToWidth(String(cell), widths[i])).join(' | ') + ' |';
}

/**
 * Format a separator row
 * @param {number[]} widths - Column widths
 * @returns {string} Separator row
 */
function formatSeparator(widths) {
  return '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
}

/**
 * Format a table with headers and rows
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Row data
 * @returns {string} Formatted table
 */
function formatTable(headers, rows) {
  const widths = calculateColumnWidths(headers, rows);
  const lines = [];
  lines.push(formatRow(headers, widths));
  lines.push(formatSeparator(widths));
  rows.forEach(row => {
    lines.push(formatRow(row, widths));
  });
  return lines.join('\n');
}

/**
 * Format project list for human-readable output
 * @param {object[]} projects - List of projects
 * @returns {string} Formatted output
 */
function formatProjectList(projects) {
  if (!projects || projects.length === 0) {
    return '📋 WBS Projects (0)\n\nNo projects found.';
  }

  // Get job counts for each project
  const projectsWithStats = projects.map(p => {
    const jobs = alasql('SELECT * FROM jobs WHERE wbs_id = ?', [p.id]);
    const completed = jobs.filter(j => j.status === 'completed').length;
    const total = jobs.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Determine status icon based on project status or job progress
    let statusIcon;
    if (p.status === 'completed') {
      statusIcon = STATUS_ICONS.completed;
    } else if (p.status === 'running' || jobs.some(j => j.status === 'running')) {
      statusIcon = STATUS_ICONS.running;
    } else if (completed > 0) {
      statusIcon = STATUS_ICONS.running; // In progress
    } else {
      statusIcon = STATUS_ICONS.pending;
    }

    return {
      ...p,
      jobCount: total,
      completed,
      progress,
      statusIcon
    };
  });

  const headers = ['상태', 'ID', '프로젝트명', 'Jobs', 'Progress'];
  const rows = projectsWithStats.map(p => [
    p.statusIcon,
    p.id,
    p.title,
    String(p.jobCount),
    `${p.progress}%`
  ]);

  return `📋 WBS Projects (${projects.length})\n\n${formatTable(headers, rows)}`;
}

/**
 * Format project status for human-readable output
 * @param {object} result - Status result with project, jobs, and summary
 * @returns {string} Formatted output
 */
function formatProjectStatus(result) {
  if (!result.project) {
    return '❌ Project not found';
  }

  const { project, jobs, summary } = result;
  const lines = [];

  // Header
  lines.push(`📋 ${project.title} (${project.id})`);
  lines.push(`   Status: ${project.status} | Progress: ${summary.progress}% (${summary.completed}/${summary.total})`);
  if (project.detail_path) {
    lines.push(`   Detail: ${project.detail_path}`);
  }
  lines.push('');

  // Jobs table
  if (jobs.length === 0) {
    lines.push('   Jobs: None');
  } else {
    lines.push('   Jobs:');
    const headers = ['상태', '#', 'ID', '작업명', '담당'];
    const rows = jobs.map((j, index) => [
      getStatusIcon(j.status),
      String(index + 1),
      j.id,
      j.title,
      j.agent
    ]);

    // Indent the table
    const table = formatTable(headers, rows);
    table.split('\n').forEach(line => {
      lines.push('   ' + line);
    });
  }

  return lines.join('\n');
}

/**
 * Format job list for human-readable output
 * @param {object[]} jobs - List of jobs
 * @param {string} wbsId - WBS project ID
 * @returns {string} Formatted output
 */
function formatJobList(jobs, wbsId) {
  if (!jobs || jobs.length === 0) {
    return `📋 Jobs for ${wbsId} (0)\n\nNo jobs found.`;
  }

  const headers = ['상태', '#', 'ID', '작업명', '담당', 'Status'];
  const rows = jobs.map((j, index) => [
    getStatusIcon(j.status),
    String(index + 1),
    j.id,
    j.title,
    j.agent,
    j.status
  ]);

  const completed = jobs.filter(j => j.status === 'completed').length;
  const total = jobs.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return `📋 Jobs for ${wbsId} (${total})\n   Progress: ${progress}% (${completed}/${total})\n\n${formatTable(headers, rows)}`;
}

/**
 * Check if --json flag is present in args
 * @param {string[]} args - Command line arguments
 * @returns {boolean} True if --json flag is present
 */
function hasJsonFlag(args) {
  return args.includes('--json');
}

/**
 * Parse options from command line arguments
 * @param {string[]} args - Command line arguments
 * @param {number} startIndex - Index to start parsing from
 * @returns {object} Parsed options
 */
function parseOptions(args, startIndex = 0) {
  const options = {};
  for (let i = startIndex; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      const key = args[i].slice(2);
      options[key] = args[++i];
    }
  }
  return options;
}

/**
 * Handle job sub-commands
 * @param {string[]} args - Command line arguments (after 'job')
 */
function handleJobCommand(args) {
  const subCommand = args[0];

  switch (subCommand) {
    case 'list': {
      const wbsId = args[1];
      if (!wbsId) {
        console.error('Usage: wbs.js job list <wbs-id> [--json]');
        process.exit(1);
      }
      const jobs = alasql('SELECT * FROM jobs WHERE wbs_id = ? ORDER BY seq', [wbsId]);
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(jobs, null, 2));
      } else {
        console.log(formatJobList(jobs, wbsId));
      }
      break;
    }

    case 'add': {
      const wbsId = args[1];
      const options = parseOptions(args, 2);
      const { title, agent, desc, description, issue } = options;
      const seq = options.seq ? parseInt(options.seq, 10) : 0;
      const jobDesc = desc || description || null;
      const issue_number = issue ? parseInt(issue, 10) : null;

      if (!wbsId || !title || !agent) {
        console.error('Usage: wbs.js job add <wbs-id> --title "Job Title" --agent "@crewx_codex_dev" [--desc "상세 지시"] [--seq N] [--issue N]');
        process.exit(1);
      }
      const jobId = wbs.addJob(wbsId, { title, description: jobDesc, agent, seq, issue_number });
      console.log(JSON.stringify({ jobId, wbsId, title, description: jobDesc, agent, seq, issue_number }, null, 2));
      break;
    }

    case 'update': {
      const jobId = args[1];
      const options = parseOptions(args, 2);
      const { status, title, agent, seq, desc, description, issue } = options;
      const jobDesc = desc || description;
      const issue_number = issue !== undefined ? (issue ? parseInt(issue, 10) : null) : undefined;

      if (!jobId) {
        console.error('Usage: wbs.js job update <job-id> [--status <status>] [--title "..."] [--desc "..."] [--agent "@..."] [--seq N] [--issue N]');
        console.error('Status: pending, running, completed, failed');
        process.exit(1);
      }

      // Check if job exists
      const existingJob = alasql('SELECT * FROM jobs WHERE id = ?', [jobId])[0];
      if (!existingJob) {
        console.error(`Job not found: ${jobId}`);
        process.exit(1);
      }

      // Build update query dynamically
      const updates = [];
      const values = [];

      if (status) {
        if (!['pending', 'running', 'completed', 'failed'].includes(status)) {
          console.error('Invalid status. Must be: pending, running, completed, or failed');
          process.exit(1);
        }
        updates.push('status = ?');
        values.push(status);
        if (status === 'completed' || status === 'failed') {
          updates.push('completed_at = ?');
          values.push(new Date().toISOString());
        }
      }
      if (title) {
        updates.push('title = ?');
        values.push(title);
      }
      if (agent) {
        updates.push('agent = ?');
        values.push(agent);
      }
      if (seq !== undefined) {
        updates.push('seq = ?');
        values.push(parseInt(seq, 10));
      }
      if (jobDesc !== undefined) {
        updates.push('description = ?');
        values.push(jobDesc);
      }
      if (issue_number !== undefined) {
        updates.push('issue_number = ?');
        values.push(issue_number);
      }

      if (updates.length === 0) {
        console.error('No update options provided. Use --status, --title, --desc, --agent, --seq, or --issue');
        process.exit(1);
      }

      values.push(jobId);
      alasql(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`, values);
      saveData();

      const updatedJob = alasql('SELECT * FROM jobs WHERE id = ?', [jobId])[0];
      console.log(JSON.stringify(updatedJob, null, 2));
      break;
    }

    case 'next': {
      const wbsId = args[1];
      if (!wbsId) {
        console.error('Usage: wbs.js job next <wbs-id>');
        process.exit(1);
      }
      const job = wbs.getNextJob(wbsId);
      if (job) {
        wbs.runWorker(job).then(result => {
          console.log(JSON.stringify(result, null, 2));
        });
      } else {
        console.log('No pending jobs');
      }
      break;
    }

    case 'run': {
      const wbsId = args[1];
      if (!wbsId) {
        console.error('Usage: wbs.js job run <wbs-id>');
        process.exit(1);
      }
      wbs.run(wbsId);
      break;
    }

    case 'retry': {
      const jobId = args[1];
      if (!jobId) {
        console.error('Usage: wbs.js job retry <job-id>');
        process.exit(1);
      }
      const job = alasql('SELECT * FROM jobs WHERE id = ?', [jobId])[0];
      if (!job) {
        console.error(`Job not found: ${jobId}`);
        process.exit(1);
      }
      // Reset job to pending and run
      alasql('UPDATE jobs SET status = ? WHERE id = ?', ['pending', jobId]);
      saveData();
      console.log(`[WBS] Retrying job: ${job.title}`);
      wbs.runWorker(job).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
    }

    default:
      console.log(`
Job Commands - Manage jobs within a WBS project

Usage:
  wbs.js job list <wbs-id> [--json]     List all jobs in a project
  wbs.js job add <wbs-id> [options]     Add a new job to the project
  wbs.js job update <job-id> [options]  Update an existing job
  wbs.js job next <wbs-id>              Run the next pending job
  wbs.js job run <wbs-id>               Run all pending jobs sequentially
  wbs.js job retry <job-id>             Retry a failed/completed job

Output Options:
  --json                  Output raw JSON (default: human-readable table)

Options for 'job add':
  --title "Job Title"     Job description (required)
  --agent "@claude:sonnet" Worker agent (required)
  --seq N                 Execution sequence (default: 0)
  --issue N               Related GitHub issue number

Options for 'job update':
  --status <status>       Status: pending, running, completed, failed
  --title "New Title"     Update job title
  --agent "@agent"        Update worker agent
  --seq N                 Update execution sequence
  --issue N               Update related GitHub issue number

Examples:
  wbs.js job list wbs-1
  wbs.js job list wbs-1 --json
  wbs.js job add wbs-1 --title "Design schema" --agent "@claude:sonnet" --seq 1
  wbs.js job add wbs-1 --title "Fix bug" --agent "@crewx_claude_dev" --issue 42
  wbs.js job update job-1 --status completed
  wbs.js job retry job-1
  wbs.js job next wbs-1
  wbs.js job run wbs-1
`);
  }
}

/**
 * Handle exec sub-commands
 */
function handleExecCommand(args) {
  const subCommand = args[0];

  switch (subCommand) {
    case 'list': {
      const jobId = args[1];
      if (!jobId) {
        console.error('Usage: wbs.js exec list <job-id> [--json]');
        process.exit(1);
      }
      const executions = wbs.listExecutions(jobId);
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(executions, null, 2));
      } else {
        console.log(formatExecutionList(executions, jobId));
      }
      break;
    }

    case 'status': {
      const execId = args[1];
      if (!execId) {
        console.error('Usage: wbs.js exec status <exec-id> [--json]');
        process.exit(1);
      }
      const exec = wbs.getExecution(execId);
      if (!exec) {
        console.error(`Execution not found: ${execId}`);
        process.exit(1);
      }
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(exec, null, 2));
      } else {
        console.log(formatExecutionStatus(exec));
      }
      break;
    }

    case 'kill': {
      const execId = args[1];
      if (!execId) {
        console.error('Usage: wbs.js exec kill <exec-id>');
        process.exit(1);
      }
      const success = wbs.killExecution(execId);
      if (success) {
        console.log(`Killed execution: ${execId}`);
      } else {
        console.error(`Could not kill execution: ${execId} (not running or not found)`);
        process.exit(1);
      }
      break;
    }

    case 'running': {
      const executions = wbs.getRunningExecutions();
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(executions, null, 2));
      } else {
        if (executions.length === 0) {
          console.log('No running executions');
        } else {
          console.log(formatRunningExecutions(executions));
        }
      }
      break;
    }

    default:
      console.log(`
Execution Commands - Manage job executions

Usage:
  wbs.js exec list <job-id> [--json]    List execution history for a job
  wbs.js exec status <exec-id> [--json] Get execution details
  wbs.js exec kill <exec-id>            Kill a running execution
  wbs.js exec running [--json]          List all running executions

Examples:
  wbs.js exec list job-123
  wbs.js exec status exec-456
  wbs.js exec kill exec-456
  wbs.js exec running
`);
  }
}

/**
 * Format execution list
 */
function formatExecutionList(executions, jobId) {
  if (executions.length === 0) {
    return `No executions found for job: ${jobId}`;
  }

  const headers = ['상태', 'ID', 'PID', '시작', '종료', '코드'];
  const rows = executions.map(e => [
    getStatusIcon(e.status),
    e.id.substring(0, 18),
    e.pid || '-',
    e.started_at ? new Date(e.started_at).toLocaleString('ko-KR') : '-',
    e.ended_at ? new Date(e.ended_at).toLocaleString('ko-KR') : '-',
    e.exit_code !== null ? e.exit_code : '-'
  ]);

  const widths = calculateColumnWidths(headers, rows);
  const separator = '|-' + widths.map(w => '-'.repeat(w)).join('-|-') + '-|';

  let output = `📋 Executions for ${jobId}\n\n`;
  output += formatRow(headers, widths) + '\n';
  output += separator + '\n';
  rows.forEach(row => {
    output += formatRow(row, widths) + '\n';
  });

  return output;
}

/**
 * Format single execution status
 */
function formatExecutionStatus(exec) {
  return `
📋 Execution: ${exec.id}

Status:     ${getStatusIcon(exec.status)} ${exec.status}
Job ID:     ${exec.job_id}
PID:        ${exec.pid || '-'}
Started:    ${exec.started_at ? new Date(exec.started_at).toLocaleString('ko-KR') : '-'}
Ended:      ${exec.ended_at ? new Date(exec.ended_at).toLocaleString('ko-KR') : '-'}
Exit Code:  ${exec.exit_code !== null ? exec.exit_code : '-'}
Error:      ${exec.error || '-'}
`;
}

/**
 * Format running executions
 */
function formatRunningExecutions(executions) {
  const headers = ['상태', 'Exec ID', 'Job ID', 'PID', '시작'];
  const rows = executions.map(e => [
    getStatusIcon(e.status),
    e.id.substring(0, 18),
    e.job_id.substring(0, 20),
    e.pid || '-',
    e.started_at ? new Date(e.started_at).toLocaleString('ko-KR') : '-'
  ]);

  const widths = calculateColumnWidths(headers, rows);
  const separator = '|-' + widths.map(w => '-'.repeat(w)).join('-|-') + '-|';

  let output = `🟡 Running Executions (${executions.length})\n\n`;
  output += formatRow(headers, widths) + '\n';
  output += separator + '\n';
  rows.forEach(row => {
    output += formatRow(row, widths) + '\n';
  });

  return output;
}

// ==========================================
// Daemon Management
// ==========================================

/**
 * Check if a process is alive by PID
 * @param {number} pid - Process ID
 * @returns {boolean} True if process is alive
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check for zombie jobs (running but process dead or timeout exceeded)
 * @returns {object[]} Zombie jobs found and fixed
 */
function checkAndFixZombies() {
  const runningExecs = alasql('SELECT * FROM executions WHERE status = ?', ['running']);
  const zombies = [];
  const now = Date.now();

  for (const exec of runningExecs) {
    const startTime = new Date(exec.started_at).getTime();
    const elapsed = now - startTime;
    const isAlive = exec.pid ? isProcessAlive(exec.pid) : false;

    // Zombie conditions: process dead OR timeout exceeded (30 min)
    if (!isAlive || elapsed > ZOMBIE_TIMEOUT_MS) {
      const reason = !isAlive ? 'Process dead' : 'Timeout (30min)';

      // Update execution status
      alasql('UPDATE executions SET status = ?, ended_at = ?, error = ? WHERE id = ?',
        ['failed', new Date().toISOString(), `Zombie: ${reason}`, exec.id]);

      // Update job status
      alasql('UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?',
        ['failed', new Date().toISOString(), exec.job_id]);

      zombies.push({ execId: exec.id, jobId: exec.job_id, pid: exec.pid, reason });
    }
  }

  if (zombies.length > 0) {
    saveData();
  }

  return zombies;
}

/**
 * Get active WBS projects that need attention
 * @returns {object[]} Projects with pending or running jobs
 */
function getActiveProjects() {
  return alasql(`
    SELECT DISTINCT w.* FROM wbs w
    INNER JOIN jobs j ON w.id = j.wbs_id
    WHERE j.status IN ('pending', 'running')
    AND w.status != 'completed'
  `);
}

/**
 * Daemon tick - called periodically by daemon
 */
function daemonTick() {
  const timestamp = getLocalTimestamp();
  console.log(`[${timestamp}] Daemon tick`);

  // 1. Check and fix zombies
  const zombies = checkAndFixZombies();
  if (zombies.length > 0) {
    console.log(`[${timestamp}] Fixed ${zombies.length} zombie(s):`);
    zombies.forEach(z => console.log(`  - ${z.jobId}: ${z.reason}`));
  }

  // 2. Get active projects
  const activeProjects = getActiveProjects();
  if (activeProjects.length === 0) {
    console.log(`[${timestamp}] No active projects`);
    return;
  }

  // 3. For each active project, check if there's work to do
  for (const project of activeProjects) {
    const runningJobs = alasql('SELECT * FROM jobs WHERE wbs_id = ? AND status = ?', [project.id, 'running']);
    const pendingJobs = alasql('SELECT * FROM jobs WHERE wbs_id = ? AND status = ? ORDER BY seq', [project.id, 'pending']);

    if (runningJobs.length > 0) {
      console.log(`[${timestamp}] ${project.id}: ${runningJobs.length} job(s) running`);
      continue; // Wait for running jobs to complete
    }

    if (pendingJobs.length > 0) {
      console.log(`[${timestamp}] ${project.id}: Starting next job (${pendingJobs.length} pending)`);
      // Call coordinator to start next job
      const command = `crewx x "@wbs_coordinator ${project.id} 다음 작업 진행해줘"`;
      try {
        execSync(command, { stdio: 'inherit', cwd: __dirname });
      } catch (e) {
        console.error(`[${timestamp}] Failed to call coordinator: ${e.message}`);
      }
    }
  }
}

/**
 * Run daemon in foreground (for testing)
 */
function runDaemonForeground() {
  console.log(`[WBS Daemon] Starting in foreground mode`);
  console.log(`[WBS Daemon] Interval: ${DAEMON_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`[WBS Daemon] Zombie timeout: ${ZOMBIE_TIMEOUT_MS / 1000 / 60} minutes`);
  console.log(`[WBS Daemon] Press Ctrl+C to stop\n`);

  // Initial tick
  daemonTick();

  // Set interval
  setInterval(daemonTick, DAEMON_INTERVAL_MS);
}

/**
 * Start daemon as background process
 * @returns {boolean} Success
 */
function startDaemon() {
  // Check if already running
  if (fs.existsSync(DAEMON_PID_FILE)) {
    const existingPid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim(), 10);
    if (isProcessAlive(existingPid)) {
      console.error(`[WBS Daemon] Already running (PID: ${existingPid})`);
      return false;
    }
    // Stale PID file, remove it
    fs.unlinkSync(DAEMON_PID_FILE);
  }

  // Spawn background process
  const logFile = path.join(__dirname, '.daemon.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn('node', [__filename, 'daemon', '--foreground'], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: __dirname
  });

  // Write PID file
  fs.writeFileSync(DAEMON_PID_FILE, String(child.pid));
  child.unref();

  console.log(`[WBS Daemon] Started (PID: ${child.pid})`);
  console.log(`[WBS Daemon] Log: ${logFile}`);
  return true;
}

/**
 * Stop daemon
 * @returns {boolean} Success
 */
function stopDaemon() {
  if (!fs.existsSync(DAEMON_PID_FILE)) {
    console.error('[WBS Daemon] Not running (no PID file)');
    return false;
  }

  const pid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim(), 10);

  if (!isProcessAlive(pid)) {
    console.log('[WBS Daemon] Process not found, cleaning up PID file');
    fs.unlinkSync(DAEMON_PID_FILE);
    return true;
  }

  try {
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(DAEMON_PID_FILE);
    console.log(`[WBS Daemon] Stopped (PID: ${pid})`);
    return true;
  } catch (e) {
    console.error(`[WBS Daemon] Failed to stop: ${e.message}`);
    return false;
  }
}

/**
 * Get daemon status
 * @returns {object} Status info
 */
function getDaemonStatus() {
  if (!fs.existsSync(DAEMON_PID_FILE)) {
    return { running: false, message: 'Not running' };
  }

  const pid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim(), 10);
  const alive = isProcessAlive(pid);

  if (!alive) {
    return { running: false, pid, message: 'Stale PID file (process dead)' };
  }

  return { running: true, pid, message: `Running (PID: ${pid})` };
}

/**
 * Handle daemon sub-commands
 */
function handleDaemonCommand(args) {
  const subCommand = args[0];

  switch (subCommand) {
    case 'start': {
      startDaemon();
      break;
    }

    case 'stop': {
      stopDaemon();
      break;
    }

    case 'status': {
      const status = getDaemonStatus();
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(`[WBS Daemon] ${status.message}`);
      }
      break;
    }

    case 'restart': {
      stopDaemon();
      setTimeout(() => startDaemon(), 1000);
      break;
    }

    case '--foreground': {
      // Internal: run in foreground (called by start)
      runDaemonForeground();
      break;
    }

    case 'tick': {
      // Manual tick for testing
      daemonTick();
      break;
    }

    default:
      console.log(`
Daemon Commands - Background scheduler for WBS

Usage:
  wbs.js daemon start       Start daemon in background
  wbs.js daemon stop        Stop running daemon
  wbs.js daemon status      Check daemon status
  wbs.js daemon restart     Restart daemon
  wbs.js daemon tick        Manual tick (for testing)

The daemon runs every 5 minutes and:
  1. Checks for zombie jobs (running > 30min or process dead)
  2. Marks zombies as failed
  3. Calls coordinator to start next pending jobs

Files:
  .daemon.pid   Process ID file
  .daemon.log   Daemon output log
`);
  }
}

/**
 * Show main help
 */
function showHelp() {
  console.log(`
WBS Coordinator - Work Breakdown Structure Management

Project Commands:
  wbs.js create "Title" [--detail "path"]  Create a new WBS project
  wbs.js list [--json]                     List all projects
  wbs.js status <wbs-id> [--json] Get project status with jobs summary
  wbs.js delete <wbs-id>          Delete a project and its jobs

Job Commands:
  wbs.js job list <wbs-id> [--json]  List all jobs in a project
  wbs.js job add <wbs-id> [opts]     Add a job to the project
  wbs.js job update <job-id> [opts]  Update a job
  wbs.js job next <wbs-id>           Run the next pending job
  wbs.js job run <wbs-id>            Run all pending jobs
  wbs.js job retry <job-id>          Retry a failed/completed job

Execution Commands:
  wbs.js exec list <job-id>       List execution history for a job
  wbs.js exec status <exec-id>    Get execution details
  wbs.js exec kill <exec-id>      Kill a running execution
  wbs.js exec running             List all running executions

Daemon Commands:
  wbs.js daemon start             Start background scheduler
  wbs.js daemon stop              Stop daemon
  wbs.js daemon status            Check daemon status
  wbs.js daemon tick              Manual tick (for testing)

Coordinator Commands (Natural Language):
  wbs.js q "질문"                 Ask coordinator a question
  wbs.js x "요청"                 Request coordinator to execute

Output Options:
  --json    Output raw JSON instead of human-readable table

Status Icons:
  ⬜️ pending   🟡 running   ✅ completed   ❌ failed

Run 'wbs.js job' or 'wbs.js exec' for detailed command help.

Examples:
  # Create a project
  wbs.js create "User Authentication"
  wbs.js create "API Provider" --detail "wbs/wbs-19-design-document.md"

  # Add jobs
  wbs.js job add wbs-123 --title "Design User model" --agent "@crewx_codex_dev" --seq 1

  # Natural language interface
  wbs.js q "진행 상황 어때?"
  wbs.js x "실패한 작업 재실행해줘"

  # Check status
  wbs.js status wbs-123

  # Run all jobs
  wbs.js job run wbs-123

  # Check execution history
  wbs.js exec list job-456
`);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  // Log at start
  if (command) {
    logUsage(command, args.slice(1).join(' '));
  }

  switch (command) {
    // === Project Commands ===
    case 'create': {
      const title = args[1];
      if (!title) {
        console.error('Usage: wbs.js create "Project Title" [--detail "path/to/detail.md"]');
        process.exit(1);
      }
      const options = parseOptions(args, 2);

      // Generate sequential ID first for detail file naming
      const id = getNextWbsId();

      // Auto-create detail file in details/ directory if not specified
      let detailPath = options.detail || null;
      if (!detailPath) {
        const detailsDir = path.join(__dirname, 'details');
        if (!fs.existsSync(detailsDir)) {
          fs.mkdirSync(detailsDir, { recursive: true });
        }
        detailPath = `skills/wbs/details/${id}-detail.md`;
        const detailFullPath = path.join(__dirname, 'details', `${id}-detail.md`);

        // Create placeholder detail file
        const placeholder = `# ${title}\n\n## 개요\n\n(프로젝트 개요를 작성하세요)\n\n## 요구사항\n\n(요구사항을 작성하세요)\n\n## 참고 자료\n\n(참고 자료 링크나 설명을 추가하세요)\n`;
        fs.writeFileSync(detailFullPath, placeholder);
      }

      // Create project with pre-generated ID
      const now = new Date().toISOString();
      alasql('INSERT INTO wbs VALUES (?, ?, ?, ?, ?)', [id, title, detailPath, 'planning', now]);
      saveData();

      console.log(JSON.stringify({ id, title, detailPath }, null, 2));
      break;
    }

    case 'list': {
      const projects = wbs.list();
      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        console.log(formatProjectList(projects));
      }
      break;
    }

    case 'status': {
      const wbsId = args[1];
      if (!wbsId) {
        console.error('Usage: wbs.js status <wbs-id> [--json]');
        process.exit(1);
      }
      const result = wbs.status(wbsId);

      // Enhanced output with summary
      if (result.project) {
        const pending = result.jobs.filter(j => j.status === 'pending').length;
        const running = result.jobs.filter(j => j.status === 'running').length;
        const completed = result.jobs.filter(j => j.status === 'completed').length;
        const failed = result.jobs.filter(j => j.status === 'failed').length;

        result.summary = {
          total: result.jobs.length,
          pending,
          running,
          completed,
          failed,
          progress: result.jobs.length > 0
            ? Math.round((completed / result.jobs.length) * 100)
            : 0
        };
      }

      if (hasJsonFlag(args)) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatProjectStatus(result));
      }
      break;
    }

    case 'delete': {
      const wbsId = args[1];
      if (!wbsId) {
        console.error('Usage: wbs.js delete <wbs-id>');
        process.exit(1);
      }
      wbs.delete(wbsId);
      console.log(`Deleted: ${wbsId}`);
      break;
    }

    // === Job Sub-Commands ===
    case 'job': {
      handleJobCommand(args.slice(1));
      break;
    }

    // === Execution Sub-Commands ===
    case 'exec': {
      handleExecCommand(args.slice(1));
      break;
    }

    // === Daemon Sub-Commands ===
    case 'daemon': {
      handleDaemonCommand(args.slice(1));
      break;
    }

    // === Coordinator Natural Language Interface ===
    case 'q':
    case 'query': {
      const prompt = args.slice(1).join(' ');
      if (!prompt) {
        console.error('Usage: wbs.js q "your question"');
        process.exit(1);
      }
      // Call coordinator via crewx q
      const command = `crewx q "@wbs_coordinator ${prompt}"`;
      try {
        execSync(command, { stdio: 'inherit', cwd: __dirname });
      } catch (e) {
        process.exit(e.status || 1);
      }
      break;
    }

    case 'x':
    case 'execute': {
      const prompt = args.slice(1).join(' ');
      if (!prompt) {
        console.error('Usage: wbs.js x "your request"');
        process.exit(1);
      }
      // Call coordinator via crewx x
      const command = `crewx x "@wbs_coordinator ${prompt}"`;
      try {
        execSync(command, { stdio: 'inherit', cwd: __dirname });
      } catch (e) {
        process.exit(e.status || 1);
      }
      break;
    }

    default:
      showHelp();
  }
}

module.exports = wbs;
