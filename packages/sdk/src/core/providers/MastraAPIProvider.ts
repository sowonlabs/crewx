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

      // Configure maxSteps to enable multi-turn agent loop (default: DEFAULT_MAX_STEPS)
      // Note: toolChoice is NOT forced to 'required' - let the model decide when to use tools.
      // Forcing 'required' causes the loop to break when models return text alongside tool calls,
      // because Mastra interprets the presence of text content as a stop signal.
      const maxSteps = Math.min(this.config.maxSteps ?? DEFAULT_MAX_STEPS, MAX_STEPS_LIMIT);
      const generateOptions = { maxSteps };

      console.log(`[INFO] Sending request to AI model (maxSteps: ${maxSteps})...`);
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
   * Extract tool name from a Mastra tool call chunk.
   */
  private extractToolName(tc: any): string {
    return tc.payload?.toolName || tc.toolName || 'unknown';
  }

  /**
   * Extract tool arguments from a Mastra tool call chunk.
   */
  private extractToolArgs(tc: any): any {
    return tc.payload?.args || tc.args;
  }

  /**
   * Extract tool result value from a Mastra tool result chunk.
   */
  private extractToolResult(tr: any): any {
    return tr?.payload?.result || tr?.result;
  }

  /**
   * Convert Mastra response to CrewX AIResponse
   *
   * Transforms Mastra Agent's full output format to CrewX's unified format.
   * Handles multi-step tool calling by collecting tool calls from all steps.
   *
   * @param fullOutput - Mastra Agent.generate() result
   * @param taskId - Task identifier
   * @returns CrewX AIResponse
   */
  private convertResponse(fullOutput: any, taskId: string): AIResponse {
    let content = fullOutput.text || '';

    const response: AIResponse = {
      content,
      provider: this.name,
      command: `${this.name} (Mastra)`,
      success: true,
      taskId,
      model: this.config.model,
    };

    // Collect ALL tool calls across ALL steps for multi-step support.
    // fullOutput.steps[] contains per-step data; fullOutput.toolCalls[] contains
    // only the last step's tool calls. We iterate steps to get the full picture.
    const allToolCalls: Array<{ toolName: string; toolInput: any; toolResult: any }> = [];
    const steps: any[] = fullOutput.steps || [];

    for (const step of steps) {
      const stepToolCalls: any[] = step.toolCalls || [];
      const stepToolResults: any[] = step.toolResults || [];

      for (let i = 0; i < stepToolCalls.length; i++) {
        const tc = stepToolCalls[i];
        const tr = stepToolResults[i];
        const toolName = this.extractToolName(tc);
        const toolArgs = this.extractToolArgs(tc);
        const toolResultValue = this.extractToolResult(tr);

        console.log(`[INFO] Tool called: ${toolName}`);

        if (toolResultValue) {
          const resultStr = typeof toolResultValue === 'string'
            ? toolResultValue
            : JSON.stringify(toolResultValue);
          const preview = resultStr.substring(0, this.logConfig.toolResultMaxLength);
          console.log(`[INFO] Tool result preview: ${preview}${resultStr.length > this.logConfig.toolResultMaxLength ? '...' : ''}`);
        }

        allToolCalls.push({
          toolName,
          toolInput: toolArgs,
          toolResult: toolResultValue,
        });
      }
    }

    // Fallback: if no steps but top-level toolCalls exist (single-step case)
    if (allToolCalls.length === 0 && fullOutput.toolCalls?.length > 0) {
      for (let i = 0; i < fullOutput.toolCalls.length; i++) {
        const tc = fullOutput.toolCalls[i];
        const tr = fullOutput.toolResults?.[i];
        const toolName = this.extractToolName(tc);
        const toolArgs = this.extractToolArgs(tc);
        const toolResultValue = this.extractToolResult(tr);

        console.log(`[INFO] Tool called: ${toolName}`);
        allToolCalls.push({
          toolName,
          toolInput: toolArgs,
          toolResult: toolResultValue,
        });
      }
    }

    if (allToolCalls.length > 0) {
      console.log(`[INFO] Total tool calls across ${steps.length} step(s): ${allToolCalls.length}`);

      // Backward-compatible: set first tool call
      response.toolCall = allToolCalls[0];
      // Multi-step: set all tool calls
      response.toolCalls = allToolCalls;
      response.steps = steps.length;

      // If content is empty but we have tool results, synthesize from last tool result
      if (!content && allToolCalls.length > 0) {
        const lastCall = allToolCalls[allToolCalls.length - 1]!;
        if (lastCall.toolResult) {
          content = `Tool '${lastCall.toolName}' executed successfully:\n\n${lastCall.toolResult}`;
          response.content = content;
        }
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
