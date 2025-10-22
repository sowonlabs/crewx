
import { BaseAIProvider } from './base-ai.provider';
import type { BaseAIProviderOptions } from './base-ai.types';
import { BuiltInProviders } from './ai-provider.interface';

export class CopilotProvider extends BaseAIProvider {
  readonly name = BuiltInProviders.COPILOT;

  constructor(options: BaseAIProviderOptions = {}) {
    super('CopilotProvider', options);
  }

  protected getCliCommand(): string {
    return 'copilot';
  }

  protected getDefaultArgs(): string[] {
    return [];
  }

  protected getExecuteArgs(): string[] {
    return [];
  }

  protected getPromptInArgs(): boolean {
    // Use stdin for prompts to avoid Windows command line length limits
    return false;
  }

  protected getNotInstalledMessage(): string {
    return 'GitHub Copilot CLI is not installed. Please refer to https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli to install it.';
  }


  /**
   * Parse Copilot CLI error messages (e.g., quota, auth, network)
   */
  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // Use combinedOutput for quota and auth checks (these can appear in stdout or stderr)
    const combinedOutput = stderr || stdout;

    if (combinedOutput.includes('quota') && combinedOutput.includes('exceed')) {
      return {
        error: true,
        message:
          'Copilot quota exceeded. Please check your plan at https://github.com/features/copilot/plans or try again later.',
      };
    }
    if (combinedOutput.includes('quota_exceeded')) {
      return {
        error: true,
        message:
          'Copilot quota exceeded. Please check your plan at https://github.com/features/copilot/plans.',
      };
    }
    if (
      combinedOutput.toLowerCase().includes('auth') ||
      combinedOutput.toLowerCase().includes('login')
    ) {
      return {
        error: true,
        message:
          'Copilot CLI authentication is required. Please authenticate using the `copilot login` command.',
      };
    }
    // CLI option errors (check stderr first)
    if (stderr && (stderr.toLowerCase().includes('unknown option') ||
                   stderr.toLowerCase().includes('invalid option'))) {
      return {
        error: true,
        message: stderr.split('\n')[0]?.trim() || 'Invalid CLI option',
      };
    }

    // Network error check: ONLY check stderr, NOT stdout
    // stdout contains the AI response which may legitimately mention "network" or "connection"
    if (
      stderr && (stderr.toLowerCase().includes('network') ||
      stderr.toLowerCase().includes('connection'))
    ) {
      return {
        error: true,
        message: 'Network connection error. Please check your internet connection and try again.',
      };
    }

    // If there is only stderr without stdout, consider it a fatal error
    if (stderr && !stdout) {
      return { error: true, message: stderr };
    }

    return { error: false, message: '' };
  }


}
