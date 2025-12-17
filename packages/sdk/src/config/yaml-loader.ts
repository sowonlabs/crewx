/**
 * YAML configuration loader for CrewX agents.
 *
 * Provides functions to load and parse agent configurations from YAML strings or files.
 * Supports validation and transformation into typed CrewxAgentConfig objects.
 */

import { load as loadYaml } from 'js-yaml';
import { readFileSync } from 'fs';
import { CrewxAgentConfig, ProviderConfig, KnowledgeBaseConfig } from '../core/agent/agent-factory';
import { parseAPIProviderConfig, RawAgentConfig as RawAPIAgentConfig } from './api-provider-parser';
import { APIProviderConfig } from '../types/api-provider.types';

/**
 * Error thrown when YAML parsing or validation fails
 */
export class YamlConfigError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'YamlConfigError';
  }
}

/**
 * Raw YAML structure before validation
 */
interface RawYamlConfig {
  agents?: Record<string, RawAgentConfig>;
  defaults?: {
    provider?: string;
    model?: string;
    knowledgeBase?: string;
  };
  [key: string]: any;
}

interface RawAgentConfig {
  provider?: string;
  inline?: {
    model?: string;
    apiKey?: string;
    [key: string]: any;
  };
  knowledgeBase?: string | string[];
  [key: string]: any;
}

/**
 * Load and parse agent configuration from a YAML string.
 *
 * @param yamlString - YAML configuration as a string
 * @returns Parsed and validated CrewxAgentConfig
 * @throws {YamlConfigError} If YAML is invalid or fails validation
 *
 * @example
 * ```typescript
 * const yamlConfig = `
 * agents:
 *   backend:
 *     provider: cli/claude
 *     inline:
 *       model: claude-3-opus
 * `;
 * const config = loadAgentConfigFromYaml(yamlConfig);
 * ```
 */
export function loadAgentConfigFromYaml(yamlString: string): CrewxAgentConfig {
  if (!yamlString || typeof yamlString !== 'string') {
    throw new YamlConfigError('YAML string is required and must be a non-empty string');
  }

  let parsed: any;

  try {
    const trimmed = yamlString.trim();
    parsed = loadYaml(trimmed);

    // Debug logging
    if (process.env.DEBUG_YAML === '1') {
      console.log('[YAML DEBUG] Input length:', yamlString.length);
      console.log('[YAML DEBUG] Trimmed length:', trimmed.length);
      console.log('[YAML DEBUG] Parsed:', JSON.stringify(parsed));
      console.log('[YAML DEBUG] Type:', typeof parsed);
      console.log('[YAML DEBUG] Is null:', parsed === null);
      console.log('[YAML DEBUG] Is array:', Array.isArray(parsed));
      console.log('[YAML DEBUG] Truthy check:', !parsed);
    }
  } catch (error) {
    throw new YamlConfigError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined,
    );
  }

  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new YamlConfigError('YAML must contain a valid object structure');
  }

  return parseYamlConfig(parsed as RawYamlConfig);
}

/**
 * Load agent configuration from a YAML file.
 *
 * @param filePath - Absolute or relative path to YAML file
 * @returns Parsed and validated CrewxAgentConfig
 * @throws {YamlConfigError} If file cannot be read or YAML is invalid
 *
 * @example
 * ```typescript
 * const config = loadAgentConfigFromFile('./crewx.yaml');
 * ```
 */
