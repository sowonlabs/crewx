/**
 * Mastra-based API Provider Implementation
 *
 * This provider wraps Mastra framework to provide AI agent capabilities
 * via HTTP APIs (OpenAI, Anthropic, Google, Bedrock, LiteLLM, Ollama, SowonAI)
 *
 * Key Features:
 * - 7 provider types support
 * - Tool calling (via Mastra Agent)
 * - Streaming support (future)
 * - Vercel AI SDK based
 *
 * @module MastraAPIProvider
 * @since WBS-20 Phase 2
 */

import { Agent } from '@mastra/core';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';
import type {
  APIProviderConfig,
  ToolExecutionContext,
  ProviderExecutionMode,
} from '../../types/api-provider.types';
import { DEFAULT_MAX_STEPS, MAX_STEPS_LIMIT } from '../../types/api-provider.types';
import { MastraToolAdapter } from '../../adapters/MastraToolAdapter';
import {
  normalizeAPIProviderConfig,
  type ModePermissionBuckets,
} from '../../utils/api-provider-normalizer';
import { getLogConfig, type LogConfig } from '../../config/log.config';

/**
 * MastraAPIProvider
 *
 * Wraps Mastra Agent to provide CrewX-compatible API provider.
 * Supports 7 provider types with unified interface.
 *
 * @example
 * ```typescript
 * const provider = new MastraAPIProvider({
 *   provider: 'api/openai',
 *   model: 'gpt-4',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 *
 * const result = await provider.query('Hello, world!');
 * console.log(result.content);
 * ```
 */
export class MastraAPIProvider implements AIProvider {
  readonly name: string;
  private config: APIProviderConfig;
  private tools: any[] = [];
  private toolContext?: ToolExecutionContext;
  private filteredToolSets: Record<string, any[]> = {};
  private readonly permissionsByMode: Record<string, ModePermissionBuckets>;
  private readonly defaultMode: ProviderExecutionMode;
  private readonly logConfig: LogConfig;

  constructor(config: APIProviderConfig, mode: ProviderExecutionMode = 'query') {
    const normalizedConfig = normalizeAPIProviderConfig(config);
    this.config = normalizedConfig.config;
    this.permissionsByMode = normalizedConfig.permissionsByMode;
    this.defaultMode = mode;
    this.name = this.config.provider;
    this.logConfig = getLogConfig();
  }

