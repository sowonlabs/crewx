/**
 * Utility functions for reading and managing environment variables
 */

/**
 * Reads an environment variable with an optional default value
 * @param key - The environment variable key
 * @param defaultValue - The default value to return if the environment variable is not set
 * @returns The environment variable value or the default value
 */
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Reads an environment variable and ensures it has a value (throws if not found and no default)
 * @param key - The environment variable key
 * @param defaultValue - The default value to return if the environment variable is not set
 * @returns The environment variable value or the default value
 * @throws Error if the environment variable is not set and no default is provided
 */
export function getRequiredEnvVar(key: string, defaultValue?: string): string {
  const value = getEnvVar(key, defaultValue);
  if (value === undefined) {
    throw new Error(`Required environment variable '${key}' is not set`);
  }
  return value;
}

/**
 * Reads an environment variable as a boolean value
 * @param key - The environment variable key
 * @param defaultValue - The default boolean value
 * @returns The boolean value of the environment variable
 */
export function getEnvVarAsBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Reads an environment variable as a number
 * @param key - The environment variable key
 * @param defaultValue - The default number value
 * @returns The numeric value of the environment variable
 * @throws Error if the value cannot be parsed as a number
 */
export function getEnvVarAsNumber(key: string, defaultValue?: number): number | undefined {
  const value = getEnvVar(key);
  if (value === undefined) {
    return defaultValue;
  }

  const numValue = Number(value);
  if (isNaN(numValue)) {
    throw new Error(`Environment variable '${key}' value '${value}' is not a valid number`);
  }

  return numValue;
}

/**
 * Configuration object type for structured environment variable reading
 */
export interface EnvConfig {
  [key: string]: {
    key: string;
    defaultValue?: string | number | boolean;
    type?: 'string' | 'number' | 'boolean';
    required?: boolean;
  };
}

/**
 * Reads multiple environment variables based on a configuration object
 * @param config - Configuration object defining the environment variables to read
 * @returns Object with the resolved environment variable values
 */
export function getEnvConfig<T extends EnvConfig>(config: T): {
  [K in keyof T]: T[K]['type'] extends 'number'
    ? number
    : T[K]['type'] extends 'boolean'
    ? boolean
    : string;
} {
  const result: any = {};

  for (const [configKey, configValue] of Object.entries(config)) {
    const { key, defaultValue, type = 'string', required = false } = configValue;

    try {
      let value: any;

      switch (type) {
        case 'boolean':
          value = getEnvVarAsBoolean(key, defaultValue as boolean);
          break;
        case 'number':
          value = getEnvVarAsNumber(key, defaultValue as number);
          if (value === undefined && required) {
            throw new Error(`Required environment variable '${key}' is not set`);
          }
          break;
        default:
          if (required) {
            value = getRequiredEnvVar(key, defaultValue as string);
          } else {
            value = getEnvVar(key, defaultValue as string);
          }
      }

      result[configKey] = value;
    } catch (error) {
      throw new Error(`Failed to read environment variable for '${configKey}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}