export function loadAgentConfigFromFile(filePath: string): CrewxAgentConfig {
  if (!filePath || typeof filePath !== 'string') {
    throw new YamlConfigError('File path is required and must be a non-empty string');
  }

  let fileContent: string;

  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new YamlConfigError(
      `Failed to read YAML file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined,
    );
  }

  return loadAgentConfigFromYaml(fileContent);
}

/**
 * Parse and validate raw YAML configuration into typed CrewxAgentConfig
 */
function parseYamlConfig(raw: RawYamlConfig): CrewxAgentConfig {
  const config: CrewxAgentConfig = {};

  // Parse agents section (if present)
  if (raw.agents && typeof raw.agents === 'object') {
    const agentIds = Object.keys(raw.agents);

    // For now, use the first agent as the default
    // In future, we could support multi-agent configs
    if (agentIds.length > 0) {
      const firstAgentId = agentIds[0];
      const agentConfig = raw.agents[firstAgentId as keyof typeof raw.agents];

      if (agentConfig) {
        config.defaultAgentId = firstAgentId;

        // Parse provider
        if (agentConfig.provider) {
          config.provider = parseProvider(agentConfig.provider, agentConfig.inline, agentConfig);
        }

        // Parse knowledge base
        if (agentConfig.knowledgeBase) {
          config.knowledgeBase = parseKnowledgeBase(agentConfig.knowledgeBase);
        }
      }
    }
  }

  // Parse defaults (if present)
  if (raw.defaults && typeof raw.defaults === 'object') {
    if (raw.defaults.provider && !config.provider) {
      config.provider = parseProvider(raw.defaults.provider);
    }

    if (raw.defaults.knowledgeBase && !config.knowledgeBase) {
      config.knowledgeBase = parseKnowledgeBase(raw.defaults.knowledgeBase);
    }
  }

  return config;
}

/**
 * Parse provider configuration from YAML
 * Format: "namespace/id" (e.g., "cli/claude", "mcp/custom-agent", "api/openai")
 *
 * For API providers (api/*), delegates to parseAPIProviderConfig for full validation.
 */
function parseProvider(
  providerString: string,
  inline?: Record<string, any>,
  rawAgentConfig?: RawAgentConfig,
): ProviderConfig | APIProviderConfig {
  if (!providerString || typeof providerString !== 'string') {
    throw new YamlConfigError('Provider must be a non-empty string');
  }

  // Split "namespace/id" format
  const parts = providerString.split('/');

  if (parts.length !== 2) {
    throw new YamlConfigError(
      `Invalid provider format '${providerString}'. Expected format: 'namespace/id' (e.g., 'cli/claude')`,
    );
  }

  const [namespace, id] = parts;

  if (!namespace || !id) {
    throw new YamlConfigError(
      `Provider namespace and id cannot be empty. Got: '${providerString}'`,
    );
  }

  // For API providers, delegate to parseAPIProviderConfig for full validation
  if (namespace === 'api') {
    try {
      // Build raw config for API provider parser
      const apiRawConfig: RawAPIAgentConfig = {
        provider: providerString,
        ...rawAgentConfig,
        inline: inline ? { ...inline, provider: providerString } : { provider: providerString },
      };
      return parseAPIProviderConfig(apiRawConfig);
    } catch (error) {
      throw new YamlConfigError(
        `Failed to parse API provider '${providerString}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // For CLI/MCP/plugin/remote providers, return standard ProviderConfig
  const config: ProviderConfig = {
    namespace,
    id,
  };

  // Extract inline configuration (model, apiKey, etc.)
  if (inline && typeof inline === 'object') {
    if (inline.model && typeof inline.model === 'string') {
      config.model = inline.model;
    }

    if (inline.apiKey && typeof inline.apiKey === 'string') {
      config.apiKey = inline.apiKey;
    }
  }

  return config;
}

/**
 * Parse knowledge base configuration from YAML
 */
function parseKnowledgeBase(value: string | string[]): KnowledgeBaseConfig {
  if (typeof value === 'string') {
    return { path: value };
  }

  if (Array.isArray(value)) {
    return { sources: value.filter((s) => typeof s === 'string') };
  }

  throw new YamlConfigError(
    'Knowledge base must be a string (path) or array of strings (sources)',
  );
}

/**
 * Validate a CrewxAgentConfig object
 * @returns True if valid, throws error if invalid
 */
export function validateAgentConfig(config: CrewxAgentConfig): boolean {
  if (!config || typeof config !== 'object') {
    throw new YamlConfigError('Configuration must be a valid object');
  }

  // Provider validation (if present)
  if (config.provider) {
    // Check if it's a ProviderConfig (has namespace and id)
    if ('namespace' in config.provider && 'id' in config.provider) {
      if (!config.provider.namespace || !config.provider.id) {
        throw new YamlConfigError('Provider must have both namespace and id');
      }
    } else {
      // It's an AIProvider instance, which is already validated by its type
      // No additional validation needed
    }
  }

  // Knowledge base validation (if present)
  if (config.knowledgeBase) {
    const hasPath = config.knowledgeBase.path && typeof config.knowledgeBase.path === 'string';
    const hasSources = Array.isArray(config.knowledgeBase.sources) && config.knowledgeBase.sources.length > 0;

    if (!hasPath && !hasSources) {
      throw new YamlConfigError('Knowledge base must have either path or sources');
    }
  }

  return true;
}
