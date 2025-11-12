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

      // DEBUG: Log tool registration
      console.log('[DEBUG] MastraAPIProvider.query - Tool registration complete');
      console.log('[DEBUG] Number of tools registered:', Object.keys(mastraTools).length);
      console.log('[DEBUG] Tool names:', Object.keys(mastraTools));

      // Call Mastra Agent generate method (returns full output directly)
      const fullOutput = await agent.generate(prompt);

      // DEBUG: Log the full output received
      console.log('[DEBUG] MastraAPIProvider.query - Full output received from generate()');
      console.log('[DEBUG] fullOutput type:', typeof fullOutput);
      console.log('[DEBUG] fullOutput keys:', Object.keys(fullOutput || {}));
      console.log('[DEBUG] fullOutput.text:', fullOutput.text);
      console.log('[DEBUG] fullOutput.text type:', typeof fullOutput.text);
      console.log('[DEBUG] fullOutput.text length:', fullOutput.text?.length);
      console.log('[DEBUG] fullOutput.toolCalls:', fullOutput.toolCalls);
      console.log('[DEBUG] fullOutput.toolResults:', fullOutput.toolResults);
      console.log('[DEBUG] Full output JSON:', JSON.stringify(fullOutput, null, 2));

      // Transform Mastra response to CrewX AIResponse
      return this.convertResponse(fullOutput, taskId);
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
   * Transforms Mastra Agent's full output format to CrewX's unified format.
   *
   * @param fullOutput - Mastra getFullOutput() result
   * @param taskId - Task identifier
   * @returns CrewX AIResponse
   */
  private convertResponse(fullOutput: any, taskId: string): AIResponse {
    // DEBUG: Log the full output structure
    console.log('[DEBUG] convertResponse - Processing fullOutput');
    console.log('[DEBUG] fullOutput type:', typeof fullOutput);
    console.log('[DEBUG] fullOutput keys:', Object.keys(fullOutput || {}));

    // Extract text content (should be directly available now)
    const content = fullOutput.text || '';

    console.log('[DEBUG] convertResponse - Extracted content:', content);
    console.log('[DEBUG] convertResponse - Content length:', content.length);

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
      console.log('[DEBUG] convertResponse - Tool calls found:', fullOutput.toolCalls.length);
      const toolCall = fullOutput.toolCalls[0]; // First tool call
      console.log('[DEBUG] convertResponse - First tool call:', JSON.stringify(toolCall, null, 2));

      // Find corresponding tool result
      const toolResult = fullOutput.toolResults?.find((r: any) => r.toolCallId === toolCall.toolCallId);

      response.toolCall = {
        toolName: toolCall.toolName,
        toolInput: toolCall.args,
        toolResult: toolResult?.result,
      };
    } else {
      console.log('[DEBUG] convertResponse - No tool calls found');
    }

    console.log('[DEBUG] convertResponse - Final response:', JSON.stringify(response, null, 2));

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
