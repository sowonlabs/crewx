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
import type { AIProvider, AIQueryOptions, AIResponse } from './ai-provider.interface';
import type { APIProviderConfig, ToolExecutionContext, FrameworkToolDefinition } from '../../types/api-provider.types';
import { MastraToolAdapter } from '../../adapters/MastraToolAdapter';

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
  private tools: FrameworkToolDefinition[] = [];
  private toolContext?: ToolExecutionContext;

  constructor(config: APIProviderConfig) {
    this.config = config;
    this.name = config.provider;
  }

  /**
   * Create Vercel AI SDK model instance based on provider type
   *
   * Uses createXXX() functions to pass custom configuration (apiKey, baseURL)
   * instead of relying on environment variables.
   *
   * Supports:
   * - api/openai: OpenAI API
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
        // Set provider-specific defaults
        let defaultURL = 'http://localhost:4000'; // LiteLLM default
        let defaultKey = 'dummy';

        if (provider === 'api/ollama') {
          defaultURL = 'http://localhost:11434/v1';
          defaultKey = 'ollama';
        } else if (provider === 'api/sowonai') {
          defaultURL = 'https://api.sowon.ai/v1';
        }

        const customOpenAI = createOpenAI({
          apiKey: apiKey || defaultKey,
          baseURL: url || defaultURL,
        });
        return customOpenAI(model);
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
   * Converts CrewX FrameworkToolDefinition to Mastra tools
   * and injects ToolExecutionContext for each tool.
   *
   * @param tools - Array of tool definitions
   * @param context - Execution context to inject into tools
   */
  setTools(tools: FrameworkToolDefinition[], context: ToolExecutionContext): void {
    this.tools = tools;
    this.toolContext = context;
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
    const taskId = options.taskId || `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Convert tools to Mastra format using MastraToolAdapter
      const mastraTools: Record<string, any> = {};
      if (this.tools.length > 0 && this.toolContext) {
        // Use MastraToolAdapter to convert CrewX tools to Mastra format
        Object.assign(mastraTools, MastraToolAdapter.convertTools(this.tools, this.toolContext));
      }

      // Create model instance with custom configuration
      const modelInstance = this.createModel(this.config);

      // Create Mastra Agent for this query
      const agent = new Agent({
        name: this.config.provider,
        model: modelInstance,
        instructions: prompt,
        tools: mastraTools,
      });

      // Call Mastra Agent generate method
      const result = await agent.generate(prompt);

      // Transform Mastra response to CrewX AIResponse
      return this.convertResponse(result, taskId);
    } catch (error: any) {
      return {
        content: '',
        provider: this.name,
        command: `${this.name} query`,
        success: false,
        error: error.message || 'Unknown error',
        taskId,
      };
    }
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
    // API Provider has no query/execute distinction
    return this.query(prompt, options);
  }

  /**
   * Convert Mastra response to CrewX AIResponse
   *
   * Transforms Mastra Agent's response format to CrewX's unified format.
   *
   * @param mastraResult - Mastra agent response
   * @param taskId - Task identifier
   * @returns CrewX AIResponse
   */
  private convertResponse(mastraResult: any, taskId: string): AIResponse {
    // Extract text content from Mastra response
    const content = mastraResult.text || '';

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
    if (mastraResult.toolCalls && mastraResult.toolCalls.length > 0) {
      const toolCall = mastraResult.toolCalls[0]; // First tool call
      response.toolCall = {
        toolName: toolCall.name,
        toolInput: toolCall.input,
        toolResult: toolCall.result,
      };
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
