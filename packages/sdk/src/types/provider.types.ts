import type { AIProvider } from '../core/providers/ai-provider.interface';

/**
 * Provider configuration accepted by the SDK factory helpers.
 */
export interface ProviderConfig {
  namespace: string;
  id: string;
  apiKey?: string;
  model?: string;
}

/**
 * Union accepted by runtime/factory hooks when injecting providers.
 */
export type ProviderInput = ProviderConfig | AIProvider | undefined;

export interface ProviderResolutionResult {
  provider: AIProvider;
  defaultModel?: string;
}
