import { Injectable, Logger } from '@nestjs/common';
import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { BuiltInProviders, ProviderNamespace } from '../providers/ai-provider.interface';

export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * ConfigValidatorService
 *
 * Validates YAML configuration files for CrewX agents.
 *
 * Features:
 * - JSON Schema validation for configuration structure
 * - File existence validation for document paths
 * - Typo detection with suggestions (Levenshtein distance)
 * - Enhanced error messages with line numbers
 *
 * Validates:
 * 1. Required fields (id, provider)
 * 2. Field types (timeout must be number, etc.)
 * 3. Enum values (provider must be 'claude', 'gemini', or 'copilot')
 * 4. File paths (documents must exist)
 * 5. Value ranges (timeout >= 0)
 */
@Injectable()
export class ConfigValidatorService {
  private readonly logger = new Logger('ConfigValidatorService');
  private readonly ajv: Ajv;

  // Valid built-in provider values (with namespace)
  private readonly VALID_BUILTIN_PROVIDERS = [
    BuiltInProviders.CLAUDE,
    BuiltInProviders.GEMINI,
    BuiltInProviders.COPILOT,
    BuiltInProviders.CODEX,
  ];

  // Known field names for typo detection
  private readonly KNOWN_AGENT_FIELDS = [
    'id', 'name', 'role', 'team', 'provider', 'working_directory',
    'workingDirectory', 'capabilities', 'description', 'specialties',
    'systemPrompt', 'system_prompt', 'options', 'inline', 'remote'
  ];

  private readonly KNOWN_INLINE_FIELDS = [
    'type', 'timeout', 'working_directory', 'system_prompt', 'model', 'provider'
  ];