  /**
   * Create Vercel AI SDK model instance based on provider type
   *
   * Uses createXXX() functions to pass custom configuration (apiKey, baseURL)
   * instead of relying on environment variables.
   *
   * Supports:
   * - api/openai: OpenAI API (or OpenRouter when URL contains openrouter.ai)
   * - api/anthropic: Anthropic API
   * - api/google: Google AI API
   * - api/bedrock: AWS Bedrock (Anthropic-compatible)
   * - api/litellm: LiteLLM Gateway (OpenAI-compatible)
   * - api/ollama: Ollama (OpenAI-compatible)
   * - api/sowonai: SowonAI (OpenAI-compatible)
   */
  private createModel(config: APIProviderConfig): any {
    const { provider, model, apiKey, url } = config;

    switch (provider) {
      case 'api/openai': {
        // Detect OpenRouter and use dedicated SDK
        if (url && url.includes('openrouter.ai')) {
          console.log('[MastraAPIProvider] Detected OpenRouter, using @openrouter/ai-sdk-provider');
          const openrouter = createOpenRouter({
            apiKey: apiKey || '',
          });
          return openrouter(model);
        }

        // Standard OpenAI
        if (apiKey && url) {
          const customOpenAI = createOpenAI({ apiKey, baseURL: url });
          return customOpenAI(model);
        } else if (apiKey) {
          const customOpenAI = createOpenAI({ apiKey });
          return customOpenAI(model);
        }
        return openai(model);
      }

      case 'api/litellm':
      case 'api/ollama':
      case 'api/sowonai': {
        let defaultURL = 'http://localhost:4000';
        let defaultKey = 'dummy';
        if (provider === 'api/ollama') {
          defaultURL = 'http://localhost:11434/v1';
          defaultKey = 'ollama';
        } else if (provider === 'api/sowonai') {
          defaultURL = 'https://api.sowon.ai/v1';
        }
        const providerInstance = createOpenAICompatible({
          name: provider.replace('api/', ''),
          baseURL: url || defaultURL,
          apiKey: apiKey || defaultKey,
        });
        return providerInstance(model);
      }

      case 'api/anthropic': {
        if (apiKey && url) {
          const customAnthropic = createAnthropic({ apiKey, baseURL: url });
          return customAnthropic(model);
        } else if (apiKey) {
          const customAnthropic = createAnthropic({ apiKey });
          return customAnthropic(model);
        }
        return anthropic(model);
      }

      case 'api/bedrock': {
        const customAnthropic = createAnthropic({
          apiKey: apiKey || '',
          baseURL: url || 'https://bedrock-runtime.us-east-1.amazonaws.com',
        });
        return customAnthropic(model);
      }

      case 'api/google': {
        if (apiKey) {
          const customGoogle = createGoogleGenerativeAI({ apiKey });
          return customGoogle(model);
        }
        return google(model);
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }


  /**
   * Set tools for this agent
   *
   * Accepts both FrameworkToolDefinition (old format) and Mastra Tool (from createTool()).
   * MastraToolAdapter handles conversion and injects ToolExecutionContext.
   *
   * @param tools - Array of tool definitions (FrameworkToolDefinition or Mastra Tool)
   * @param context - Execution context to inject into tools
   */
  setTools(tools: any[], context: ToolExecutionContext): void {
    this.tools = tools;
    this.toolContext = this.applyDefaultModeToContext(context);
    this.filteredToolSets = this.buildModeAwareToolSets(tools);
  }

  private applyDefaultModeToContext(
    context?: ToolExecutionContext,
  ): ToolExecutionContext | undefined {
    if (!context) {
      return undefined;
    }

    if (context.mode) {
      return context;
    }

    return { ...context, mode: this.defaultMode };
  }

  private buildModeAwareToolSets(tools: any[]): Record<string, any[]> {
    const lookup = new Map<string, any>();

    for (const tool of tools) {
      const identifier = this.getToolIdentifier(tool);
      if (identifier) {
        lookup.set(identifier, tool);
      } else {
        console.warn('[MastraAPIProvider] Ignoring tool without name/id during registration');
      }
    }

    const filtered: Record<string, any[]> = {};
    for (const [mode, permissions] of Object.entries(this.permissionsByMode)) {
      if (!permissions.tools.length) {
        filtered[mode] = [];
        continue;
      }

      filtered[mode] = permissions.tools
        .map((toolName) => {
          if (!lookup.has(toolName)) {
            console.warn(
              `[MastraAPIProvider] Tool '${toolName}' referenced in ${mode} mode but not registered`,
            );
          }
          return lookup.get(toolName);
        })
        .filter(Boolean);
    }

    return filtered;
  }

  private getToolIdentifier(tool: any): string | undefined {
    if (tool && typeof tool.id === 'string') {
      return tool.id;
    }
    if (tool && typeof tool.name === 'string') {
      return tool.name;
    }
    return undefined;
  }

  private createMastraToolsForMode(mode: ProviderExecutionMode): Record<string, any> {
    if (!this.toolContext) {
      return {};
    }

    const registeredTools = this.filteredToolSets[mode] ?? [];
    if (registeredTools.length === 0) {
      return {};
    }

    const contextWithMode: ToolExecutionContext = { ...this.toolContext, mode };
    return MastraToolAdapter.convertTools(registeredTools, contextWithMode);
  }

  /**
   * Query mode: Read-only analysis
   *
   * Executes agent with the given prompt and returns response.
   * Same as execute() for API providers (no mode distinction).
   *
   * @param prompt - User query or prompt
   * @param options - Query options (timeout, taskId, etc.)
   * @returns AI response
   */
  async query(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    return this.runWithMode('query', prompt, options);
  }

  /**
   * Execute mode: Can create/modify files
   *
   * For API providers, this is identical to query().
   * Mode distinction is handled by CLI providers only.
   *
   * @param prompt - User task or command
   * @param options - Execute options
   * @returns AI response
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    return this.runWithMode('execute', prompt, options);
  }

  private async runWithMode(
    mode: ProviderExecutionMode,
    prompt: string,
    options: AIQueryOptions,
  ): Promise<AIResponse> {
    const taskId =
      options.taskId || `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const mastraTools = this.createMastraToolsForMode(mode);

      // Log for CLI task logs (INFO level only)
      const toolCount = Object.keys(mastraTools).length;
      if (toolCount > 0) {
        console.log(`[INFO] Registered ${toolCount} tools for ${mode} mode: ${Object.keys(mastraTools).join(', ')}`);
      } else {
        console.log(`[INFO] No tools registered for ${mode} mode`);
      }

      // Allow runtime model override via options.model
      const configToUse = options.model
        ? { ...this.config, model: options.model }
        : this.config;

      console.log(`[INFO] Using model: ${configToUse.model}`);

      const modelInstance = this.createModel(configToUse);

      const agent = new Agent({
        name: this.config.provider,
        model: modelInstance,
        instructions: prompt,
        tools: mastraTools,
      });

      // Add maxSteps to enable multi-turn agent loop (default: DEFAULT_MAX_STEPS)
      // Note: toolChoice is NOT forced to 'required' - let the model decide when to use tools
      const maxSteps = Math.min(this.config.maxSteps ?? DEFAULT_MAX_STEPS, MAX_STEPS_LIMIT);
      const generateOptions = { maxSteps };

      console.log(`[INFO] Sending request to AI model (maxSteps: ${generateOptions.maxSteps})...`);
      const fullOutput = await agent.generate(prompt, generateOptions);
      console.log(`[INFO] Received response from AI model`);

      return this.convertResponse(fullOutput, taskId);
    } catch (error: any) {
      return {
        content: '',
        provider: this.name,
        command: `${this.name} ${mode}`,
        success: false,
        error: error.message || 'Unknown error',
        taskId,
      };
    }
  }

  /**
   * Convert Mastra response to CrewX AIResponse
   *
   * Transforms Mastra Agent's full output format to CrewX's unified format.
   *
   * @param fullOutput - Mastra getFullOutput() result
   * @param taskId - Task identifier
   * @returns CrewX AIResponse
   */
  private convertResponse(fullOutput: any, taskId: string): AIResponse {
    // Extract text content (should be directly available now)
    let content = fullOutput.text || '';

    // Build AIResponse
    const response: AIResponse = {
      content,
      provider: this.name,
      command: `${this.name} (Mastra)`,
      success: true,
      taskId,
      model: this.config.model,
    };

    // Add tool call information if available
    if (fullOutput.toolCalls && fullOutput.toolCalls.length > 0) {
      const firstToolCall = fullOutput.toolCalls[0];

      // Extract tool info from Mastra format
      const toolName = firstToolCall.payload?.toolName || firstToolCall.toolName;
      const toolArgs = firstToolCall.payload?.args || firstToolCall.args;

      console.log(`[INFO] Tool called: ${toolName}`);
      console.log(`[INFO] Tool arguments: ${JSON.stringify(toolArgs)}`);

      // Find corresponding tool result
      const firstResult = fullOutput.toolResults?.[0];
      const toolResultValue = firstResult?.payload?.result || firstResult?.result;

      if (toolResultValue) {
        const resultPreview = typeof toolResultValue === 'string'
          ? toolResultValue.substring(0, this.logConfig.toolResultMaxLength)
          : JSON.stringify(toolResultValue).substring(0, this.logConfig.toolResultMaxLength);
        console.log(`[INFO] Tool result preview: ${resultPreview}${(typeof toolResultValue === 'string' ? toolResultValue.length : JSON.stringify(toolResultValue).length) > this.logConfig.toolResultMaxLength ? '...' : ''}`);
      }

      response.toolCall = {
        toolName,
        toolInput: toolArgs,
        toolResult: toolResultValue,
      };

      // If content is empty but we have tool results, use the tool result as content
      if (!content && toolResultValue) {
        content = `Tool '${toolName}' executed successfully:\n\n${toolResultValue}`;
        response.content = content;
      }
    }

    return response;
  }

  /**
   * Check if provider is available
   *
   * For API providers, this checks if API key is configured.
   * Actual connectivity is not verified (would require HTTP call).
   *
   * @returns true if API key is configured
   */
  async isAvailable(): Promise<boolean> {
    // Check if API key is configured
    const { provider, apiKey } = this.config;

    // Providers that don't require API key
    if (provider === 'api/ollama') {
      return true;
    }

    // Check if apiKey or environment variable is set
    if (apiKey) {
      return true;
    }

    // Check environment variables
    switch (provider) {
      case 'api/openai':
        return !!process.env.OPENAI_API_KEY;
      case 'api/anthropic':
        return !!process.env.ANTHROPIC_API_KEY;
      case 'api/google':
        return !!process.env.GOOGLE_API_KEY;
      case 'api/bedrock':
        return !!process.env.AWS_ACCESS_KEY_ID;
      case 'api/litellm':
        return !!process.env.LITELLM_API_KEY;
      case 'api/sowonai':
        return !!process.env.SOWONAI_API_KEY;
      default:
        return false;
    }
  }

  /**
   * Get tool path
   *
   * API providers have no local tool path (HTTP-based).
   * Returns null.
   *
   * @returns null (no local tool)
   */
  async getToolPath(): Promise<string | null> {
    return null;
  }
}
