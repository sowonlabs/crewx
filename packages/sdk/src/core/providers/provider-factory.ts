import { BuiltInProviders, type AIProvider } from './ai-provider.interface';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { CopilotProvider } from './copilot.provider';
import { CodexProvider } from './codex.provider';
import { MastraAPIProvider } from './MastraAPIProvider';
import type { ProviderConfig } from '../../types/provider.types';
import type { APIProviderType, APIProviderConfig } from '../../types/api-provider.types';

const BUILTIN_PROVIDER_MAP: Record<string, () => AIProvider> = {
  [BuiltInProviders.CLAUDE]: () => new ClaudeProvider(),
  [BuiltInProviders.GEMINI]: () => new GeminiProvider(),
  [BuiltInProviders.COPILOT]: () => new CopilotProvider(),
  [BuiltInProviders.CODEX]: () => new CodexProvider(),
};

/**
 * Validate API provider configuration
 */
function validateAPIProviderConfig(config: ProviderConfig): void {
  const providerType = `${config.namespace}/${config.id}` as APIProviderType;

  // Validate provider type
  const validProviders: APIProviderType[] = [
    'api/openai',
    'api/anthropic',
    'api/google',
    'api/bedrock',
    'api/litellm',
    'api/ollama',
    'api/sowonai',
  ];

  if (!validProviders.includes(providerType)) {
    throw new Error(
      `Invalid API provider type '${providerType}'. ` +
      `Valid providers: ${validProviders.join(', ')}`
    );
  }

  // Validate model is specified
  if (!config.model) {
    throw new Error(
      `Model is required for API provider '${providerType}'. ` +
      `Please specify 'model' in provider configuration.`
    );
  }
}

/**
 * Create MastraAPIProvider from ProviderConfig
 */
function createAPIProvider(config: ProviderConfig): AIProvider {
  validateAPIProviderConfig(config);

  const apiConfig: APIProviderConfig = {
    provider: `${config.namespace}/${config.id}` as APIProviderType,
    model: config.model!,
    apiKey: config.apiKey,
    url: (config as any).url,
    temperature: (config as any).temperature,
    maxTokens: (config as any).maxTokens,
    tools: (config as any).tools,
    mcp: (config as any).mcp,
  };

  return new MastraAPIProvider(apiConfig);
}

/**
 * Create an AIProvider instance from configuration.
 *
 * Supports:
 * - Built-in CLI providers (cli/claude, cli/gemini, cli/copilot, cli/codex)
 * - API providers (api/openai, api/anthropic, api/google, api/bedrock, api/litellm, api/ollama, api/sowonai)
 */
export async function createProviderFromConfig(config: ProviderConfig): Promise<AIProvider> {
  const key = `${config.namespace}/${config.id}`.toLowerCase();

  // Check if it's an API provider (api/* namespace)
  if (config.namespace === 'api') {
    return createAPIProvider(config);
  }

  // Check built-in CLI providers
  const factory = BUILTIN_PROVIDER_MAP[key];
  if (factory) {
    return factory();
  }

  if (config.namespace === 'plugin' || config.namespace === 'remote') {
    throw new Error(
      `Dynamic provider '${key}' is not supported yet. ` +
        'Inject an AIProvider instance directly until registry support ships.',
    );
  }

  throw new Error(
    `Unknown provider '${key}'. Available built-ins: ${Object.keys(BUILTIN_PROVIDER_MAP).join(', ')}`,
  );
}