  private readonly KNOWN_DOCUMENT_FIELDS = [
    'path', 'description', 'name'
  ];

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
  }

  /**
   * Validate configuration object
   */
  validateConfig(config: any, configPath?: string): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Schema validation
    const schemaErrors = this.validateSchema(config);
    errors.push(...schemaErrors);

    // 2. File existence validation (documents)
    if (config.documents && Array.isArray(config.documents) && configPath) {
      const fileErrors = this.validateDocumentFiles(config.documents, configPath);
      errors.push(...fileErrors);
    }

    // 3. Typo detection
    const typoErrors = this.detectTypos(config);
    errors.push(...typoErrors);

    // 4. Value validation
    const valueErrors = this.validateValues(config);
    errors.push(...valueErrors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * JSON Schema validation
   */
  private validateSchema(config: any): ValidationError[] {
    // Build dynamic list of valid providers
    const validProviders: string[] = [...this.VALID_BUILTIN_PROVIDERS];

    // Add plugin providers from config (with plugin/ namespace)
    if (config.providers && Array.isArray(config.providers)) {
      config.providers.forEach((provider: any) => {
        if (provider.type === 'plugin' && provider.id) {
          const pluginProviderName = `${ProviderNamespace.PLUGIN}/${provider.id}`;
          if (!validProviders.includes(pluginProviderName)) {
            validProviders.push(pluginProviderName);
          }
        } else if (provider.type === 'remote' && provider.id) {
          const remoteProviderName = `${ProviderNamespace.REMOTE}/${provider.id}`;
          if (!validProviders.includes(remoteProviderName)) {
            validProviders.push(remoteProviderName);
          }
        }
      });
    }

    const schema = {
      type: 'object',
      required: ['agents'],
      properties: {
        agents: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', minLength: 1 },
              name: { type: 'string' },
              role: { type: 'string' },
              team: { type: 'string' },
              provider: {
                oneOf: [
                  { type: 'string', enum: validProviders },
                  {
                    type: 'array',
                    items: { type: 'string', enum: validProviders },
                    minItems: 1
                  }
                ]
              },
              working_directory: { type: 'string' },
              workingDirectory: { type: 'string' },
              capabilities: {
                type: 'array',
                items: { type: 'string' }
              },
              description: { type: 'string' },
              specialties: {
                type: 'array',
                items: { type: 'string' }
              },
              systemPrompt: { type: 'string' },
              system_prompt: { type: 'string' },
              options: {}, // Can be array or object
              inline: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  timeout: { type: 'number', minimum: 0 },
                  working_directory: { type: 'string' },
                  system_prompt: { type: 'string' },
                  model: { type: 'string' },
                  provider: {
                    type: 'string',
                    enum: validProviders
                  }
                },
                additionalProperties: true
              }
            },
            additionalProperties: true
          }
        },
        documents: {
          oneOf: [
            {
              // Array format (for backward compatibility)
              type: 'array',
              items: {
                type: 'object',
                required: ['path'],
                properties: {
                  path: { type: 'string', minLength: 1 },
                  description: { type: 'string' },
                  name: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            {
              // Object format (named documents)
              type: 'object',
              additionalProperties: true // Each document can have any structure
            }
          ]
        }
      },
      additionalProperties: true
    };

    const validate = this.ajv.compile(schema);
    const valid = validate(config);

    if (valid) {
      return [];
    }

    return this.formatSchemaErrors(validate.errors || []);
  }

  /**
   * Format JSON Schema validation errors into readable messages
   */
  private formatSchemaErrors(errors: ErrorObject[]): ValidationError[] {
    return errors.map(error => {
      const path = error.instancePath ?? 'root';
      let message = '';
      let suggestion: string | undefined;

      switch (error.keyword) {
        case 'required':
          if ('missingProperty' in error.params) {
            message = `Required field missing: '${error.params.missingProperty}'`;
          } else {
            message = 'Required field missing';
          }
          break;
        case 'type':
          if ('type' in error.params) {
            message = `Invalid type: expected ${error.params.type}, got ${typeof error.data}`;
          } else {
            message = 'Invalid type';
          }
          break;
        case 'enum':
          if ('allowedValues' in error.params) {
            message = `Invalid value: '${error.data}'. Must be one of: ${(error.params.allowedValues as string[]).join(', ')}`;
            if (error.instancePath?.includes('provider')) {
              suggestion = `Valid providers: ${this.VALID_BUILTIN_PROVIDERS.join(', ')} + plugin providers`;
            }
          } else {
            message = 'Invalid enum value';
          }
          break;
        case 'minimum':
          if ('limit' in error.params) {
            message = `Value must be >= ${error.params.limit}, got ${error.data}`;
          } else {
            message = 'Value too small';
          }
          break;
        case 'minLength':
          message = `Value must not be empty`;
          break;
        case 'minItems':
          if ('limit' in error.params) {
            message = `Array must contain at least ${error.params.limit} item(s)`;
          } else {
            message = 'Array too short';
          }
          break;
        case 'oneOf':
          message = `Invalid format: ${error.message}`;
          break;
        default:
          message = error.message || 'Validation error';
      }

      return {
        path: this.formatJsonPath(path),
        message,
        suggestion
      };
    });
  }

  /**
   * Validate document file paths exist
   */
  private validateDocumentFiles(documents: any[] | any, configPath: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const configDir = dirname(resolve(configPath));

    // Handle array format
    if (Array.isArray(documents)) {
      documents.forEach((doc, index) => {
        if (!doc.path) {
          return; // Schema validation will catch this
        }

        const fullPath = resolve(configDir, doc.path);
        if (!existsSync(fullPath)) {
          errors.push({
            path: `documents[${index}].path`,
            message: `Document file not found: ${doc.path}`,
            suggestion: `Resolved path: ${fullPath}`
          });
        }
      });
    }
    // Handle object format (named documents)
    else if (documents && typeof documents === 'object') {
      Object.entries(documents).forEach(([name, doc]: [string, any]) => {
        // Check if it's a file-based document (has path property)
        if (doc && typeof doc === 'object' && doc.path) {
          const fullPath = resolve(configDir, doc.path);
          if (!existsSync(fullPath)) {
            errors.push({
              path: `documents.${name}.path`,
              message: `Document file not found: ${doc.path}`,
              suggestion: `Resolved path: ${fullPath}`
            });
          }
        }
        // Inline documents (string content) don't need file validation
      });
    }

    return errors;
  }

  /**
   * Detect typos in field names
   */
  private detectTypos(config: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config.agents && Array.isArray(config.agents)) {
      config.agents.forEach((agent: any, index: number) => {
        // Check agent-level fields
        Object.keys(agent).forEach(key => {
          if (!this.KNOWN_AGENT_FIELDS.includes(key)) {
            const suggestion = this.findClosestMatch(key, this.KNOWN_AGENT_FIELDS);
            if (suggestion) {
              errors.push({
                path: `agents[${index}].${key}`,
                message: `Unknown property: '${key}'`,
                suggestion: `Did you mean '${suggestion}'?`
              });
            }
          }
        });

        // Check inline fields
        if (agent.inline && typeof agent.inline === 'object') {
          Object.keys(agent.inline).forEach(key => {
            if (!this.KNOWN_INLINE_FIELDS.includes(key)) {
              const suggestion = this.findClosestMatch(key, this.KNOWN_INLINE_FIELDS);
              if (suggestion) {
                errors.push({
                  path: `agents[${index}].inline.${key}`,
                  message: `Unknown property: '${key}'`,
                  suggestion: `Did you mean '${suggestion}'?`
                });
              }
            }
          });
        }
      });
    }

    if (config.documents && Array.isArray(config.documents)) {
      config.documents.forEach((doc: any, index: number) => {
        Object.keys(doc).forEach(key => {
          if (!this.KNOWN_DOCUMENT_FIELDS.includes(key)) {
            const suggestion = this.findClosestMatch(key, this.KNOWN_DOCUMENT_FIELDS);
            if (suggestion) {
              errors.push({
                path: `documents[${index}].${key}`,
                message: `Unknown property: '${key}'`,
                suggestion: `Did you mean '${suggestion}'?`
              });
            }
          }
        });
      });
    }

    return errors;
  }

  /**
   * Validate configuration values
   */
  private validateValues(config: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Build dynamic list of valid providers (with namespaces)
    const validProviders: string[] = [...this.VALID_BUILTIN_PROVIDERS];
    if (config.providers && Array.isArray(config.providers)) {
      config.providers.forEach((provider: any) => {
        if (provider.type === 'plugin' && provider.id) {
          const pluginProviderName = `${ProviderNamespace.PLUGIN}/${provider.id}`;
          if (!validProviders.includes(pluginProviderName)) {
            validProviders.push(pluginProviderName);
          }
        } else if (provider.type === 'remote' && provider.id) {
          const remoteProviderName = `${ProviderNamespace.REMOTE}/${provider.id}`;
          if (!validProviders.includes(remoteProviderName)) {
            validProviders.push(remoteProviderName);
          }
        }
      });
    }

    if (config.agents && Array.isArray(config.agents)) {
      config.agents.forEach((agent: any, index: number) => {
        // Check that provider exists either at agent level or in inline
        const hasAgentProvider = agent.provider;
        const hasInlineProvider = agent.inline?.provider;

        if (!hasAgentProvider && !hasInlineProvider) {
          errors.push({
            path: `agents[${index}]`,
            message: `Missing provider: must have 'provider' field at agent level or in 'inline.provider'`,
            suggestion: `Add 'provider' field with value: ${validProviders.join(', ')}`
          });
        }

        // Validate provider
        if (agent.provider) {
          if (Array.isArray(agent.provider)) {
            agent.provider.forEach((p: string, pIndex: number) => {
              if (!validProviders.includes(p)) {
                errors.push({
                  path: `agents[${index}].provider[${pIndex}]`,
                  message: `Invalid provider: '${p}'`,
                  suggestion: `Valid providers: ${validProviders.join(', ')}`
                });
              }
            });
          } else if (typeof agent.provider === 'string' && !validProviders.includes(agent.provider)) {
            errors.push({
              path: `agents[${index}].provider`,
              message: `Invalid provider: '${agent.provider}'`,
              suggestion: `Valid providers: ${validProviders.join(', ')}`
            });
          }
        }

        // Validate inline.timeout
        if (agent.inline?.timeout !== undefined) {
          if (typeof agent.inline.timeout !== 'number') {
            errors.push({
              path: `agents[${index}].inline.timeout`,
              message: `Invalid timeout: must be a number, got ${typeof agent.inline.timeout}`,
            });
          } else if (agent.inline.timeout < 0) {
            errors.push({
              path: `agents[${index}].inline.timeout`,
              message: `Invalid timeout: must be >= 0, got ${agent.inline.timeout}`,
            });
          }
        }

        // Validate inline.provider
        if (agent.inline?.provider && !validProviders.includes(agent.inline.provider)) {
          errors.push({
            path: `agents[${index}].inline.provider`,
            message: `Invalid provider: '${agent.inline.provider}'`,
            suggestion: `Valid providers: ${validProviders.join(', ')}`
          });
        }
      });
    }

    return errors;
  }

  /**
   * Find closest matching field name using Levenshtein distance
   */
  private findClosestMatch(word: string, candidates: string[]): string | null {
    let minDistance = Infinity;
    let closestMatch: string | null = null;

    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(word.toLowerCase(), candidate.toLowerCase());

      // Only suggest if distance is small (typo, not completely different word)
      if (distance < minDistance && distance <= 3) {
        minDistance = distance;
        closestMatch = candidate;
      }
    }

    return closestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      if (matrix[0]) {
        matrix[0][j] = j;
      }
    }

    // Calculate distances
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const prevRow = matrix[i - 1];
        const currentRow = matrix[i];

        if (!prevRow || !currentRow) continue;

        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          const diag = prevRow[j - 1];
          if (diag !== undefined) {
            currentRow[j] = diag;
          }
        } else {
          const diag = prevRow[j - 1];
          const left = currentRow[j - 1];
          const up = prevRow[j];

          if (diag !== undefined && left !== undefined && up !== undefined) {
            currentRow[j] = Math.min(
              diag + 1, // substitution
              left + 1, // insertion
              up + 1    // deletion
            );
          }
        }
      }
    }

    const lastRow = matrix[b.length];
    return lastRow?.[a.length] ?? 0;
  }

  /**
   * Format JSON path to be more readable
   */
  private formatJsonPath(path: string): string {
    if (path === 'root' || path === '') {
      return 'config';
    }
    return path.replace(/^\//, '').replace(/\//g, '.');
  }

  /**
   * Format validation errors into a readable error message
   */
  formatErrorMessage(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '';
    }

    const lines = ['❌ Configuration validation failed:\n'];

    errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error.message}`);
      lines.push(`   → Found in ${error.path}`);
      if (error.suggestion) {
        lines.push(`   → ${error.suggestion}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }
}
