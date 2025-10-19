import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { TaskManagementService } from '../services/task-management.service';
import { ResultFormatterService } from '../services/result-formatter.service';
import { ParallelProcessingService } from '../services/parallel-processing.service';
import { AIProviderService } from '../ai-provider.service';

export interface DoctorOptions {
  config?: string;
  workingDirectory?: string;
  verbose?: boolean;
}

export interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

@Injectable()
export class DoctorHandler {
  constructor(
    private readonly taskManagementService: TaskManagementService,
    private readonly resultFormatterService: ResultFormatterService,
    private readonly parallelProcessingService: ParallelProcessingService,
    private readonly aiProviderService: AIProviderService,
  ) {}

  async handle(options: DoctorOptions = {}): Promise<{ success: boolean; message: string; taskId: string; diagnostics: DiagnosticResult[] }> {
    const taskId = this.taskManagementService.createTask({
      type: 'doctor',
      command: 'crewx doctor',
      options: options
    });

    try {
      this.taskManagementService.addTaskLog(taskId, {
        level: 'info',
        message: 'Starting CrewX system diagnosis'
      });

      const workingDir = options.workingDirectory || process.cwd();

      // Support both crewx.yaml and agents.yaml (backward compatibility)
      let configPath = options.config;
      if (!configPath) {
        // Priority: crewx.yaml > agents.yaml
        const crewConfigPath = join(workingDir, 'crewx.yaml');
        const agentsYamlPath = join(workingDir, 'agents.yaml');

        if (existsSync(crewConfigPath)) {
          configPath = 'crewx.yaml';
        } else if (existsSync(agentsYamlPath)) {
          configPath = 'agents.yaml';
        } else {
          configPath = 'crewx.yaml'; // Default for error messages
        }
      }

      const fullConfigPath = join(workingDir, configPath);

      const diagnostics: DiagnosticResult[] = [];

      // 1. Check configuration file
      const configDiagnostic = await this.checkConfigurationFile(fullConfigPath);
      diagnostics.push(configDiagnostic);

      // 2. Check logs directory
      const logsDiagnostic = await this.checkLogsDirectory(workingDir);
      diagnostics.push(logsDiagnostic);

      // 3. Check AI providers availability
      const aiProviderDiagnostics = await this.checkAIProviders();
      diagnostics.push(...aiProviderDiagnostics);

      // 4. Test AI providers if config is valid
      if (configDiagnostic.status === 'success') {
        const testDiagnostics = await this.testAIProviders(fullConfigPath, taskId);
        diagnostics.push(...testDiagnostics);
      }

      // 5. Overall health assessment
      const overallHealth = this.assessOverallHealth(diagnostics);
      
      const successMessage = this.formatDiagnosticReport(diagnostics, overallHealth);
      const isHealthy = overallHealth.status !== 'error';
      
      this.taskManagementService.completeTask(taskId, { 
        message: successMessage, 
        diagnostics,
        health: overallHealth 
      }, isHealthy);
      
      return { 
        success: isHealthy, 
        message: successMessage, 
        taskId,
        diagnostics 
      };

    } catch (error) {
      const errorMessage = `Failed to complete system diagnosis: ${error instanceof Error ? error.message : String(error)}`;
      this.taskManagementService.addTaskLog(taskId, { 
        level: 'error', 
        message: errorMessage 
      });
      
      this.taskManagementService.completeTask(taskId, { error: errorMessage }, false);
      return { 
        success: false, 
        message: errorMessage, 
        taskId,
        diagnostics: [{
          name: 'System Error',
          status: 'error',
          message: errorMessage
        }]
      };
    }
  }

