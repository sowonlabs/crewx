import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';

@Injectable()
export class CodexProvider extends BaseAIProvider {
  readonly name = 'cli/codex';

  constructor() {
    super('CodexProvider');
  }

  protected getCliCommand(): string {
    return 'codex';
  }

  protected getDefaultArgs(): string[] {
    // Query mode: use non-interactive execution with JSON output
    // Default to read-only sandbox for safety
    return ['exec', '--experimental-json'];
  }

  protected getExecuteArgs(): string[] {
    // Execute mode: use workspace-write to allow file operations
    // This is safe as codex still sandboxes operations within the workspace
    return ['exec', '-s', 'workspace-write', '--experimental-json'];
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
   * Extract assistant message from Codex JSONL output
   */
  private extractAssistantMessage(content: string): string | null {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    let assistantMessage: string | null = null;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (
          parsed?.item?.item_type === 'assistant_message' &&
          typeof parsed.item.text === 'string'
        ) {
          assistantMessage = parsed.item.text.trim();
        } else if (
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

    return assistantMessage;
  }

  /**
   * Filter Codex response to extract clean assistant message
   */
  protected filterToolUseFromResponse(content: string): string {
    const assistantMessage = this.extractAssistantMessage(content);
    if (assistantMessage) {
      return assistantMessage;
    }
    return super.filterToolUseFromResponse(content);
  }

}
