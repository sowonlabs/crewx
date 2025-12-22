#!/usr/bin/env node
// Memory Skill - Helper Script (JavaScript version)
// v0.4.0 - Added memory consolidation (6-month window, monthly summaries)

// Ensure UTF-8 output encoding
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

// Usage:
//   node sql.js remember <agent_id> <category> <content>
//   node sql.js recall <agent_id> <query>
//   node sql.js query <agent_id> <sql>
//   node sql.js consolidate <agent_id>           - Find memories older than 6 months
//   node sql.js archive <agent_id> <period> <summary>  - Archive a month with summary
//   node sql.js query-archive <agent_id> <period>      - Query archive for raw details

const fs = require('fs');
const path = require('path');
const alasql = require('alasql');

// Memory data stored in skill directory
const SKILL_DIR = __dirname;
const MEMORY_DIR = path.join(SKILL_DIR, 'data');
const USAGE_LOG = path.join(SKILL_DIR, 'usage.log');

// Configuration
const WINDOW_MONTHS = 6; // Keep raw memories for 6 months

// Get local timestamp (consistent with memory.js)
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

// Simple logging - just log what was executed
function logUsage(args) {
    try {
        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
        }
        const timestamp = getLocalTimestamp();
        const logLine = `${timestamp} | [sql.js] ${args.join(' ')}\n`;
        fs.appendFileSync(USAGE_LOG, logLine);
    } catch (e) {
        // Silently fail
    }
}

// Get memory file path for agent
function getMemoryFile(agentId) {
    return path.join(MEMORY_DIR, `${agentId}.json`);
}

// Initialize directory and file
function initMemory(agentId) {
    if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    const memoryFile = getMemoryFile(agentId);
    if (!fs.existsSync(memoryFile)) {
        fs.writeFileSync(memoryFile, JSON.stringify({ memories: [] }, null, 2));
    }
    return memoryFile;
}

// Load memories as array
function loadMemories(agentId) {
    const memoryFile = initMemory(agentId);
    const data = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    return data.memories || [];
}

// Save memories
function saveMemories(agentId, memories) {
    const memoryFile = getMemoryFile(agentId);
    fs.writeFileSync(memoryFile, JSON.stringify({ memories }, null, 2));
}

// Get archive file path for agent
function getArchiveFile(agentId) {
    return path.join(MEMORY_DIR, `${agentId}.archive.json`);
}

// Load archive
function loadArchive(agentId) {
    const archiveFile = getArchiveFile(agentId);
    if (!fs.existsSync(archiveFile)) {
        return [];
    }
    const data = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
    return data.memories || [];
}

// Save archive
function saveArchive(agentId, memories) {
    const archiveFile = getArchiveFile(agentId);
    fs.writeFileSync(archiveFile, JSON.stringify({ memories }, null, 2));
}

// Get cutoff date (6 months ago)
function getCutoffDate() {
    const date = new Date();
    date.setMonth(date.getMonth() - WINDOW_MONTHS);
    return date.toISOString().slice(0, 10);
}

// Get period (YYYY-MM) from date
function getPeriod(dateStr) {
    return dateStr.slice(0, 7);
}