  private async checkConfigurationFile(configPath: string): Promise<DiagnosticResult> {
    try {
      if (!existsSync(configPath)) {
        return {
          name: 'Configuration File',
          status: 'error',
          message: 'Configuration file not found',
          details: `Run 'crewx init' to create configuration file at ${configPath}`
        };
      }

      const configContent = readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      if (!config || !config.agents || !Array.isArray(config.agents)) {
        return {
          name: 'Configuration File',
          status: 'error',
          message: 'Invalid configuration format',
          details: 'Configuration file exists but has invalid structure'
        };
      }

      if (config.agents.length === 0) {
        return {
          name: 'Configuration File',
          status: 'warning',
          message: 'No agents configured',
          details: 'Configuration file exists but contains no agent definitions'
        };
      }

      return {
        name: 'Configuration File',
        status: 'success',
        message: `Found ${config.agents.length} agent(s) configured`,
        details: `Configuration loaded from ${configPath}`
      };

    } catch (error) {
      return {
        name: 'Configuration File',
        status: 'error',
        message: 'Failed to parse configuration',
        details: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkLogsDirectory(workingDir: string): Promise<DiagnosticResult> {
    const logsDir = join(workingDir, '.crewx', 'logs');
    
    if (!existsSync(logsDir)) {
      return {
        name: 'Logs Directory',
        status: 'warning',
        message: 'Logs directory not found',
        details: `Directory will be created automatically: ${logsDir}`
      };
    }

    return {
      name: 'Logs Directory',
      status: 'success',
      message: 'Logs directory exists',
      details: `Logs available at ${logsDir}`
    };
  }

  private async checkAIProviders(): Promise<DiagnosticResult[]> {
    const providers = ['claude', 'gemini', 'copilot', 'codex'];
    const diagnostics: DiagnosticResult[] = [];

    for (const provider of providers) {
      try {
        const providerInstance = this.aiProviderService.getProvider(`cli/${provider}` as any);
        const isAvailable = providerInstance ? await providerInstance.isAvailable() : false;

        diagnostics.push({
          name: `${provider.toUpperCase()} CLI`,
          status: isAvailable ? 'success' : 'warning',
          message: isAvailable ? 'Installed and available' : 'Not installed or not available',
          details: isAvailable ?
            `${provider} CLI is ready for use` :
            `Install ${provider} CLI to use ${provider} agents`
        });
      } catch (error) {
        diagnostics.push({
          name: `${provider.toUpperCase()} CLI`,
          status: 'error',
          message: 'Check failed',
          details: `Error checking ${provider}: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    return diagnostics;
  }


  private async testAIProviders(configPath: string, taskId: string): Promise<DiagnosticResult[]> {
    try {
      this.taskManagementService.addTaskLog(taskId, { 
        level: 'info', 
        message: 'Testing AI providers with simple queries' 
      });

      const configContent = readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as any;
      
      // Create test queries for available agents
      const testQueries = config.agents
        .filter((agent: any) => agent.inline?.provider)
        .map((agent: any) => ({
          agentId: agent.id,
          query: 'Hello, please respond with "OK" to confirm you are working.',
          context: 'System diagnostic test'
        }));

      if (testQueries.length === 0) {
        return [{
          name: 'AI Provider Testing',
          status: 'warning',
          message: 'No testable agents found',
          details: 'No agents with provider configuration available for testing'
        }];
      }

      // Run parallel tests with timeout
      const results = await this.parallelProcessingService.queryAgentsParallel(testQueries, {
        timeout: 30000 // 30 second timeout
      });

      const diagnostics: DiagnosticResult[] = [];

      results.results.forEach((result, index) => {
        const agentId = testQueries[index].agentId;
        
        if (result.success) {
          diagnostics.push({
            name: `Agent Test: ${agentId}`,
            status: 'success',
            message: 'Responding correctly',
            details: `Agent ${agentId} successfully responded to test query`
          });
        } else {
          const isSessionLimit = result.error?.includes('session limit') || result.error?.includes('Session limit');
          diagnostics.push({
            name: `Agent Test: ${agentId}`,
            status: isSessionLimit ? 'warning' : 'error',
            message: isSessionLimit ? 'Session limit reached' : 'Failed to respond',
            details: result.error || 'Unknown error during test'
          });
        }
      });

      return diagnostics;

    } catch (error) {
      return [{
        name: 'AI Provider Testing',
        status: 'error',
        message: 'Test execution failed',
        details: `Error during AI provider testing: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private assessOverallHealth(diagnostics: DiagnosticResult[]): { status: 'success' | 'warning' | 'error'; message: string } {
    const errorCount = diagnostics.filter(d => d.status === 'error').length;
    const warningCount = diagnostics.filter(d => d.status === 'warning').length;
    const successCount = diagnostics.filter(d => d.status === 'success').length;

    if (errorCount > 0) {
      return {
        status: 'error',
        message: `System has ${errorCount} error(s) that need attention`
      };
    }

    if (warningCount > 0) {
      return {
        status: 'warning',
        message: `System is functional with ${warningCount} warning(s)`
      };
    }

    return {
      status: 'success',
      message: `System is healthy - all ${successCount} checks passed`
    };
  }

  private formatDiagnosticReport(diagnostics: DiagnosticResult[], overallHealth: { status: string; message: string }): string {
    const statusIcon = (status: string) => {
      switch (status) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return '🔍';
      }
    };

    const healthIcon = statusIcon(overallHealth.status);
    
    let report = `${healthIcon} **CrewX System Diagnosis**\n\n`;
    report += `**Overall Health:** ${overallHealth.message}\n\n`;
    report += `**Diagnostic Results:**\n`;

    diagnostics.forEach(diagnostic => {
      const icon = statusIcon(diagnostic.status);
      report += `${icon} **${diagnostic.name}:** ${diagnostic.message}\n`;
      if (diagnostic.details) {
        report += `   ${diagnostic.details}\n`;
      }
      report += '\n';
    });

    // Add recommendations
    const errors = diagnostics.filter(d => d.status === 'error');
    const warnings = diagnostics.filter(d => d.status === 'warning');

    if (errors.length > 0 || warnings.length > 0) {
      report += `**Recommendations:**\n`;
      
      if (errors.some(e => e.name === 'Configuration File')) {
        report += `• Run \`crewx init\` to create or fix configuration\n`;
      }
      
      if (errors.some(e => e.name.includes('CLI'))) {
        report += `• Install missing AI CLI tools\n`;
      }
      
      if (warnings.some(w => w.name.includes('session limit'))) {
        report += `• Some AI providers have reached their session limits - try again later\n`;
      }
      
      report += '\n';
    }

    report += `**Next Steps:**\n`;
    if (overallHealth.status === 'success') {
      report += `• Your CrewX setup is ready to use!\n`;
      report += `• Try: \`crewx query "@claude hello world"\`\n`;
    } else {
      report += `• Address the issues above to improve system health\n`;
      report += `• Run \`crewx doctor\` again after making changes\n`;
    }

    return report;
  }
}

// Legacy function for backward compatibility
import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { CrewXTool } from '../crewx.tool';

const logger = new Logger('DoctorHandler');

/**
 * Handle doctor command: crewx doctor
 * Legacy function - now uses DoctorHandler class
 */
export async function handleDoctor(app: any, args: CliOptions) {
  if (args.log) logger.log('Doctor command received');

  try {
    console.log('🩺 Starting comprehensive system diagnosis...\n');
    
    const doctorHandler = app.get(DoctorHandler);
    
    const result = await doctorHandler.handle({
      config: args.config,
      verbose: args.log
    });
    
    // Print the formatted diagnostic report
    console.log(result.message);
    
    if (!result.success) {
      process.exit(1);
    }
    
  } catch (error) {
    if (args.log) logger.error(`Doctor check failed: ${error instanceof Error ? error.message : error}`);
    console.log('❌ System diagnosis failed');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}