import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AIProviderService } from './ai-provider.service';
import { getErrorMessage, getErrorStack } from './utils/error-utils';
import { getTimeoutConfig } from './config/timeout.config';

const execAsync = promisify(exec);

export interface AIResponse {
  content: string;
  provider: 'claude' | 'gemini' | 'copilot';
  command: string;
  success: boolean;
  error?: string;
  taskId?: string;
}

export interface AIQueryOptions {
  timeout?: number;
  workingDirectory?: string;
  additionalArgs?: string[];
  model?: string; // Model to use for this query (e.g., "sonnet", "gemini-2.5-pro", "gpt-5")
  securityKey?: string; // Security key for prompt injection protection
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly logsDir = join(process.cwd(), '.crewx', 'logs');
  private readonly timeoutConfig = getTimeoutConfig();

  constructor(private readonly aiProviderService: AIProviderService) {
    // Create log directory
    try {
      mkdirSync(this.logsDir, { recursive: true });
    } catch (error) {
      // Ignore if already exists
    }
  }

  private createTaskLogFile(taskId: string, provider: string, command: string): string {
    const logFile = join(this.logsDir, `${taskId}.log`);
    const timestamp = new Date().toLocaleString();
    const header = `=== TASK LOG: ${taskId} ===
Provider: ${provider}
Command: ${command}
Started: ${timestamp}

`;
    writeFileSync(logFile, header, 'utf8');
    return logFile;
  }