// Store memory
function remember(agentId, category, content) {
    const memories = loadMemories(agentId);

    const now = new Date();
    const id = `mem_${now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
    const timestamp = now.toISOString();
    const date = timestamp.slice(0, 10); // YYYY-MM-DD for easier SQL queries

    memories.push({
        id,
        timestamp,
        date,
        category,
        content
    });

    saveMemories(agentId, memories);
    console.log(`Stored: [${agentId}] [${category}] ${content}`);
}

// Recall with keyword search (backward compatible)
function recall(agentId, queryStr) {
    const memories = loadMemories(agentId);

    if (memories.length === 0) {
        console.log('No memories found');
        return;
    }

    if (queryStr === 'all' || queryStr === '전체') {
        memories.forEach(m => {
            console.log(`[${m.date}] [${m.category}] ${m.content}`);
        });
    } else {
        const regex = new RegExp(queryStr, 'i');
        const results = memories.filter(m => regex.test(m.content) || regex.test(m.category));

        if (results.length === 0) {
            console.log('No matching memories found');
        } else {
            results.forEach(m => {
                console.log(`[${m.date}] [${m.category}] ${m.content}`);
            });
        }
    }
}

// SQL query with alasql
function query(agentId, sql) {
    const memories = loadMemories(agentId);

    if (memories.length === 0) {
        console.log('No memories found');
        return;
    }

    try {
        // Register memories as table
        alasql('DROP TABLE IF EXISTS memories');
        alasql('CREATE TABLE memories');
        alasql.tables.memories.data = memories;

        // Execute SQL query
        const results = alasql(sql);

        if (!results || results.length === 0) {
            console.log('No results');
            return;
        }

        // Output results
        if (typeof results === 'number') {
            console.log(`Affected rows: ${results}`);
        } else if (Array.isArray(results)) {
            results.forEach(row => {
                if (row.content) {
                    console.log(`[${row.date || ''}] [${row.category || ''}] ${row.content}`);
                } else {
                    console.log(JSON.stringify(row));
                }
            });
        } else {
            console.log(JSON.stringify(results));
        }
    } catch (err) {
        console.error(`SQL Error: ${err.message}`);
        process.exit(1);
    }
}

// Consolidate: Find memories older than 6 months, group by month
function consolidate(agentId) {
    const memories = loadMemories(agentId);
    const cutoffDate = getCutoffDate();

    // Separate old and recent memories
    const oldMemories = memories.filter(m => m.date < cutoffDate && m.category !== 'summary');
    const recentMemories = memories.filter(m => m.date >= cutoffDate || m.category === 'summary');

    if (oldMemories.length === 0) {
        console.log(JSON.stringify({
            status: 'no_action',
            message: 'No memories older than 6 months',
            cutoff_date: cutoffDate
        }));
        return;
    }

    // Group by month
    const grouped = {};
    oldMemories.forEach(m => {
        const period = getPeriod(m.date);
        if (!grouped[period]) {
            grouped[period] = [];
        }
        grouped[period].push(m);
    });

    // Output for daemon to process
    console.log(JSON.stringify({
        status: 'needs_consolidation',
        cutoff_date: cutoffDate,
        periods: Object.keys(grouped).sort(),
        by_period: grouped,
        recent_count: recentMemories.length,
        old_count: oldMemories.length
    }, null, 2));
}

// Archive: Move old memories to archive and add summary to main file
function archive(agentId, period, summary) {
    const memories = loadMemories(agentId);
    const existingArchive = loadArchive(agentId);

    // Find memories for this period
    const toArchive = memories.filter(m => getPeriod(m.date) === period && m.category !== 'summary');
    const remaining = memories.filter(m => getPeriod(m.date) !== period || m.category === 'summary');

    if (toArchive.length === 0) {
        console.log(`No memories found for period ${period}`);
        return;
    }

    // Add to archive
    const updatedArchive = [...existingArchive, ...toArchive];
    saveArchive(agentId, updatedArchive);

    // Add summary to main file
    const now = new Date();
    const summaryEntry = {
        id: `summary_${period}`,
        timestamp: now.toISOString(),
        date: `${period}-01`, // First day of month for sorting
        category: 'summary',
        period: period,
        content: summary,
        original_count: toArchive.length
    };

    // Check if summary for this period already exists
    const existingSummaryIndex = remaining.findIndex(m => m.id === `summary_${period}`);
    if (existingSummaryIndex >= 0) {
        remaining[existingSummaryIndex] = summaryEntry;
    } else {
        remaining.push(summaryEntry);
    }

    // Sort by date
    remaining.sort((a, b) => a.date.localeCompare(b.date));

    saveMemories(agentId, remaining);

    console.log(`Archived ${toArchive.length} memories from ${period}`);
    console.log(`Summary added: ${summary.slice(0, 100)}...`);
}

// Query archive for detailed old memories
function queryArchive(agentId, period) {
    const archive = loadArchive(agentId);

    if (archive.length === 0) {
        console.log('No archived memories found');
        return;
    }

    let results;
    if (period === 'all' || period === '전체') {
        results = archive;
    } else {
        results = archive.filter(m => getPeriod(m.date) === period);
    }

    if (results.length === 0) {
        console.log(`No archived memories for period ${period}`);
        return;
    }

    results.forEach(m => {
        console.log(`[${m.date}] [${m.category}] ${m.content}`);
    });
}

// List all agents with memory files
function listAgents() {
    if (!fs.existsSync(MEMORY_DIR)) {
        console.log('No memory data found');
        return;
    }

    const files = fs.readdirSync(MEMORY_DIR)
        .filter(f => f.endsWith('.json') && !f.includes('.archive'))
        .map(f => f.replace('.json', ''));

    if (files.length === 0) {
        console.log('No agents found');
        return;
    }

    console.log(JSON.stringify(files));
}

// Show usage log (recent 20 lines)
function showUsageStats() {
    if (!fs.existsSync(USAGE_LOG)) {
        console.log('No usage data found');
        return;
    }

    const lines = fs.readFileSync(USAGE_LOG, 'utf-8').trim().split('\n');
    console.log(`Total: ${lines.length} calls\n`);
    console.log('Recent 20:');
    lines.slice(-20).forEach(line => console.log(line));
}

// Main
const args = process.argv.slice(2);
const command = args[0];

// Log all commands
logUsage(args);

switch (command) {
    case 'remember':
        if (args.length < 4) {
            console.error('Usage: node sql.js remember <agent_id> <category> <content>');
            process.exit(1);
        }
        remember(args[1], args[2], args.slice(3).join(' '));
        break;

    case 'recall':
        if (args.length < 3) {
            console.error('Usage: node sql.js recall <agent_id> <query>');
            process.exit(1);
        }
        recall(args[1], args.slice(2).join(' '));
        break;

    case 'query':
        if (args.length < 3) {
            console.error('Usage: node sql.js query <agent_id> <sql>');
            process.exit(1);
        }
        query(args[1], args.slice(2).join(' '));
        break;

    case 'consolidate':
        if (args.length < 2) {
            console.error('Usage: node sql.js consolidate <agent_id>');
            process.exit(1);
        }
        consolidate(args[1]);
        break;

    case 'archive':
        if (args.length < 4) {
            console.error('Usage: node sql.js archive <agent_id> <period> <summary>');
            process.exit(1);
        }
        archive(args[1], args[2], args.slice(3).join(' '));
        break;

    case 'query-archive':
        if (args.length < 3) {
            console.error('Usage: node sql.js query-archive <agent_id> <period>');
            process.exit(1);
        }
        queryArchive(args[1], args[2]);
        break;

    case 'list-agents':
        listAgents();
        break;

    case 'usage-stats':
        showUsageStats();
        break;

    default:
        console.log('Memory Skill v0.4.0');
        console.log('');
        console.log('Commands:');
        console.log('  remember <agent_id> <category> <content>  - Store a memory');
        console.log('  recall <agent_id> <query>                 - Search by keyword');
        console.log('  query <agent_id> <sql>                    - SQL query');
        console.log('  consolidate <agent_id>                    - Find memories older than 6 months');
        console.log('  archive <agent_id> <period> <summary>     - Archive a month with summary');
        console.log('  query-archive <agent_id> <period>         - Query archive for raw details');
        console.log('  list-agents                               - List all agents');
        console.log('  usage-stats                               - Show usage log');
        console.log('');
        console.log('Categories: preference, project, decision, task, schedule, context, general, summary');
        console.log('');
        console.log('Examples:');
        console.log('  node sql.js remember cso decision "MVP 방향 확정"');
        console.log('  node sql.js consolidate cso');
        console.log('  node sql.js archive cso 2024-06 "[6월 요약] 전략 수립..."');
        console.log('  node sql.js query-archive cso 2024-06');
        console.log('');
        console.log('Storage: skills/memory/data/{agent_id}.json');
        console.log('Archive: skills/memory/data/{agent_id}.archive.json');
        console.log('Usage Log: skills/memory/usage.log');
        process.exit(1);
}
