#!/usr/bin/env node
/**
 * Memory Daemon - Background consolidation service
 * v0.2.0 - Simplified: Just triggers memory_agent
 *
 * Usage:
 *   node memory-daemon.js start       # Start daemon (runs every 24h)
 *   node memory-daemon.js run-once    # Run once and exit
 *   node memory-daemon.js status      # Check daemon status
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const LOG_FILE = path.join(SCRIPT_DIR, 'data', 'daemon.log');
const PID_FILE = path.join(SCRIPT_DIR, 'data', 'daemon.pid');
const CREWX_YAML = path.join(SCRIPT_DIR, 'crewx.yaml');

// Configuration
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Logging
function log(message) {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const logLine = `[${timestamp}] ${message}\n`;
    console.log(logLine.trim());

    // Ensure data directory exists
    const dataDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logLine);
}

// Main consolidation - just call memory_agent
function runConsolidation() {
    log('=== Starting consolidation ===');

    try {
        const result = execSync(
            `npx -y crewx q -c "${CREWX_YAML}" "@summary_agent 모든 에이전트 메모리 정리해줘"`,
            {
                encoding: 'utf-8',
                cwd: SCRIPT_DIR,
                timeout: 300000 // 5 minutes
            }
        );
        log('Result: ' + result.trim().slice(0, 200));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('=== Consolidation complete ===\n');
}

// Start daemon
function startDaemon() {
    // Check if already running
    if (fs.existsSync(PID_FILE)) {
        const existingPid = fs.readFileSync(PID_FILE, 'utf-8').trim();
        try {
            process.kill(parseInt(existingPid), 0);
            console.log(`Daemon already running (PID: ${existingPid})`);
            process.exit(1);
        } catch (e) {
            fs.unlinkSync(PID_FILE);
        }
    }

    fs.writeFileSync(PID_FILE, process.pid.toString());

    log('Daemon started (PID: ' + process.pid + ')');
    log('Interval: 24 hours');

    // Run immediately
    runConsolidation();

    // Schedule periodic runs
    setInterval(runConsolidation, INTERVAL_MS);

    // Handle shutdown
    const cleanup = () => {
        log('Daemon stopped');
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
        process.exit(0);
    };
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

    console.log('Daemon running. Press Ctrl+C to stop.');
}

// Check status
function checkStatus() {
    if (fs.existsSync(PID_FILE)) {
        const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
        try {
            process.kill(parseInt(pid), 0);
            console.log(`Daemon is running (PID: ${pid})`);

            if (fs.existsSync(LOG_FILE)) {
                const logs = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
                console.log('\nRecent logs:');
                console.log(logs.slice(-10).join('\n'));
            }
        } catch (e) {
            console.log('Daemon is not running (stale PID file)');
            fs.unlinkSync(PID_FILE);
        }
    } else {
        console.log('Daemon is not running');
    }
}

// Main
const command = process.argv[2];

switch (command) {
    case 'start':
        startDaemon();
        break;

    case 'run-once':
        runConsolidation();
        break;

    case 'status':
        checkStatus();
        break;

    default:
        console.log(`Memory Daemon v0.2.0

Usage:
  node memory-daemon.js start       Start daemon (24h interval)
  node memory-daemon.js run-once    Run once and exit
  node memory-daemon.js status      Check daemon status

The daemon calls memory_agent to consolidate old memories.
`);
        break;
}