  private appendTaskLog(taskId: string, level: 'STDOUT' | 'STDERR' | 'INFO' | 'ERROR', message: string): void {
    try {
      const logFile = join(this.logsDir, `${taskId}.log`);
      const timestamp = new Date().toLocaleString();
      const logEntry = `[${timestamp}] ${level}: ${message}\n`;
      appendFileSync(logFile, logEntry, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to append to task log ${taskId}:`, getErrorMessage(error));
    }
  }

  private async findClaudePath(): Promise<string | null> {
    try {
      this.logger.log('🔍 Attempting to find Claude CLI path...');
      this.logger.log(`📁 Current working directory: ${process.cwd()}`);
      this.logger.log(`🔧 PATH length: ${process.env.PATH?.length || 0}`);
      
      // Try synchronous approach
      const { execSync } = await import('child_process');
      this.logger.log('📦 execSync imported successfully');
      
      const path = execSync('which claude', { encoding: 'utf-8' }).trim();
      
      this.logger.log(`✅ Found Claude CLI at: ${path}`);
      return path;
    } catch (error: any) {
      this.logger.error(`❌ Claude not found in PATH: ${error.message}`);
      this.logger.error(`🔢 Error code: ${error.code}`);
      this.logger.error(`📍 Current PATH: ${process.env.PATH?.substring(0, 200)}...`);
      return null;
    }
  }

  async queryClaudeCLI(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    try {
      // Dynamically find Claude CLI path
      this.logger.log('🚀 Starting queryClaudeCLI...');
      const claudePath = await this.findClaudePath();
      this.logger.log(`🔍 findClaudePath result: ${claudePath}`);
      
      if (!claudePath) {
        this.logger.error('❌ Claude CLI not found in PATH - returning error');
        return {
          content: '',
          provider: 'claude',
          command: 'claude -p (stdin)',
          success: false,
          error: 'Claude CLI is not installed. Please install it from https://claude.ai/download.',
        };
      }

      // Pass prompt via stdin instead of using temporary files
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      
      this.logger.log(`Executing Claude with stdin prompt (length: ${prompt.length})`);
      this.logger.log(`Using Claude path: ${claudePath}`);
      this.logger.log(`Current working directory: ${process.cwd()}`);
      this.logger.log(`Options working directory: ${options.workingDirectory || 'not set'}`);
      this.logger.log(`Process PATH length: ${process.env.PATH?.length || 0}`);

      return new Promise((resolve, reject) => {
        const child = spawn(claudePath, ['-p'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env: process.env, // Inherit all environment variables
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            this.logger.error(`Claude CLI failed with code ${code}. stderr: ${stderr}`);
            resolve({
              content: '',
              provider: 'claude',
              command: 'claude -p (stdin)',
              success: false,
              error: `Claude CLI failed: ${stderr || `Exit code ${code}`}`
            });
            return;
          }

          if (stderr && stderr.trim()) {
            this.logger.warn(`Claude stderr: ${stderr}`);

            // Check for authentication errors
            if (stderr.includes('authentication') || stderr.includes('login') || stderr.includes('token')) {
              resolve({
                content: '',
                provider: 'claude',
                command: 'claude -p (stdin)',
                success: false,
                error: 'Claude CLI authentication is required. Set up token with "claude setup-token" command.',
              });
              return;
            }
          }

          // If stdout is empty, it might be an authentication issue
          if (!stdout || stdout.trim() === '') {
            resolve({
              content: '',
              provider: 'claude',
              command: 'claude -p (stdin)',
              success: false,
              error: 'No response received from Claude CLI. Check authentication status or run "claude setup-token".',
            });
            return;
          }

          resolve({
            content: stdout.trim(),
            provider: 'claude',
            command: 'claude -p (stdin)',
            success: true,
          });
        });

        child.on('error', (error: any) => {
          this.logger.error(`Claude spawn error: ${error.message}, code: ${error.code}`);
          this.logger.error(`Current working directory: ${process.cwd()}`);
          this.logger.error(`Environment PATH: ${process.env.PATH}`);
          resolve({
            content: '',
            provider: 'claude',
            command: 'claude -p (stdin)',
            success: false,
            error: error.code === 'ENOENT' ?
              'Claude CLI is not installed. Please install it from https://claude.ai/download.' :
              error.message,
          });
        });

        // Handle timeout
        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            content: '',
            provider: 'claude',
            command: 'claude -p (stdin)',
            success: false,
            error: 'Claude CLI response timeout. Check network connection or Claude server status.',
          });
        }, options.timeout || this.timeoutConfig.claudeQuery);

        child.on('close', () => {
          clearTimeout(timeout);
        });

        // Send prompt via stdin
        child.stdin.write(prompt);
        child.stdin.end();
      });
    } catch (error: any) {
      this.logger.error(`Claude execution failed: ${error.message}`, error.stack);
      
      return {
        content: '',
        provider: 'claude',
        command: 'claude -p (stdin)',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async queryClaudeWithPermissions(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    try {
      // Dynamically find Claude CLI path
      const claudePath = await this.findClaudePath();
      if (!claudePath) {
        this.logger.error('Claude CLI not found in PATH');
        return {
          content: '',
          provider: 'claude',
          command: 'claude -p --dangerously-skip-permissions (stdin)',
          success: false,
          error: 'Claude CLI is not installed. Please install it from https://claude.ai/download.',
        };
      }

      const { spawn } = await import('child_process');
      
      this.logger.log(`Executing Claude with file permissions (length: ${prompt.length})`);
      this.logger.log(`Using Claude path: ${claudePath}`);

      return new Promise((resolve, reject) => {
        const child = spawn(claudePath, ['-p', '--dangerously-skip-permissions'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env: process.env, // Inherit all environment variables
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            this.logger.error(`Claude CLI with permissions failed with code ${code}. stderr: ${stderr}`);
            resolve({
              content: '',
              provider: 'claude',
              command: 'claude -p --dangerously-skip-permissions (stdin)',
              success: false,
              error: `Claude CLI failed: ${stderr || `Exit code ${code}`}`
            });
            return;
          }

          if (stderr && stderr.trim()) {
            this.logger.warn(`Claude stderr: ${stderr}`);
            
            // Check for authentication errors
            if (stderr.includes('authentication') || stderr.includes('login') || stderr.includes('token')) {
              resolve({
                content: '',
                provider: 'claude',
                command: 'claude -p --dangerously-skip-permissions (stdin)',
                success: false,
                error: 'Claude CLI authentication is required. Set up token with "claude setup-token" command.',
              });
              return;
            }
          }

          // If stdout is empty, it might be an authentication issue
          if (!stdout || stdout.trim() === '') {
            resolve({
              content: '',
              provider: 'claude',
              command: 'claude -p --dangerously-skip-permissions (stdin)',
              success: false,
              error: 'No response received from Claude CLI. Check authentication status or run "claude setup-token".',
            });
            return;
          }

          resolve({
            content: stdout.trim(),
            provider: 'claude',
            command: 'claude -p --dangerously-skip-permissions (stdin)',
            success: true,
          });
        });

        child.on('error', (error: any) => {
          this.logger.error(`Claude with permissions spawn error: ${error.message}`);
          resolve({
            content: '',
            provider: 'claude',
            command: 'claude -p --dangerously-skip-permissions (stdin)',
            success: false,
            error: error.code === 'ENOENT' ?
              'Claude CLI is not installed. Please install it from https://claude.ai/download.' :
              error.message,
          });
        });

        // Handle timeout
        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            content: '',
            provider: 'claude',
            command: 'claude -p --dangerously-skip-permissions (stdin)',
            success: false,
            error: 'Claude CLI response timeout. Check network connection or Claude server status.',
          });
        }, options.timeout || this.timeoutConfig.claudeExecute);

        child.on('close', () => {
          clearTimeout(timeout);
        });

        // Send prompt via stdin
        child.stdin.write(prompt);
        child.stdin.end();
      });
    } catch (error: any) {
      this.logger.error(`Claude with permissions execution failed: ${error.message}`, error.stack);
      
      return {
        content: '',
        provider: 'claude',
        command: 'claude -p --dangerously-skip-permissions (stdin)',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async queryGeminiCLI(prompt: string, options: AIQueryOptions & { taskId?: string } = {}): Promise<AIResponse> {
    const taskId = options.taskId || `gemini_query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { spawn } = await import('child_process');
      
      this.logger.log(`Executing Gemini in query mode (length: ${prompt.length})`);

      // Create task log file
      this.createTaskLogFile(taskId, 'gemini', 'gemini -p');
      this.appendTaskLog(taskId, 'INFO', `Starting Gemini query mode`);
      this.appendTaskLog(taskId, 'INFO', `Prompt length: ${prompt.length} characters`);
      
      // Log prompt content (entire content for debugging)
      this.appendTaskLog(taskId, 'INFO', `Prompt content:\n${prompt}`);

      return new Promise((resolve, reject) => {
        // Use stdin mode for query (no --yolo for safety)
        const child = spawn('gemini', ['-p'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          this.appendTaskLog(taskId, 'STDOUT', output);
        });

        child.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          this.appendTaskLog(taskId, 'STDERR', output);
        });

        child.on('close', (code) => {
          this.appendTaskLog(taskId, 'INFO', `Process closed with exit code: ${code}`);
          
          if (stderr) {
            this.logger.warn(`[${taskId}] Gemini stderr: ${stderr}`);
          }

          if (code !== 0) {
            this.appendTaskLog(taskId, 'ERROR', `Gemini CLI failed with exit code ${code}`);
            resolve({
              content: '',
              provider: 'gemini',
              command: 'gemini (stdin)',
              success: false,
              error: `Gemini CLI failed: ${stderr || `Exit code ${code}`}`,
              taskId
            });
            return;
          }

          this.appendTaskLog(taskId, 'INFO', `Gemini query completed successfully`);
          resolve({
            content: stdout.trim(),
            provider: 'gemini',
            command: 'gemini (stdin)',
            success: true,
            taskId
          });
        });

        child.on('error', (error: any) => {
          this.appendTaskLog(taskId, 'ERROR', `Process error: ${error.message}`);
          resolve({
            content: '',
            provider: 'gemini',
            command: 'gemini (stdin)',
            success: false,
            error: error.code === 'ENOENT' ? 
              'Gemini CLI is not installed.' :
              error.message,
            taskId
          });
        });

        // Handle timeout
        const timeout = setTimeout(() => {
          this.appendTaskLog(taskId, 'ERROR', `Process timeout after ${options.timeout || this.timeoutConfig.geminiQuery}ms`);
          child.kill();
          resolve({
            content: '',
            provider: 'gemini',
            command: 'gemini (stdin)',
            success: false,
            error: 'Gemini CLI response timeout.',
            taskId
          });
        }, options.timeout || this.timeoutConfig.geminiQuery);

        child.on('close', () => {
          clearTimeout(timeout);
        });

        // Send prompt via stdin
        this.appendTaskLog(taskId, 'INFO', 'Sending prompt via stdin');
        child.stdin.write(prompt);
        child.stdin.end();
      });
    } catch (error: any) {
      this.logger.error(`Gemini execution failed: ${error.message}`, error.stack);
      return {
        content: '',
        provider: 'gemini',
        command: 'gemini (stdin)',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async executeGeminiCLI(prompt: string, options: AIQueryOptions & { taskId?: string } = {}): Promise<AIResponse> {
    const taskId = options.taskId || `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const { spawn } = await import('child_process');
      
      this.logger.log(`Executing Gemini in autonomous mode with --yolo (length: ${prompt.length})`);

      // Create task log file
      this.createTaskLogFile(taskId, 'gemini', 'gemini --yolo');
      this.appendTaskLog(taskId, 'INFO', `Starting Gemini execution in autonomous mode`);
      this.appendTaskLog(taskId, 'INFO', `Prompt length: ${prompt.length} characters`);
      this.appendTaskLog(taskId, 'INFO', `Working directory: ${options.workingDirectory || process.cwd()}`);
      
      // Log prompt content (entire content for debugging)
      this.appendTaskLog(taskId, 'INFO', `Prompt content:\n${prompt}`);

      return new Promise((resolve, reject) => {
        // Use --yolo mode for autonomous execution
        const child = spawn('gemini', ['--yolo', prompt], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          this.appendTaskLog(taskId, 'STDOUT', output);
          this.logger.log(`[${taskId}] GEMINI EXECUTE STDOUT: ${output.slice(0, 100)}...`);
        });

        child.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          this.appendTaskLog(taskId, 'STDERR', output);
          this.logger.warn(`[${taskId}] GEMINI EXECUTE STDERR: ${output}`);
        });

        child.on('close', (code) => {
          this.appendTaskLog(taskId, 'INFO', `Process closed with exit code: ${code}`);
          
          if (stderr) {
            this.logger.warn(`[${taskId}] Gemini execute stderr: ${stderr}`);
          }

          if (code !== 0) {
            this.appendTaskLog(taskId, 'ERROR', `Gemini CLI execution failed with exit code ${code}`);
            resolve({
              content: '',
              provider: 'gemini',
              command: 'gemini --yolo (execute)',
              success: false,
              error: `Gemini CLI execution failed: ${stderr || `Exit code ${code}`}`,
              taskId
            });
            return;
          }

          this.appendTaskLog(taskId, 'INFO', `Gemini execution completed successfully`);
          this.appendTaskLog(taskId, 'INFO', `Output length: ${stdout.trim().length} characters`);
          resolve({
            content: stdout.trim(),
            provider: 'gemini',
            command: 'gemini --yolo (execute)',
            success: true,
            taskId
          });
        });

        child.on('error', (error: any) => {
          this.appendTaskLog(taskId, 'ERROR', `Process error: ${error.message}`);
          resolve({
            content: '',
            provider: 'gemini',
            command: 'gemini --yolo (execute)',
            success: false,
            error: error.code === 'ENOENT' ? 
              'Gemini CLI is not installed.' :
              error.message,
            taskId
          });
        });

        // Handle timeout (allow longer time for execute mode)
        const timeout = setTimeout(() => {
          this.appendTaskLog(taskId, 'ERROR', `Process timeout after ${options.timeout || this.timeoutConfig.geminiExecute}ms`);
          child.kill();
          resolve({
            content: '',
            provider: 'gemini',
            command: 'gemini --yolo (execute)',
            success: false,
            error: 'Gemini CLI execution timeout.',
            taskId
          });
        }, options.timeout || this.timeoutConfig.geminiExecute);

        child.on('close', () => {
          clearTimeout(timeout);
        });
      });
    } catch (error: any) {
      this.logger.error(`Gemini execution failed: ${error.message}`, error.stack);
      return {
        content: '',
        provider: 'gemini',
        command: 'gemini --yolo (execute)',
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  async queryCopilotCLI(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    // Use spawn instead of execAsync to prevent command injection
    const { spawn } = await import('child_process');
    
    // Build args array safely without string interpolation
    const baseArgs = ['-p', prompt, '--allow-all-tools'];
    if (options.additionalArgs) {
      baseArgs.push(...options.additionalArgs);
    }

    const command = `copilot ${baseArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')}`;
    
    try {
      this.logger.log(`Executing GitHub Copilot with spawn for security`);

      return new Promise((resolve, reject) => {
        const child = spawn('copilot', baseArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Process timeout'));
        }, options.timeout || this.timeoutConfig.copilotQuery);

        child.on('close', (code) => {
          clearTimeout(timeout);
          
          if (stderr) {
            this.logger.warn(`GitHub Copilot stderr: ${stderr}`);
          }

          if (code === 0) {
            resolve({
              content: stdout.trim(),
              provider: 'copilot',
              command,
              success: true,
            });
          } else {
            reject(new Error(`Process exited with code ${code}: ${stderr}`));
          }
        });

        child.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorStack = getErrorStack(error);
      this.logger.error(`GitHub Copilot execution failed: ${errorMessage}`, errorStack);
      return {
        content: '',
        provider: 'copilot',
        command,
        success: false,
        error: errorMessage,
      };
    }
  }

  async queryAI(
    prompt: string, 
    provider: 'claude' | 'gemini' | 'copilot' = 'claude',
    options: AIQueryOptions & { taskId?: string } = {}
  ): Promise<AIResponse> {
    // Use the new provider system
    return this.aiProviderService.queryAI(prompt, provider, options);
  }

  async executeAI(
    prompt: string,
    provider: 'claude' | 'gemini' | 'copilot' = 'claude',
    options: AIQueryOptions & { taskId?: string } = {}
  ): Promise<AIResponse> {
    // Use the new provider system's execute method
    return this.aiProviderService.executeAI(prompt, provider, options);
  }

  async executeGemini(
    prompt: string,
    options: AIQueryOptions & { taskId?: string } = {}
  ): Promise<AIResponse> {
    // Use the new unified executeAI method
    return this.executeAI(prompt, 'gemini', options);
  }

  async checkAvailableProviders(): Promise<string[]> {
    return this.aiProviderService.checkAvailableProviders();
  }

  async validateCLIInstallation(): Promise<{ claude: boolean; gemini: boolean; copilot: boolean }> {
    await this.aiProviderService.initializeProviders();
    const availableProviders = await this.aiProviderService.getAvailableProviders();
    
    return {
      claude: availableProviders.includes('claude'),
      gemini: availableProviders.includes('gemini'),
      copilot: availableProviders.includes('copilot'),
    };
  }
}