import {
  APIProviderConfig,
  ProviderExecutionMode,
  ProviderModeOptions,
  ProviderOptions,
} from '../types/api-provider.types';
import {
  APIProviderConfigSchema,
  ProviderModeOptionsSchema,
  ProviderOptionsSchema,
} from '../schemas/api-provider.schema';
import {
  convertLegacyPermissionsToProviderOptions,
  isLegacyProviderPermissionConfig,
} from '../types/api-provider.types';

export interface ModePermissionBuckets {
  tools: string[];
  mcp: string[];
}

export interface NormalizedAPIProviderConfigResult {
  config: APIProviderConfig;
  permissionsByMode: Record<string, ModePermissionBuckets>;
}

export class APIProviderNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIProviderNormalizationError';
  }
}

export function normalizeAPIProviderConfig(
  config: APIProviderConfig,
): NormalizedAPIProviderConfigResult {
  const normalizedConfig: APIProviderConfig = {
    ...config,
  };

  const normalizedOptions: ProviderOptions = {};
  const permissionsByMode: Record<string, ModePermissionBuckets> = {};

  const parsedOptions = parseOptions(config.options);
  mergeOptions(normalizedOptions, parsedOptions, permissionsByMode);

  if (isLegacyProviderPermissionConfig(config)) {
    const legacyOptions = convertLegacyPermissionsToProviderOptions(config);
    mergeOptions(normalizedOptions, legacyOptions, permissionsByMode);
  }

  ensureDefaultModes(normalizedOptions, permissionsByMode);

  normalizedConfig.options = normalizedOptions;

  return {
    config: normalizedConfig,
    permissionsByMode,
  };
}

export function getModePermissions(
  normalized: NormalizedAPIProviderConfigResult,
  mode: ProviderExecutionMode,
): ModePermissionBuckets {
  return normalized.permissionsByMode[mode] ?? { tools: [], mcp: [] };
}

export function isAPIProviderConfig(candidate: unknown): candidate is APIProviderConfig {
  return APIProviderConfigSchema.safeParse(candidate).success;
}

export function assertAPIProviderConfig(candidate: unknown): asserts candidate is APIProviderConfig {
  const result = APIProviderConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new APIProviderNormalizationError(
      `Invalid API provider configuration: ${result.error.message}`,
    );
  }
}

function parseOptions(rawOptions?: ProviderOptions): ProviderOptions {
  if (!rawOptions) {
    return {};
  }

  const parsed = ProviderOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) {
    throw new APIProviderNormalizationError(
      `Invalid provider options: ${parsed.error.message}`,
    );
  }

  return parsed.data ?? {};
}

function mergeOptions(
  target: ProviderOptions,
  source: ProviderOptions,
  permissionsByMode: Record<string, ModePermissionBuckets>,
): void {
  for (const [mode, rawModeOptions] of Object.entries(source)) {
    if (!rawModeOptions) {
      continue;
    }

    const normalizedMode = normalizeModeOptions(rawModeOptions);
    const existingMode = target[mode] ?? { tools: [], mcp: [] };

    const mergedTools = mergeStringLists(existingMode.tools ?? [], normalizedMode.tools ?? []);
    const mergedMcp = mergeStringLists(existingMode.mcp ?? [], normalizedMode.mcp ?? []);

    target[mode] = {
      tools: mergedTools,
      mcp: mergedMcp,
    } satisfies ProviderModeOptions;

    permissionsByMode[mode] = {
      tools: [...mergedTools],
      mcp: [...mergedMcp],
    };
  }
}

function ensureDefaultModes(
  options: ProviderOptions,
  permissionsByMode: Record<string, ModePermissionBuckets>,
): void {
  const defaultModes: ProviderExecutionMode[] = ['query', 'execute'];

  for (const mode of defaultModes) {
    const modeOptions = options[mode] ?? { tools: [], mcp: [] };
    const normalizedMode = normalizeModeOptions(modeOptions);
    options[mode] = normalizedMode;
    permissionsByMode[mode] = {
      tools: [...(normalizedMode.tools ?? [])],
      mcp: [...(normalizedMode.mcp ?? [])],
    };
  }
}

function normalizeModeOptions(
  modeOptions?: ProviderModeOptions,
): ProviderModeOptions {
  const parsed = ProviderModeOptionsSchema.safeParse(modeOptions ?? {});
  if (!parsed.success) {
    throw new APIProviderNormalizationError(
      `Invalid mode configuration: ${parsed.error.message}`,
    );
  }

  const tools = dedupeStrings(parsed.data.tools);
  const mcp = dedupeStrings(parsed.data.mcp);

  return {
    tools,
    mcp,
  } satisfies ProviderModeOptions;
}

function mergeStringLists(base: string[], additions: string[]): string[] {
  if (base.length === 0 && additions.length === 0) {
    return [];
  }

  const merged = new Set<string>();
  for (const value of base) {
    if (value) {
      merged.add(value);
    }
  }
  for (const value of additions) {
    if (value) {
      merged.add(value);
    }
  }
  return Array.from(merged);
}

function dedupeStrings(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  const normalized = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      continue;
    }
    normalized.add(trimmed);
  }
  return Array.from(normalized);
}
