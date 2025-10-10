import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse } from './ai-provider.interface';
import { ToolCallService, Tool } from '../services/tool-call.service';

@Injectable()
export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini' as const;

  constructor(toolCallService?: ToolCallService) {
    super('GeminiProvider');
    if (toolCallService) {
      this.setToolCallService(toolCallService);
    }
  }

  protected getCliCommand(): string {
    return 'gemini';
  }

  protected getDefaultArgs(): string[] {
    return []; // No output format, use default text output for XML parsing
  }

  protected getExecuteArgs(): string[] {
    // For execute mode with tool calls, use text output to parse XML tags
    // Do NOT use --yolo as we handle tools ourselves
    return [];
  }

  protected getPromptInArgs(): boolean {
    return false; // Use stdin for prompts to avoid command line length issues
  }

  protected getNotInstalledMessage(): string {
    return 'Gemini CLI is not installed.';
  }

  private buildPromptWithTools(prompt: string, tools: Tool[]): string {
    if (!tools || tools.length === 0) {
      return prompt;
    }

    const toolsSection = `

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}
  Input schema: ${JSON.stringify(t.input_schema, null, 2)}`).join('\n')}

To use a tool, wrap your JSON response in <crewcode_tool_call> tags like this:
<crewcode_tool_call>
{
  "type": "tool_use",
  "name": "tool_name",
  "input": { ...tool parameters... }
}
</crewcode_tool_call>

If you don't need to use a tool, respond normally.
`;

    return toolsSection + '\n' + prompt;
  }

  async query(
    prompt: string,
    options: AIQueryOptions = {},
  ): Promise<AIResponse> {
    if (!this.toolCallService) {
      this.logger.warn(
        'ToolCallService not available, falling back to regular query',
      );
      return super.query(prompt, options);
    }

    // Use multi-turn tool calling for query mode as well
    return this.queryWithTools(prompt, options);
  }

  /**
   * Override execute to use tool call support
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    if (this.toolCallService) {
      this.logger.log('GeminiProvider: Using queryWithTools in execute mode');
      return this.queryWithTools(prompt, options);
    }
    this.logger.warn('GeminiProvider: ToolCallService not available, falling back to base execute');
    return super.execute(prompt, options);
  }

  /**
   * Gemini-specific JSON parsing
   * Checks for XML in JSON response field
   */
  protected parseToolUseProviderSpecific(parsed: any): { isToolUse: boolean; toolName?: string; toolInput?: any } {
    // Gemini-specific: Check JSON response field
    if (parsed.response && typeof parsed.response === 'string') {
      const responseXml = parsed.response.match(/<crewcode_tool_call>\s*([\s\S]*?)\s*<\/crewcode_tool_call>/);
      if (responseXml && responseXml[1]) {
        try {
          const jsonContent = responseXml[1].trim();
          const toolParsed = JSON.parse(jsonContent);
          if (toolParsed.type === 'tool_use' && toolParsed.name && toolParsed.input !== undefined) {
            this.logger.log(`Tool use detected from Gemini JSON response field: ${toolParsed.name}`);
            return {
              isToolUse: true,
              toolName: toolParsed.name,
              toolInput: toolParsed.input,
            };
          }
        } catch (e) {
          // Failed to parse
        }
      }
    }

    return { isToolUse: false };
  }

  /**
   * Query with tool call support (multi-turn conversation)
   */
  async queryWithTools(prompt: string, options: AIQueryOptions = {}, maxTurns: number = 5): Promise<AIResponse> {
    if (!this.toolCallService) {
      this.logger.warn('ToolCallService not available, falling back to regular query');
      return super.query(prompt, options);
    }

    let turn = 0;
    let currentPrompt = prompt;
    const tools = this.toolCallService.list();

    // Add tools to the initial prompt
    currentPrompt = this.buildPromptWithTools(currentPrompt, tools);

    while (turn < maxTurns) {
      this.logger.log(`Tool call turn ${turn + 1}/${maxTurns}`);
      
      // Log to task file
      if (options.taskId) {
        this['appendTaskLog'](options.taskId, 'INFO', `--- Tool Call Turn ${turn + 1}/${maxTurns} ---`);
      }

      // Use super.query for all turns to get plain text responses
      const response = await super.query(currentPrompt, options);

      if (!response.success) {
        return response;
      }

      // Check if response contains tool use
      const toolUse = this.parseToolUse(response.content);

      if (!toolUse.isToolUse) {
        if (options.taskId) {
          this['appendTaskLog'](options.taskId, 'INFO', `No tool use detected, returning final response`);
        }
        // No tool use, return the final response
        return response;
      }

      // Execute the tool
      this.logger.log(`Executing tool: ${toolUse.toolName!} with input ${JSON.stringify(toolUse.toolInput)}`);
      
      if (options.taskId) {
        this['appendTaskLog'](options.taskId, 'INFO', `🔧 Gemini requested tool: ${toolUse.toolName}`);
        this['appendTaskLog'](options.taskId, 'INFO', `Tool input: ${JSON.stringify(toolUse.toolInput, null, 2)}`);
      }
      
      const toolResult = await this.toolCallService.execute(
        toolUse.toolName!,
        toolUse.toolInput,
      );

      this.logger.log(`Tool result: ${JSON.stringify(toolResult)}`);
      
      if (options.taskId) {
        this['appendTaskLog'](options.taskId, 'INFO', `✅ Tool executed successfully`);
        this['appendTaskLog'](options.taskId, 'INFO', `Tool result preview: ${JSON.stringify(toolResult).substring(0, 500)}...`);
      }

      // Build the next prompt with tool result
      currentPrompt = this.buildToolResultPrompt(
        toolUse.toolName!,
        toolUse.toolInput,
        toolResult,
      );

      turn++;
    }

    this.logger.warn('Max turns reached without final response');
    return {
      content: 'Maximum conversation turns reached without completing the task.',
      provider: this.name,
      command: '',
      success: false,
      taskId: options.taskId,
    };
  }

  private buildToolResultPrompt(toolName: string, toolInput: any, toolResult: any): string {
    const resultData = toolResult.success && toolResult.data ? toolResult.data : toolResult;
    
    return `The ${toolName} tool has been executed successfully.

<tool_result>
${JSON.stringify(resultData, null, 2)}
</tool_result>

Based on the tool execution result above, please provide a clear, detailed, and user-friendly response to the user's original request. Present the information in an organized and easy-to-read format.`;
  }
}
