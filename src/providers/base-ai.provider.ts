import { Injectable, Logger } from '@nestjs/common';
import { spawn, execSync } from 'child_process';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';
import { ToolCallService, Tool } from '../services/tool-call.service';
import { getTimeoutConfig } from '../config/timeout.config';

@Injectable()
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: 'claude' | 'gemini' | 'copilot';
  protected readonly logger: Logger;
  protected toolCallService?: ToolCallService;
  private readonly logsDir = join(process.cwd(), '.crewx', 'logs');
  private cachedPath: string | null = null;
  protected readonly timeoutConfig = getTimeoutConfig();

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);

    // Create log directory
    try {
      mkdirSync(this.logsDir, { recursive: true });
    } catch (error) {
      // Ignore if it already exists
    }
  }

  /**
   * CLI command name for each provider
   */
  protected abstract getCliCommand(): string;

  /**
   * Default CLI arguments for each provider (query mode)
   */
  protected abstract getDefaultArgs(): string[];

  /**
   * CLI arguments for each provider's execute mode
   */
  protected abstract getExecuteArgs(): string[];

  /**
   * Error message for each provider
   */
  protected abstract getNotInstalledMessage(): string;

  /**
   * Whether to include the prompt in args in Execute mode
   * (Gemini includes the prompt in args with --yolo, other providers use stdin)
   */
  protected getPromptInArgs(): boolean {
    return false; // Default is to use stdin
  }

  /**
   * Get default timeout for query mode (ms)
   */
  protected getDefaultQueryTimeout(): number {
    if (this.name === 'claude') return this.timeoutConfig.claudeQuery;
    if (this.name === 'gemini') return this.timeoutConfig.geminiQuery;
    if (this.name === 'copilot') return this.timeoutConfig.copilotQuery;
    return 600000; // Fallback
  }

  /**
   * Get default timeout for execute mode (ms)
   */
  protected getDefaultExecuteTimeout(): number {
    if (this.name === 'claude') return this.timeoutConfig.claudeExecute;
    if (this.name === 'gemini') return this.timeoutConfig.geminiExecute;
    if (this.name === 'copilot') return this.timeoutConfig.copilotExecute;
    return 1200000; // Fallback
  }

  /**
   * Set ToolCallService for tool execution support
   */
  protected setToolCallService(toolCallService: ToolCallService): void {
    this.toolCallService = toolCallService;
  }

  /**
   * Parse AI response to detect tool usage
   * Can be overridden by providers for additional parsing logic
   */
  protected parseToolUse(content: string): { isToolUse: boolean; toolName?: string; toolInput?: any } {
    // Pattern 1: CodeCrew XML tags (most reliable)
    const xmlMatch = content.match(/<crewcode_tool_call>\s*([\s\S]*?)\s*<\/crewcode_tool_call>/);
    if (xmlMatch && xmlMatch[1]) {
      try {
        const jsonContent = xmlMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        if (parsed.type === 'tool_use' && parsed.name && parsed.input !== undefined) {
          this.logger.log(`Tool use detected from XML: ${parsed.name}`);
          return {
            isToolUse: true,
            toolName: parsed.name,
            toolInput: parsed.input,
          };
        }
      } catch (e) {
        // Failed to parse XML content, continue to other patterns
      }
    }

    // Pattern 2: Direct JSON parsing
    try {
      const parsed = JSON.parse(content);
      
      // Direct tool_use object
      if (parsed.type === 'tool_use' && parsed.name && parsed.input !== undefined) {
        this.logger.log(`Tool use detected from direct JSON: ${parsed.name}`);
        return {
          isToolUse: true,
          toolName: parsed.name,
          toolInput: parsed.input,
        };
      }

      // Tool use in content array
      if (parsed.content && Array.isArray(parsed.content)) {
        const toolUse = parsed.content.find((c: any) => c.type === 'tool_use');
        if (toolUse && toolUse.name && toolUse.input !== undefined) {
          this.logger.log(`Tool use detected from content array: ${toolUse.name}`);
          return {
            isToolUse: true,
            toolName: toolUse.name,
            toolInput: toolUse.input,
          };
        }
      }
      
      // Provider-specific JSON parsing hook
      const providerSpecific = this.parseToolUseProviderSpecific(parsed);
      if (providerSpecific.isToolUse) {
        return providerSpecific;
      }
    } catch (e) {
      // Not valid JSON, continue to other patterns
    }

    // Pattern 3: JSON in markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        const jsonContent = codeBlockMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        if (parsed.type === 'tool_use' && parsed.name && parsed.input !== undefined) {
          this.logger.log(`Tool use detected from code block: ${parsed.name}`);
          return {
            isToolUse: true,
            toolName: parsed.name,
            toolInput: parsed.input,
          };
        }
      } catch (e) {
        // Failed to parse code block, continue
      }
    }

    // Pattern 4: Plain JSON object in text
    const jsonObjectPattern = /\{[\s\S]*?"type"\s*:\s*"tool_use"[\s\S]*?\}/;
    const jsonMatch = content.match(jsonObjectPattern);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.type === 'tool_use' && parsed.name && parsed.input !== undefined) {
          this.logger.log(`Tool use detected from plain text JSON: ${parsed.name}`);
          return {
            isToolUse: true,
            toolName: parsed.name,
            toolInput: parsed.input,
          };
        }
      } catch (e) {
        // Failed to parse
      }
    }

    // No tool use detected
    return { isToolUse: false };
  }

  /**
   * Provider-specific tool use parsing
   * Override this in subclasses to add provider-specific parsing logic
   */
  protected parseToolUseProviderSpecific(parsed: any): { isToolUse: boolean; toolName?: string; toolInput?: any } {
    // Default: no provider-specific parsing
    return { isToolUse: false };
  }

  /**
   * Parse provider-specific error messages to provide better user feedback
   */
  /**
   * Filter out tool_use JSON blocks from AI responses
   * This prevents raw JSON tool calls from appearing in Slack messages
   */
  protected filterToolUseFromResponse(content: string): string {
    if (!content) return content;

    let filteredContent = content;

    // Remove standalone JSON blocks with tool_use
    // Pattern: JSON objects on their own lines with "type": "tool_use"
    filteredContent = filteredContent.replace(
      /^\s*\{[^}]*"type"\s*:\s*"tool_use"[^}]*\}\s*$/gm,
      ''
    );

    // Remove multiple consecutive JSON objects with tool_use
    // This handles cases where multiple tool calls are made
    filteredContent = filteredContent.replace(
      /(?:^\s*\{[^}]*"type"\s*:\s*"tool_use"[^}]*\}\s*\n?)+/gm,
      ''
    );

    // Clean up excessive blank lines left after filtering
    filteredContent = filteredContent.replace(/\n{3,}/g, '\n\n');

    // If the entire response was just tool_use JSON, return a placeholder
    if (filteredContent.trim() === '') {
      return '[Tool operations completed]';
    }

    return filteredContent.trim();
  }

  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // Check for CLI option errors (common across all providers)
    if (stderr && (stderr.toLowerCase().includes('unknown option') ||
                   stderr.toLowerCase().includes('invalid option'))) {
      return {
        error: true,
        message: stderr.split('\n')[0]?.trim() || 'Invalid CLI option',
      };
    }

    // Default implementation: Only treat stderr as error if there's no stdout
    // If stdout exists (successful response), stderr likely contains warnings/debug messages
    if (stderr && !stdout) {
      return { error: true, message: stderr };
    }
    return { error: false, message: '' };
  }

  async getToolPath(): Promise<string | null> {
    if (this.cachedPath !== null) {
      return this.cachedPath;
    }

    try {
      const cliCommand = this.getCliCommand();
      // Use 'where' on Windows, 'which' on Unix-like systems
      const isWindows = process.platform === 'win32';
      const command = isWindows ? `where ${cliCommand}` : `which ${cliCommand}`;
      const path = execSync(command, { encoding: 'utf-8' }).trim();
      
      // Windows 'where' returns multiple lines if there are multiple matches
      // Prefer executables with extensions (.cmd, .exe, .bat, .ps1) over extensionless files
      let finalPath: string;
      if (isWindows) {
        const paths = path.split('\n').map(p => p.trim()).filter(p => p);
        // Find first path with a known executable extension
        const pathWithExt = paths.find(p => /\.(cmd|exe|bat|ps1)$/i.test(p));
        finalPath = pathWithExt || paths[0] || '';
      } else {
        finalPath = path;
      }
      
      this.logger.log(`✅ Found ${this.name} CLI at: ${finalPath}`);
      this.cachedPath = finalPath;
      return finalPath;
    } catch (error: any) {
      this.logger.error(`❌ ${this.name} not found in PATH: ${error.message}`);
      this.cachedPath = '';
      return null;
    }
  }

  /**
   * Wrap user query in authenticated security container
   * This prevents prompt injection attacks by isolating user input
   */
  protected wrapUserQueryWithSecurity(userQuery: string, securityKey: string): string {
    // Note: The actual prompt will be:
    // System Prompt (with key) + Conversation History (with key) + User Query (with key)
    // This method wraps only the user query portion
    return `
<user_query key="${securityKey}">
${userQuery}
</user_query>`;
  }

  /**
   * Extract the actual user query from the wrapped version
   * Used for logging and debugging
   */
  protected extractUserQuery(wrappedQuery: string, securityKey: string): string {
    const regex = new RegExp(`<user_query key="${securityKey}">\\s*([\\s\\S]*?)\\s*</user_query>`, 'm');
    const match = wrappedQuery.match(regex);
    return match && match[1] ? match[1].trim() : wrappedQuery;
  }

  async isAvailable(): Promise<boolean> {
    const path = await this.getToolPath();
    return path !== null && path !== '';
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
      this.logger.error(`Failed to append to task log ${taskId}:`, error);
    }
  }

  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const taskId = options.taskId || `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use command name directly - let the shell find it in PATH
    const executablePath = this.getCliCommand();

    try {
      let args = [
        ...(options.additionalArgs || []),
        ...this.getDefaultArgs(),
      ];
      
      // Add --model option if specified
      if (options.model) {
        args.unshift(`--model=${options.model}`);
      }
      
      // Providers handle prompts differently
      const promptInArgs = this.getPromptInArgs();
      if (promptInArgs) {
        // Include prompt as separate arg (spawn will handle escaping)
        args.push(prompt);
      }
      
      const command = promptInArgs 
        ? `${this.getCliCommand()} ${args.slice(0, -1).join(' ')} -p "<prompt>"`
        : `${this.getCliCommand()} ${args.join(' ')}`;
      
      // Create task log file
      this.createTaskLogFile(taskId, this.name, command);
      this.appendTaskLog(taskId, 'INFO', `Starting ${this.name} query mode`);
      this.appendTaskLog(taskId, 'INFO', `Prompt length: ${prompt.length} characters`);
      
      // Log prompt content (entire content for debugging)
      this.appendTaskLog(taskId, 'INFO', `Prompt content:\n${prompt}`);

      this.logger.log(`Executing ${this.name} with prompt (length: ${prompt.length})`);

      return new Promise((resolve) => {
        // Set UTF-8 encoding for Windows PowerShell to handle Korean/Unicode correctly
        const env = { ...process.env };
        if (process.platform === 'win32') {
          env.PYTHONIOENCODING = 'utf-8';
          env.LANG = 'en_US.UTF-8';
        }
        
        // For Windows, use the full path to .cmd file if needed
        let executable = executablePath;
        let spawnArgs = args;
        let useShell = false;
        
        if (process.platform === 'win32' && !executablePath.match(/\.(cmd|bat|ps1)$/i)) {
          // On Windows, if executable doesn't have extension, spawn needs shell
          useShell = true;
        }
        
        const child = spawn(executable, spawnArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env,
          shell: useShell,
        } as any);

        let stdout = '';
        let stderr = '';
        let exitCode: number | null = null;

        child.stdout.on('data', (data: any) => {
          const output = data.toString();
          stdout += output;
          this.appendTaskLog(taskId, 'STDOUT', output);
        });

        child.stderr.on('data', (data: any) => {
          const output = data.toString();
          stderr += output;
          this.appendTaskLog(taskId, 'STDERR', output);
        });

        child.on('close', (code: any) => {
          exitCode = code;
          this.appendTaskLog(taskId, 'INFO', `Process closed with exit code: ${exitCode}`);

          if (stderr) {
            this.logger.warn(`[${taskId}] ${this.name} stderr: ${stderr}`);
          }

          // If exit code is 0 and we have stdout, it's a success (ignore stderr debug logs)
          if (exitCode === 0 && stdout && stdout.trim().length > 0) {
            // Filter out tool_use JSON blocks from the response
            const filteredContent = this.filterToolUseFromResponse(stdout.trim());
            this.appendTaskLog(taskId, 'INFO', `${this.name} query completed successfully`);
            resolve({
              content: filteredContent,
              provider: this.name,
              command,
              success: true,
              taskId,
            });
            return;
          }

          // Otherwise check for errors
          const providerError = this.parseProviderError(stderr, stdout);
          if (exitCode !== 0 || providerError.error) {
            const errorMessage = providerError.message || stderr || `Exit code ${exitCode}`;
            this.appendTaskLog(taskId, 'ERROR', `${this.name} CLI failed: ${errorMessage}`);
            resolve({
              content: '',
              provider: this.name,
              command,
              success: false,
              error: `${this.name} CLI failed: ${errorMessage}`,
              taskId,
            });
            return;
          }

          this.appendTaskLog(taskId, 'INFO', `${this.name} query completed successfully`);

          // Try to parse JSON output if available
          let parsedContent = stdout.trim();
          try {
            const jsonOutput = JSON.parse(stdout);
            // If JSON parsing succeeds, keep the original JSON string
            // The consumer will handle JSON parsing if needed
            parsedContent = stdout.trim();
            this.appendTaskLog(taskId, 'INFO', 'JSON output detected and validated');
          } catch (jsonError) {
            // Not JSON, use as plain text
            this.appendTaskLog(taskId, 'INFO', 'Plain text output (not JSON)');
          }

          // Filter out tool_use JSON blocks from the response
          const filteredContent = this.filterToolUseFromResponse(parsedContent);

          resolve({
            content: filteredContent,
            provider: this.name,
            command,
            success: true,
            taskId,
          });
        });

        child.on('error', (error: any) => {
          this.appendTaskLog(taskId, 'ERROR', `Process error: ${error.message}`);
          resolve({
            content: '',
            provider: this.name,
            command,
            success: false,
            error: error.code === 'ENOENT' ? this.getNotInstalledMessage() : error.message,
            taskId,
          });
        });

        // Send prompt via stdin if not in args
        if (!this.getPromptInArgs()) {
          child.stdin.write(prompt);
          child.stdin.end();
        } else {
          child.stdin.end();
        }

        // Timeout handling
        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            content: '',
            provider: this.name,
            command,
            success: false,
            error: `${this.name} CLI timeout`,
            taskId,
          });
        }, options.timeout || this.getDefaultQueryTimeout());

        child.on('close', () => clearTimeout(timeout));
      });
    } catch (error: any) {
      this.logger.error(`${this.name} execution failed: ${error.message}`, error.stack);
      return {
        content: '',
        provider: this.name,
        command: `${this.getCliCommand()} (error)`,
        success: false,
        error: error.message || 'Unknown error occurred',
        taskId,
      };
    }
  }

  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const taskId = options.taskId || `${this.name}_execute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use command name directly - let the shell find it in PATH
    const executablePath = this.getCliCommand();

    try {
      let args = [
        ...(options.additionalArgs || []),
        ...this.getExecuteArgs(),
      ];
      
      // Add --model option if specified
      if (options.model) {
        args.unshift(`--model=${options.model}`);
      }
      
      // Providers handle prompts differently
      if (this.getPromptInArgs()) {
        // Include prompt in args like Copilot, Gemini
        args.push(prompt);
      }
      const command = `${this.getCliCommand()} ${args.join(' ')}`;
      
      // Create task log file
      this.createTaskLogFile(taskId, this.name, command);
      
      // Debugging: add option logging
      this.appendTaskLog(taskId, 'INFO', `Additional Args: ${JSON.stringify(options.additionalArgs || [])}`);
      this.appendTaskLog(taskId, 'INFO', `Execute Args: ${JSON.stringify(this.getExecuteArgs())}`);
      this.appendTaskLog(taskId, 'INFO', `Final Args: ${JSON.stringify(args)}`);
      this.appendTaskLog(taskId, 'INFO', `Starting ${this.name} execute mode`);
      this.appendTaskLog(taskId, 'INFO', `Prompt length: ${prompt.length} characters`);
      
      // Log prompt content
      const promptPreview = prompt.length > 500 ? 
        prompt.substring(0, 500) + '...[truncated]' : 
        prompt;
      this.appendTaskLog(taskId, 'INFO', `Prompt content:\n${promptPreview}`);

      this.logger.log(`Executing ${this.name} in execute mode (length: ${prompt.length})`);

      return new Promise((resolve) => {
        // Set UTF-8 encoding for Windows PowerShell to handle Korean/Unicode correctly
        const env = { ...process.env };
        if (process.platform === 'win32') {
          env.PYTHONIOENCODING = 'utf-8';
          env.LANG = 'en_US.UTF-8';
        }
        
        // Use command name directly with shell: true for cross-platform execution
        const child = spawn(executablePath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: options.workingDirectory || process.cwd(),
          env,
          shell: true, // Let shell handle .cmd/.bat files on Windows
        });

        let stdout = '';
        let stderr = '';
        let exitCode: number | null = null;

        child.stdout.on('data', (data: any) => {
          const output = data.toString();
          stdout += output;
          this.appendTaskLog(taskId, 'STDOUT', output);
        });

        child.stderr.on('data', (data: any) => {
          const output = data.toString();
          stderr += output;
          this.appendTaskLog(taskId, 'STDERR', output);
        });

        child.on('close', (code: any) => {
          exitCode = code;
          this.appendTaskLog(taskId, 'INFO', `Process closed with exit code: ${exitCode}`);

          if (stderr) {
            this.logger.warn(`[${taskId}] ${this.name} stderr: ${stderr}`);
          }

          // If exit code is 0 and we have stdout, it's a success (ignore stderr debug logs)
          if (exitCode === 0 && stdout && stdout.trim().length > 0) {
            // Filter out tool_use JSON blocks from the response
            const filteredContent = this.filterToolUseFromResponse(stdout.trim());
            this.appendTaskLog(taskId, 'INFO', `${this.name} execution completed successfully`);
            resolve({
              content: filteredContent,
              provider: this.name,
              command,
              success: true,
              taskId,
            });
            return;
          }

          // Otherwise check for errors
          const providerError = this.parseProviderError(stderr, stdout);
          if (exitCode !== 0 || providerError.error) {
            const errorMessage = providerError.message || stderr || `Exit code ${exitCode}`;
            this.appendTaskLog(taskId, 'ERROR', `${this.name} CLI failed: ${errorMessage}`);
            resolve({
              content: '',
              provider: this.name,
              command,
              success: false,
              error: `${this.name} CLI execute failed: ${errorMessage}`,
              taskId,
            });
            return;
          }

          this.appendTaskLog(taskId, 'INFO', `${this.name} execute completed successfully`);

          // Try to parse JSON output if available
          let parsedContent = stdout.trim();
          try {
            const jsonOutput = JSON.parse(stdout);
            // If JSON parsing succeeds, keep the original JSON string
            // The consumer will handle JSON parsing if needed
            parsedContent = stdout.trim();
            this.appendTaskLog(taskId, 'INFO', 'JSON output detected and validated');
          } catch (jsonError) {
            // Not JSON, use as plain text
            this.appendTaskLog(taskId, 'INFO', 'Plain text output (not JSON)');
          }

          resolve({
            content: parsedContent,
            provider: this.name,
            command,
            success: true,
            taskId,
          });
        });

        child.on('error', (error: any) => {
          this.appendTaskLog(taskId, 'ERROR', `Process error: ${error.message}`);
          resolve({
            content: '',
            provider: this.name,
            command,
            success: false,
            error: error.code === 'ENOENT' ? this.getNotInstalledMessage() : error.message,
            taskId,
          });
        });

        // Send prompt via stdin if not in args
        if (!this.getPromptInArgs()) {
          child.stdin.write(prompt);
          child.stdin.end();
        } else {
          child.stdin.end();
        }

        // Timeout handling
        const timeout = setTimeout(() => {
          child.kill();
          resolve({
            content: '',
            provider: this.name,
            command,
            success: false,
            error: `${this.name} CLI execute timeout`,
            taskId,
          });
        }, options.timeout || this.getDefaultExecuteTimeout());

        child.on('close', () => clearTimeout(timeout));
      });
    } catch (error: any) {
      this.logger.error(`${this.name} execute failed: ${error.message}`, error.stack);
      return {
        content: '',
        provider: this.name,
        command: `${this.getCliCommand()} execute (error)`,
        success: false,
        error: error.message || 'Unknown error occurred',
        taskId,
      };
    }
  }
}