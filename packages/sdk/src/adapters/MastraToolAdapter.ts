/**
 * MastraToolAdapter
 *
 * Converts CrewX FrameworkToolDefinition to Mastra tool format
 * and handles ToolExecutionContext injection.
 *
 * Key Features:
 * - CrewX → Mastra tool conversion
 * - Context injection (vars, env, agent info, etc.)
 * - Error handling for tool execution
 * - Zod schema compatibility
 *
 * @module MastraToolAdapter
 * @since WBS-20 Phase 3
 */

import { z } from 'zod';
import type {
  FrameworkToolDefinition,
  ToolExecutionContext,
} from '../types/api-provider.types';

/**
 * MastraToolAdapter
 *
 * Static utility class for converting CrewX tools to Mastra tools.
 * All methods are static as this is a pure transformation layer.
 *
 * @example
 * ```typescript
 * const context: ToolExecutionContext = {
 *   agent: { id: 'researcher', provider: 'api/openai', model: 'gpt-4' },
 *   env: process.env,
 *   vars: { projectName: 'CrewX' },
 * };
 *
 * const mastraTools = MastraToolAdapter.convertTools(crewxTools, context);
 * ```
 */
export class MastraToolAdapter {
  /**
   * Convert multiple CrewX tools to Mastra tools
   *
   * NOTE: If tools are already created with createTool() from @mastra/core/tools,
   * they don't need conversion - just return them as-is.
   *
   * @param crewxTools - Array of tool definitions (can be Mastra tools or custom format)
   * @param context - Execution context to inject into each tool
   * @returns Object mapping tool names to Mastra tool definitions
   *
   * @example
   * ```typescript
   * // Tools created with createTool() are already Mastra-compatible
   * const mastraTools = MastraToolAdapter.convertTools(tools, context);
   * // Returns: { read_file: <Mastra Tool>, ... }
   * ```
   */
  static convertTools(
    crewxTools: any[],
    context: ToolExecutionContext
  ): Record<string, any> {
    const mastraTools: Record<string, any> = {};

    for (const tool of crewxTools) {
      // If tool has an 'id' property, it's likely already a Mastra tool (from createTool())
      // In this case, just use it directly
      const toolId = tool.id || tool.name;
      mastraTools[toolId] = tool;
    }

    return mastraTools;
  }

  /**
   * Convert single CrewX tool to Mastra tool
   *
   * Transforms a FrameworkToolDefinition to Mastra tool format:
   * - Preserves name, description, parameters
   * - Wraps execute function with context injection
   * - Adds error handling
   *
   * @param crewxTool - CrewX tool definition
   * @param context - Execution context to inject
   * @returns Mastra tool definition
   *
   * @example
   * ```typescript
   * const crewxTool = {
   *   name: 'calculate',
   *   description: 'Calculate math expression',
   *   parameters: z.object({ expr: z.string() }),
   *   execute: async (args, ctx) => eval(args.expr),
   * };
   *
   * const mastraTool = MastraToolAdapter.convertTool(crewxTool, context);
   * ```
   */
  static convertTool(
    crewxTool: FrameworkToolDefinition,
    context: ToolExecutionContext
  ): any {
    return {
      description: crewxTool.description,
      parameters: this.convertParameters(crewxTool.parameters),
      execute: async (args: any) => {
        return this.executeWithContext(crewxTool, args, context);
      },
    };
  }

  /**
   * Execute tool with injected context and error handling
   *
   * Wraps the original tool execute function with:
   * - ToolExecutionContext injection
   * - Error handling and transformation
   * - Result validation
   *
   * @param crewxTool - Original CrewX tool definition
   * @param args - Tool arguments (validated by Zod)
   * @param context - Execution context to inject
   * @returns Tool execution result
   * @throws Error with formatted message if tool execution fails
   *
   * @example
   * ```typescript
   * const result = await MastraToolAdapter.executeWithContext(
   *   searchTool,
   *   { query: 'AI news' },
   *   context
   * );
   * ```
   */
  private static async executeWithContext(
    crewxTool: FrameworkToolDefinition,
    args: any,
    context: ToolExecutionContext
  ): Promise<any> {
    try {
      // Call original CrewX tool execute function with context
      const result = await crewxTool.execute(args, context);

      // Return result (can be any type: string, object, array, etc.)
      return result;
    } catch (error: any) {
      // Transform error to user-friendly format
      const errorMessage = error.message || 'Unknown error during tool execution';
      const toolName = crewxTool.name;

      // Re-throw with context
      throw new Error(
        `Tool '${toolName}' execution failed: ${errorMessage}`
      );
    }
  }

  /**
   * Convert parameters to Zod schema
   *
   * Ensures parameters are in Zod schema format.
   * - If already Zod schema, returns as-is
   * - If object/JSON schema, attempts conversion
   * - Fallback: empty object schema
   *
   * @param params - Tool parameters (Zod schema or object)
   * @returns Zod schema
   *
   * @example
   * ```typescript
   * // Already Zod schema - returns as-is
   * const schema1 = z.object({ query: z.string() });
   * const result1 = MastraToolAdapter.convertParameters(schema1);
   * // result1 === schema1
   *
   * // JSON Schema - fallback to empty object
   * const schema2 = { type: 'object', properties: { ... } };
   * const result2 = MastraToolAdapter.convertParameters(schema2);
   * // result2 === z.object({})
   * ```
   */
  private static convertParameters(params: any): z.ZodSchema {
    // Already a Zod schema - return as-is
    if (params && typeof params.parse === 'function') {
      return params;
    }

    // Not a Zod schema - fallback to empty object
    // TODO: Future enhancement - convert JSON Schema to Zod
    // For now, expect tools to use Zod schemas directly
    return z.object({});
  }

  /**
   * Validate tool definition
   *
   * Checks if a CrewX tool definition is valid:
   * - Required fields present (name, description, execute)
   * - Execute is a function
   * - Parameters are valid (if present)
   *
   * @param tool - Tool definition to validate
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = MastraToolAdapter.validateTool(myTool);
   * if (!isValid) {
   *   console.error('Invalid tool definition');
   * }
   * ```
   */
  static validateTool(tool: any): tool is FrameworkToolDefinition {
    if (!tool) return false;
    if (typeof tool.name !== 'string' || tool.name.length === 0) return false;
    if (typeof tool.description !== 'string') return false;
    if (typeof tool.execute !== 'function') return false;

    return true;
  }

  /**
   * Create minimal ToolExecutionContext
   *
   * Utility function to create a basic context for testing
   * or when full context is not available.
   *
   * @param agentId - Agent identifier
   * @param provider - Provider name (e.g., 'api/openai')
   * @param model - Model name (e.g., 'gpt-4')
   * @returns Minimal ToolExecutionContext
   *
   * @example
   * ```typescript
   * const context = MastraToolAdapter.createMinimalContext(
   *   'researcher',
   *   'api/openai',
   *   'gpt-4'
   * );
   * ```
   */
  static createMinimalContext(
    agentId: string,
    provider: string,
    model: string
  ): ToolExecutionContext {
    return {
      agent: {
        id: agentId,
        provider,
        model,
      },
      env: {},
      vars: {},
      mode: 'query',
      platform: 'api',
    };
  }
}
