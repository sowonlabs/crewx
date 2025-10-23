import type { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';

/**
 * Lightweight mock provider that simulates AI responses.
 *
 * Used by the SDK as the default fallback to preserve backwards compatibility
 * for consumers that have not configured a real provider yet.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock/default';

  private responses = new Map<string, AIResponse>();
  private defaultResponse: AIResponse = {
    content: 'Mock response',
    provider: this.name,
    command: 'mock-command',
    success: true,
  };

  /**
   * Override the response for a specific prompt.
   */
  setResponse(prompt: string, response: Partial<AIResponse>): void {
    this.responses.set(prompt, {
      ...this.defaultResponse,
      ...response,
    });
  }

  /**
   * Update the default response returned when no prompt-specific override exists.
   */
  setDefaultResponse(response: Partial<AIResponse>): void {
    this.defaultResponse = {
      ...this.defaultResponse,
      ...response,
    };
  }

  /**
   * Clear all prompt-specific overrides.
   */
  clearResponses(): void {
    this.responses.clear();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    const custom = this.responses.get(prompt);
    if (custom) {
      return {
        ...custom,
        taskId: options.taskId,
      };
    }

    return {
      ...this.defaultResponse,
      content: `Mock response for: ${prompt}`,
      taskId: options.taskId,
    };
  }

  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    return this.query(prompt, options);
  }

  async getToolPath(): Promise<string | null> {
    return null;
  }
}
