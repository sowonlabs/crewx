import { BuiltInProviders, type AIProvider } from './ai-provider.interface';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { CopilotProvider } from './copilot.provider';
import { CodexProvider } from './codex.provider';
import type { ProviderConfig } from '../../types/provider.types';

const BUILTIN_PROVIDER_MAP: Record<string, () => AIProvider> = {
  [BuiltInProviders.CLAUDE]: () => new ClaudeProvider(),
  [BuiltInProviders.GEMINI]: () => new GeminiProvider(),
  [BuiltInProviders.COPILOT]: () => new CopilotProvider(),
  [BuiltInProviders.CODEX]: () => new CodexProvider(),
};

/**
 * Create an AIProvider instance from configuration.
 *
 * Currently supports built-in CLI providers. Dynamic providers will be wired in a
 * later phase once registry support lands in the SDK.
 */
export async function createProviderFromConfig(config: ProviderConfig): Promise<AIProvider> {
  const key = `${config.namespace}/${config.id}`.toLowerCase();
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
