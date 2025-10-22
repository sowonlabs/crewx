import { BaseAIProvider } from './base-ai.provider';
import type { BaseAIProviderOptions } from './base-ai.types';
import { BuiltInProviders } from './ai-provider.interface';

export class GeminiProvider extends BaseAIProvider {
  readonly name = BuiltInProviders.GEMINI;

  constructor(options: BaseAIProviderOptions = {}) {
    super('GeminiProvider', options);
  }

  protected getCliCommand(): string {
    return 'gemini';
  }

  protected getDefaultArgs(): string[] {
    return [];
  }

  protected getExecuteArgs(): string[] {
    return [];
  }

  protected getPromptInArgs(): boolean {
    return false; // Use stdin for prompts to avoid command line length issues
  }

  protected getNotInstalledMessage(): string {
    return 'Gemini CLI is not installed.';
  }

}
