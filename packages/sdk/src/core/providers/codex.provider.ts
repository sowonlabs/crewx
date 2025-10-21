import { BaseAIProvider } from './base-ai.provider';
import type { BaseAIProviderOptions } from './base-ai.types';
import type { AIQueryOptions, AIResponse } from './ai-provider.interface';

export class CodexProvider extends BaseAIProvider {
  readonly name = 'cli/codex';

  constructor(options: BaseAIProviderOptions = {}) {
    super('CodexProvider', options);
  }

  protected getCliCommand(): string {
    return 'codex';
  }

  protected getDefaultArgs(): string[] {
    return [];
  }

  protected getExecuteArgs(): string[] {
    return [];
  }

  protected getNotInstalledMessage(): string {
    return 'Codex CLI is not installed. Please install it first.';
  }

  /**
   * Codex includes the prompt as an argument (not via stdin)
   */
  protected getPromptInArgs(): boolean {
    return true;
  }

  protected shouldPipeContext(): boolean {
    return false;
  }

  /**
   * Check if experimental-json output format is enabled in options
   */
  private isExperimentalJsonEnabled(options: AIQueryOptions = {}): boolean {
    const args = options.additionalArgs || [];
    return args.includes('--experimental-json');
  }

  /**
   * Parse Codex-specific errors
   */
  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // Check for authentication errors
    if (stderr && (stderr.includes('not logged in') || stderr.includes('authentication required'))) {
      return {
        error: true,
        message: 'Codex CLI authentication required. Please run `codex login` to authenticate.',
      };
    }

    // Check for rate limiting
    if (stderr && stderr.includes('rate limit')) {
      return {
        error: true,
        message: 'Codex API rate limit reached. Please try again later.',
      };
    }

    // If stdout exists, command succeeded (stderr might just be warnings)
    if (stdout && stdout.trim().length > 0) {
      return { error: false, message: '' };
    }

    // Check for actual errors in stderr
    if (stderr && stderr.trim().length > 0) {
      return { error: true, message: stderr.split('\n')[0]?.trim() || 'Unknown error' };
    }

    // Default: Use base implementation
    return super.parseProviderError(stderr, stdout);
  }

  /**
   * Parse JSONL output and extract assistant message
   * Codex CLI with --experimental-json returns JSONL format:
   * {"type":"session.created","session_id":"..."}
   * {"type":"item.completed","item":{"item_type":"reasoning","text":"..."}}
   * {"type":"item.completed","item":{"item_type":"assistant_message","text":"final response"}}
   */
  private parseJsonlResponse(content: string): string {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    let assistantMessage: string | null = null;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Look for item.completed with assistant_message
        if (
          parsed?.type === 'item.completed' &&
          parsed?.item?.item_type === 'assistant_message' &&
          typeof parsed.item.text === 'string'
        ) {
          assistantMessage = parsed.item.text.trim();
        }
        // Also check legacy format
        else if (
          parsed?.item?.item_type === 'assistant_message' &&
          typeof parsed.item.text === 'string'
        ) {
          assistantMessage = parsed.item.text.trim();
        }
        // Check response.output array format
        else if (
          parsed?.response?.output &&
          Array.isArray(parsed.response.output)
        ) {
          const assistantEntries = parsed.response.output.filter(
            (entry: any) => entry?.item_type === 'assistant_message'
          );
          if (assistantEntries.length > 0) {
            const lastMessage = assistantEntries[assistantEntries.length - 1];
            if (lastMessage?.text) {
              assistantMessage = String(lastMessage.text).trim();
            }
          }
        }
      } catch {
        // Ignore non-JSON lines
        continue;
      }
    }

    if (assistantMessage) {
      this.logger.log('✅ Extracted assistant message from Codex JSONL stream');
      return assistantMessage;
    }

    // If no assistant message found, return original content
    this.logger.warn('⚠️ Could not parse Codex JSONL, returning original content');
    return content;
  }

  /**
   * Override query to handle JSONL experimental-json output
   */
  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const response = await super.query(prompt, options);

    if (response.success && response.content && this.isExperimentalJsonEnabled(options)) {
      // Only parse JSONL if experimental-json format is enabled
      const parsedContent = this.parseJsonlResponse(response.content);
      return {
        ...response,
        content: parsedContent,
      };
    }

    return response;
  }

  /**
   * Override execute to handle JSONL experimental-json output
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const response = await super.execute(prompt, options);

    if (response.success && response.content && this.isExperimentalJsonEnabled(options)) {
      // Only parse JSONL if experimental-json format is enabled
      const parsedContent = this.parseJsonlResponse(response.content);
      return {
        ...response,
        content: parsedContent,
      };
    }

    return response;
  }

}
