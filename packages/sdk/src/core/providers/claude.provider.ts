import { BaseAIProvider } from './base-ai.provider';
import type { BaseAIProviderOptions } from './base-ai.types';
import { BuiltInProviders, type AIQueryOptions, type AIResponse } from './ai-provider.interface';

export class ClaudeProvider extends BaseAIProvider {
  readonly name = BuiltInProviders.CLAUDE;

  constructor(options: BaseAIProviderOptions = {}) {
    super('ClaudeProvider', options);
  }

  protected getCliCommand(): string {
    return 'claude';
  }

  protected getDefaultArgs(): string[] {
    return [];
  }

  protected getExecuteArgs(): string[] {
    return [];
  }

  protected getNotInstalledMessage(): string {
    return 'Claude CLI is not installed. Please install it from https://claude.ai/download.';
  }

  /**
   * Parse JSONL (JSON Lines) output and extract the final result text
   * Claude CLI with --output-format stream-json returns multiple JSON objects separated by newlines:
   * {"type":"system",...}
   * {"type":"assistant",...}
   * {"type":"result","result":"final text"}
   */
  private parseJsonlResponse(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());

    // Try to find the last "result" type object
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line) continue;

        const parsed = JSON.parse(line);
        if (parsed.type === 'result' && parsed.result) {
          this.logger.log('✅ Extracted final result from JSONL stream');
          return parsed.result;
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }

    // If no result found, return the original content
    this.logger.warn('⚠️ Could not parse JSONL, returning original content');
    return content;
  }

  /**
   * Check if stream-json output format is enabled in options
   */
  private isStreamJsonEnabled(options: AIQueryOptions = {}): boolean {
    const args = options.additionalArgs || [];
    const hasOutputFormat = args.some((arg, idx) => {
      // Check for --output-format stream-json or --output-format=stream-json
      if (arg === '--output-format' && args[idx + 1] === 'stream-json') {
        return true;
      }
      if (arg === '--output-format=stream-json') {
        return true;
      }
      return false;
    });
    return hasOutputFormat;
  }

  /**
   * Override query to handle JSONL stream-json output
   */
  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const response = await super.query(prompt, options);

    if (response.success && response.content && this.isStreamJsonEnabled(options)) {
      // Only parse JSONL if stream-json format is enabled
      const parsedContent = this.parseJsonlResponse(response.content);
      return {
        ...response,
        content: parsedContent,
      };
    }

    return response;
  }

  /**
   * Override execute to handle JSONL stream-json output
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const response = await super.execute(prompt, options);

    if (response.success && response.content && this.isStreamJsonEnabled(options)) {
      // Only parse JSONL if stream-json format is enabled
      const parsedContent = this.parseJsonlResponse(response.content);
      return {
        ...response,
        content: parsedContent,
      };
    }

    return response;
  }


  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // NOTE: This method is used to detect errors even when CLI tools return exit code 0.
    // Some AI CLI tools incorrectly return success exit codes even when encountering errors.
    // We check stderr first, as it's more likely to contain actual error messages.
    // Be careful not to treat normal response content as errors.
    
    const combinedOutput = stderr || stdout; // Only for session limit check

    // Check for session limit (definite error)
    if (combinedOutput.includes('Session limit reached')) {
      const resetMatch = combinedOutput.match(/resets (\d+(?::\d+)?(?:am|pm))/i);
      const resetTime = resetMatch ? resetMatch[1] : 'later today';
      return {
        error: true,
        message: `Claude Pro session limit reached. Your limit will reset at ${resetTime}. Please try again after the reset or use another AI agent (Gemini or Copilot) in the meantime.`,
      };
    }

    // Check for authentication errors
    if (stderr && (stderr.includes('authentication required') || stderr.includes('Please run `claude login`'))) {
      return {
        error: true,
        message:
          'Claude CLI authentication required. Please run `claude login` to authenticate.',
      };
    }

    // If stdout exists and has content, the command succeeded
    // stderr is just debug logs from Claude CLI (follow-redirects, spawn-rx, etc)
    if (stdout && stdout.trim().length > 0) {
      return { error: false, message: '' };
    }

    // No stdout - check if stderr contains actual error messages
    if (stderr && stderr.trim().length > 0) {
      // Pattern 1: Actual error messages (short, clear)
      const errorIndicators = [
        /^Error:/im,                    // Starts with "Error:"
        /^error:/im,                    // Starts with "error:" (lowercase)
        /^Failed:/im,                   // Starts with "Failed:"
        /^Unable to/im,                 // Starts with "Unable to"
        /unknown option/i,              // Unknown CLI option error
        /invalid option/i,              // Invalid CLI option error
        /command not found/i,           // Shell error
        /no such file/i,                // File error
        /permission denied/i,           // Permission error
        /ECONNREFUSED/,                 // Network error code
        /ETIMEDOUT/,                    // Timeout error code
        /ENOTFOUND/,                    // DNS error code
        /EHOSTUNREACH/,                 // Host unreachable
        /\bconnection refused\b/i,      // Word boundary for "connection refused"
        /\bnetwork error\b/i,           // Word boundary for "network error"
        /\brequest failed\b/i,          // Word boundary for "request failed"
      ];

      // Pattern 2: Debug logs (ignore these)
      const debugLogPatterns = [
        /follow-redirects options/,     // HTTP debug
        /spawn-rx/,                     // Process spawn debug
        /\[Function:/,                  // Function objects
        /connectionListener/,           // Function name in debug
        /maxRedirects:/,                // HTTP config
        /\{[\s\S]*protocol:.*\}/,       // JSON object with protocol
      ];

      // Check if stderr is debug logs
      const isDebugLog = debugLogPatterns.some(pattern => pattern.test(stderr));
      if (isDebugLog) {
        return { error: false, message: '' };
      }

      // Check if stderr contains actual errors
      const hasError = errorIndicators.some(pattern => pattern.test(stderr));
      if (hasError) {
        // Extract first line as error message (usually the most relevant)
        const lines = stderr.split('\n');
        const firstLine = lines[0]?.trim() || stderr.trim();
        return { error: true, message: firstLine };
      }
    }

    // No stdout and no clear error in stderr
    return { error: false, message: '' };
  }




}
