
import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse, BuiltInProviders } from './ai-provider.interface';
import { ToolCallService, Tool } from '../services/tool-call.service';

@Injectable()
export class CopilotProvider extends BaseAIProvider {
  readonly name = BuiltInProviders.COPILOT;

  constructor(toolCallService?: ToolCallService) {
    super('CopilotProvider');
    if (toolCallService) {
      this.setToolCallService(toolCallService);
    }
  }

  protected getCliCommand(): string {
    return 'copilot';
  }

  protected getDefaultArgs(): string[] {
    return []; // -p is added automatically by getPromptInArgs()
  }

  protected getExecuteArgs(): string[] {
    // Set basic execution mode only. All security options are controlled in agents.yaml
    // -p is added automatically by getPromptInArgs()
    return [];
  }

  protected getPromptInArgs(): boolean {
    // Use stdin for prompts to avoid Windows command line length limits
    return false;
  }

  protected getNotInstalledMessage(): string {
    return 'GitHub Copilot CLI is not installed. Please refer to https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli to install it.';
  }

  /**
   * Override execute to use tool call support
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    if (this.toolCallService) {
      this.logger.log('CopilotProvider: Using queryWithTools in execute mode');
      return this.queryWithTools(prompt, options);
    }
    this.logger.warn('CopilotProvider: ToolCallService not available, falling back to base execute');
    return super.execute(prompt, options);
  }

  /**
   * Parse Copilot CLI error messages (e.g., quota, auth, network)
   */
  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // Use combinedOutput for quota and auth checks (these can appear in stdout or stderr)
    const combinedOutput = stderr || stdout;

    if (combinedOutput.includes('quota') && combinedOutput.includes('exceed')) {
      return {
        error: true,
        message:
          'Copilot quota exceeded. Please check your plan at https://github.com/features/copilot/plans or try again later.',
      };
    }
    if (combinedOutput.includes('quota_exceeded')) {
      return {
        error: true,
        message:
          'Copilot quota exceeded. Please check your plan at https://github.com/features/copilot/plans.',
      };
    }
    if (
      combinedOutput.toLowerCase().includes('auth') ||
      combinedOutput.toLowerCase().includes('login')
    ) {
      return {
        error: true,
        message:
          'Copilot CLI authentication is required. Please authenticate using the `copilot login` command.',
      };
    }
    // CLI option errors (check stderr first)
    if (stderr && (stderr.toLowerCase().includes('unknown option') ||
                   stderr.toLowerCase().includes('invalid option'))) {
      return {
        error: true,
        message: stderr.split('\n')[0]?.trim() || 'Invalid CLI option',
      };
    }

    // Network error check: ONLY check stderr, NOT stdout
    // stdout contains the AI response which may legitimately mention "network" or "connection"
    if (
      stderr && (stderr.toLowerCase().includes('network') ||
      stderr.toLowerCase().includes('connection'))
    ) {
      return {
        error: true,
        message: 'Network connection error. Please check your internet connection and try again.',
      };
    }

    // If there is only stderr without stdout, consider it a fatal error
    if (stderr && !stdout) {
      return { error: true, message: stderr };
    }

