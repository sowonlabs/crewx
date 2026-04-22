/**
 * crewx doctor handler.
 * Performs system diagnosis: checks config, CLI tools, and environment.
 *
 * Usage:
 *   crewx doctor                  Run full diagnosis
 *   crewx doctor --config <path>  Use specific config file
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { loadYamlFile } from '@crewx/sdk';
import { parseCommonFlags } from './parse-common-flags';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

function statusIcon(status: DiagnosticResult['status']): string {
  switch (status) {
    case 'success': return '✅';
    case 'warning': return '⚠️ ';
    case 'error': return '❌';
  }
}

/**
 * Check if a CLI command is available on PATH.
 */
function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check crewx.yaml configuration file.
 */
function checkConfig(configPath: string): DiagnosticResult {
  if (!existsSync(configPath)) {
    return {
      name: 'Configuration File',
      status: 'error',
      message: `Configuration file not found: ${configPath}`,
      details: "Run 'crewx init' to create a default configuration file.",
    };
  }

  try {
    const raw = loadYamlFile(configPath);
    const config = raw as { agents?: unknown[] } | undefined;

    if (!config?.agents || !Array.isArray(config.agents)) {
      return {
        name: 'Configuration File',
        status: 'error',
        message: 'Invalid configuration format',
        details: 'Configuration file exists but has invalid structure.',
      };
    }

    if (config.agents.length === 0) {
      return {
        name: 'Configuration File',
        status: 'warning',
        message: 'No agents configured',
        details: 'Add agent definitions to your crewx.yaml.',
      };
    }

    return {
      name: 'Configuration File',
      status: 'success',
      message: `Found ${config.agents.length} agent(s) in ${configPath}`,
    };
  } catch (err) {
    return {
      name: 'Configuration File',
      status: 'error',
      message: 'Failed to parse configuration',
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check .crewx/logs directory.
 */
function checkLogsDir(): DiagnosticResult {
  const logsDir = join(process.cwd(), '.crewx', 'logs');
  if (!existsSync(logsDir)) {
    return {
      name: 'Logs Directory',
      status: 'warning',
      message: 'Logs directory not found',
      details: `Will be created automatically at ${logsDir}`,
    };
  }
  return {
    name: 'Logs Directory',
    status: 'success',
    message: `Logs directory exists: ${logsDir}`,
  };
}

/**
 * Check CLI provider availability.
 */
function checkCliProviders(): DiagnosticResult[] {
  const providers = [
    { name: 'claude', cmd: 'claude', install: 'npm install -g @anthropic-ai/claude-code' },
    { name: 'gemini', cmd: 'gemini', install: 'npm install -g @google/gemini-cli' },
    { name: 'copilot (gh)', cmd: 'gh', install: 'brew install gh  # or visit cli.github.com' },
  ];

  return providers.map(p => {
    const available = isCommandAvailable(p.cmd);
    return {
      name: `${p.name.toUpperCase()} CLI`,
      status: available ? ('success' as const) : ('warning' as const),
      message: available ? 'Installed and available' : 'Not installed or not on PATH',
      details: available ? undefined : `Install: ${p.install}`,
    };
  });
}

/**
 * Check CREWX_CLI env var.
 */
function checkEnvVars(): DiagnosticResult {
  const crewxCli = process.env.CREWX_CLI;
  if (crewxCli) {
    return {
      name: 'CREWX_CLI',
      status: 'success',
      message: `Set to: ${crewxCli}`,
    };
  }
  return {
    name: 'CREWX_CLI',
    status: 'warning',
    message: 'Not set — defaulting to "npx crewx"',
    details: 'This is auto-set at CLI startup; no action needed.',
  };
}

/**
 * Assess overall health.
 */
function assessHealth(diagnostics: DiagnosticResult[]): { status: DiagnosticResult['status']; message: string } {
  const errors = diagnostics.filter(d => d.status === 'error').length;
  const warnings = diagnostics.filter(d => d.status === 'warning').length;
  const successes = diagnostics.filter(d => d.status === 'success').length;

  if (errors > 0) {
    return { status: 'error', message: `System has ${errors} error(s) that need attention` };
  }
  if (warnings > 0) {
    return { status: 'warning', message: `System is functional with ${warnings} warning(s)` };
  }
  return { status: 'success', message: `System is healthy — all ${successes} checks passed` };
}

/**
 * Handle `crewx doctor` command.
 */
export async function handleDoctor(args: string[]): Promise<void> {
  const { config } = parseCommonFlags(args);
  const configPath = config ?? process.env.CREWX_CONFIG ?? join(process.cwd(), 'crewx.yaml');

  console.log('🩺 Starting CrewX system diagnosis...\n');

  const diagnostics: DiagnosticResult[] = [
    checkConfig(configPath),
    checkLogsDir(),
    checkEnvVars(),
    ...checkCliProviders(),
  ];

  // Print diagnostics
  diagnostics.forEach(d => {
    const icon = statusIcon(d.status);
    console.log(`${icon} ${d.name}: ${d.message}`);
    if (d.details) {
      console.log(`   ${d.details}`);
    }
  });

  const health = assessHealth(diagnostics);
  const healthIcon = statusIcon(health.status);

  console.log('');
  console.log('─'.repeat(60));
  console.log(`${healthIcon} Overall: ${health.message}`);

  if (health.status === 'success') {
    console.log('\nNext steps:');
    console.log('  crewx query "@claude hello"');
  } else {
    console.log('\nAddress the issues above, then run `crewx doctor` again.');
  }

  if (health.status === 'error') {
    process.exit(1);
  }
}