    return { error: false, message: '' };
  }

  /**
   * Build a prompt that includes tool definitions for Copilot
   */
  private buildPromptWithTools(prompt: string, tools: Tool[]): string {
    if (!tools || tools.length === 0) {
      return prompt;
    }

    // Temporarily disable explicit tool instructions (call_tool support under evaluation)
    return prompt;
  }

  /**
   * Build a follow-up prompt with tool execution result
   */
  private buildFollowUpPrompt(toolName: string, toolInput: any, toolResult: any): string {
    return `Tool execution result:
Tool: ${toolName}
Input: ${JSON.stringify(toolInput)}
Result: ${JSON.stringify(toolResult)}

Please continue with your response based on this tool result.`;
  }

  /**
   * Parse Copilot's response to detect tool usage
   */
  /**
   * Parse Copilot's response to detect tool usage
   * Overrides base implementation to handle Copilot-specific formats
   */
  protected parseToolUse(content: string): { isToolUse: boolean; toolName?: string; toolInput?: any } {
    // First, try to extract from CrewX XML tags
    const xmlMatch = content.match(/<crew(?:code|x)_tool_call>\s*([\s\S]*?)\s*<\/crew(?:code|x)_tool_call>/);
    if (xmlMatch && xmlMatch[1]) {
      try {
        const jsonContent = xmlMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
          this.logger.log(`Tool use detected: ${parsed.name} with input ${JSON.stringify(parsed.input)}`);
          return {
            isToolUse: true,
            toolName: parsed.name,
            toolInput: parsed.input,
          };
        }
      } catch (e) {
        // Failed to parse XML content
      }
    }
    
    try {
      // Second, try to parse the entire content as JSON
      const parsed = JSON.parse(content);

      // Check if it's a tool_use response
      if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
        return {
          isToolUse: true,
          toolName: parsed.name,
          toolInput: parsed.input,
        };
      }

      // Check for content array format
      if (parsed.content && Array.isArray(parsed.content)) {
        const toolUse = parsed.content.find((c: any) => c.type === 'tool_use');
        if (toolUse) {
          return {
            isToolUse: true,
            toolName: toolUse.name,
            toolInput: toolUse.input,
          };
        }
      }
    } catch (error) {
      // Not pure JSON, try to extract JSON from markdown/text
      // First, try to extract from markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          const jsonContent = codeBlockMatch[1].trim();
          const parsed = JSON.parse(jsonContent);
          if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
            this.logger.log(`Tool use detected: ${parsed.name} with input ${JSON.stringify(parsed.input)}`);
            return {
              isToolUse: true,
              toolName: parsed.name,
              toolInput: parsed.input,
            };
          }
        } catch (e) {
          // Failed to parse code block
        }
      }
      
      // Fallback: Look for JSON objects in the content
      // First, clean up bullet points and whitespace from the beginning of each line
      const cleanedContent = content
        .split('\n')
        .map(line => line.replace(/^[●\-\*\s]+/, ''))
        .join('\n');

      // Find the starting position of the JSON object
      const startMatch = cleanedContent.match(/\{\s*"type"\s*:\s*"tool_use"/);
      if (startMatch && startMatch.index !== undefined) {
        // Starting from that position, count braces to find the complete JSON
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let jsonStr = '';

        for (let i = startMatch.index; i < cleanedContent.length; i++) {
          const char = cleanedContent[i];
          jsonStr += char;

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                // Found complete JSON object
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
                    this.logger.log(`Tool use detected: ${parsed.name} with input ${JSON.stringify(parsed.input)}`);
                    return {
                      isToolUse: true,
                      toolName: parsed.name,
                      toolInput: parsed.input,
                    };
                  }
                } catch (e) {
                  this.logger.warn(`Failed to parse extracted JSON: ${e}`);
                }
                break;
              }
            }
          }
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
      return this.query(prompt, options);
    }

    let turn = 0;
    let currentPrompt = prompt;
    const tools = this.toolCallService.list();

    // Add tools to the initial prompt
    currentPrompt = this.buildPromptWithTools(currentPrompt, tools);

    while (turn < maxTurns) {
      this.logger.log(`Tool call turn ${turn + 1}/${maxTurns}`);

      // Execute query
      const response = await this.query(currentPrompt, options);

      if (!response.success) {
        return response;
      }

      // Check if response contains tool use
      const toolUse = this.parseToolUse(response.content);

      if (!toolUse.isToolUse) {
        // No tool use detected, return the response
        this.logger.log('No tool use detected, returning response');
        return response;
      }

      // Execute the tool
      this.logger.log(`Executing tool: ${toolUse.toolName}`);

      try {
        const toolResult = await this.toolCallService.execute(
          toolUse.toolName!,
          toolUse.toolInput!
        );

        // Build follow-up prompt with tool result
        currentPrompt = this.buildFollowUpPrompt(
          toolUse.toolName!,
          toolUse.toolInput!,
          toolResult
        );

        turn++;
      } catch (error: any) {
        this.logger.error(`Tool execution failed: ${error.message}`);

        // Return error response
        return {
          content: '',
          provider: this.name,
          command: response.command,
          success: false,
          error: `Tool execution failed: ${error.message}`,
          taskId: response.taskId,
        };
      }
    }

    // Max turns exceeded
    this.logger.error(`Max tool call turns (${maxTurns}) exceeded`);
    return {
      content: '',
      provider: this.name,
      command: `${this.getCliCommand()} (max turns exceeded)`,
      success: false,
      error: `Maximum tool call iterations (${maxTurns}) exceeded`,
      taskId: options.taskId,
    };
  }
}
