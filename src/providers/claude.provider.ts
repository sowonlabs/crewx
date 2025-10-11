import { Injectable } from '@nestjs/common';
import { BaseAIProvider } from './base-ai.provider';
import { AIQueryOptions, AIResponse, BuiltInProviders } from './ai-provider.interface';
import { ToolCallService, Tool } from '../services/tool-call.service';

@Injectable()
export class ClaudeProvider extends BaseAIProvider {
  readonly name = BuiltInProviders.CLAUDE;

  constructor(toolCallService?: ToolCallService) {
    super('ClaudeProvider');
    if (toolCallService) {
      this.setToolCallService(toolCallService);
    }
  }

  protected getCliCommand(): string {
    return 'claude';
  }

  protected getDefaultArgs(): string[] {
    return ['--output-format', 'stream-json', '--verbose', '-p'];
  }

  protected getExecuteArgs(): string[] {
    // Set basic execution mode only. All security options are controlled in agents.yaml
    return ['--output-format', 'stream-json', '--verbose', '-p'];
  }

  protected getNotInstalledMessage(): string {
    return 'Claude CLI is not installed. Please install it from https://claude.ai/download.';
  }

  /**
   * Override execute to use tool call support
   */
  async execute(prompt: string, options: AIQueryOptions = {}): Promise<AIResponse> {
    if (this.toolCallService) {
      this.logger.log('🔧 ClaudeProvider: Using queryWithTools in execute mode');
      return this.queryWithTools(prompt, options);
    }
    this.logger.warn('⚠️ ClaudeProvider: ToolCallService not available, falling back to base execute');
    return super.execute(prompt, options);
  }

  public parseProviderError(
    stderr: string,
    stdout: string,
  ): { error: boolean; message: string } {
    // NOTE: This method is used to detect errors even when CLI tools return exit code 0.
    // Some AI CLI tools incorrectly return success exit codes even when encountering errors.
    // We check stderr first, as it's more likely to contain actual error messages.
    // Be careful not to treat normal response content as errors.
    
    const combinedOutput = stderr || stdout; // Only for session limit check

    // Check for session limit (definite error)
    if (combinedOutput.includes('Session limit reached')) {
      const resetMatch = combinedOutput.match(/resets (\d+(?::\d+)?(?:am|pm))/i);
      const resetTime = resetMatch ? resetMatch[1] : 'later today';
      return {
        error: true,
        message: `Claude Pro session limit reached. Your limit will reset at ${resetTime}. Please try again after the reset or use another AI agent (Gemini or Copilot) in the meantime.`,
      };
    }

    // Check for authentication errors
    if (stderr && (stderr.includes('authentication required') || stderr.includes('Please run `claude login`'))) {
      return {
        error: true,
        message:
          'Claude CLI authentication required. Please run `claude login` to authenticate.',
      };
    }

    // If stdout exists and has content, the command succeeded
    // stderr is just debug logs from Claude CLI (follow-redirects, spawn-rx, etc)
    if (stdout && stdout.trim().length > 0) {
      return { error: false, message: '' };
    }

    // No stdout - check if stderr contains actual error messages
    if (stderr && stderr.trim().length > 0) {
      // Pattern 1: Actual error messages (short, clear)
      const errorIndicators = [
        /^Error:/im,                    // Starts with "Error:"
        /^error:/im,                    // Starts with "error:" (lowercase)
        /^Failed:/im,                   // Starts with "Failed:"
        /^Unable to/im,                 // Starts with "Unable to"
        /unknown option/i,              // Unknown CLI option error
        /invalid option/i,              // Invalid CLI option error
        /command not found/i,           // Shell error
        /no such file/i,                // File error
        /permission denied/i,           // Permission error
        /ECONNREFUSED/,                 // Network error code
        /ETIMEDOUT/,                    // Timeout error code
        /ENOTFOUND/,                    // DNS error code
        /EHOSTUNREACH/,                 // Host unreachable
        /\bconnection refused\b/i,      // Word boundary for "connection refused"
        /\bnetwork error\b/i,           // Word boundary for "network error"
        /\brequest failed\b/i,          // Word boundary for "request failed"
      ];

      // Pattern 2: Debug logs (ignore these)
      const debugLogPatterns = [
        /follow-redirects options/,     // HTTP debug
        /spawn-rx/,                     // Process spawn debug
        /\[Function:/,                  // Function objects
        /connectionListener/,           // Function name in debug
        /maxRedirects:/,                // HTTP config
        /\{[\s\S]*protocol:.*\}/,       // JSON object with protocol
      ];

      // Check if stderr is debug logs
      const isDebugLog = debugLogPatterns.some(pattern => pattern.test(stderr));
      if (isDebugLog) {
        return { error: false, message: '' };
      }

      // Check if stderr contains actual errors
      const hasError = errorIndicators.some(pattern => pattern.test(stderr));
      if (hasError) {
        // Extract first line as error message (usually the most relevant)
        const lines = stderr.split('\n');
        const firstLine = lines[0]?.trim() || stderr.trim();
        return { error: true, message: firstLine };
      }
    }

    // No stdout and no clear error in stderr
    return { error: false, message: '' };
  }

  /**
   * Build a prompt that includes tool definitions for Claude
   */
  private buildPromptWithTools(prompt: string, tools: Tool[]): string {
    if (!tools || tools.length === 0) {
      return prompt;
    }

    const toolsSection = `

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}
  Input schema: ${JSON.stringify(t.input_schema, null, 2)}`).join('\n')}

To use a tool, respond with a JSON object in this format:
{
  "type": "tool_use",
  "name": "tool_name",
  "input": { ...tool parameters... }
}

If you don't need to use a tool, respond normally.
`;

    return toolsSection + '\n' + prompt;
  }

  /**
   * Build a follow-up prompt with tool execution result
   */
  private buildFollowUpPrompt(toolName: string, toolInput: any, toolResult: any): string {
    const resultData = toolResult.success && toolResult.data ? toolResult.data : toolResult;
    
    return `The ${toolName} tool has been executed successfully.

<tool_result>
${JSON.stringify(resultData, null, 2)}
</tool_result>

Based on the tool execution result above, please provide a clear, detailed, and user-friendly response to the user's original request. Present the information in an organized and easy-to-read format.`;
  }

  /**
   * Parse JSONL (JSON Lines) output and extract the final result text
   * Claude CLI returns multiple JSON objects separated by newlines:
   * {"type":"system",...}
   * {"type":"assistant",...}
   * {"type":"result","result":"final text"}
   */
  private parseJsonlResponse(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Try to find the last "result" type object
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line) continue;
        
        const parsed = JSON.parse(line);
        if (parsed.type === 'result' && parsed.result) {
          this.logger.log('✅ Extracted final result from JSONL');
          return parsed.result;
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }
    
    // If no result found, return the original content
    this.logger.warn('⚠️ Could not parse JSONL, returning original content');
    return content;
  }

  /**
   * Parse Claude's JSON response to detect tool usage
   * Overrides base implementation to handle Claude-specific JSONL format
   */
  protected parseToolUse(content: string): { isToolUse: boolean; toolName?: string; toolInput?: any } {
    // First, try to extract from CodeCrew XML tags in the content
    const xmlMatch = content.match(/<crewcode_tool_call>\s*([\s\S]*?)\s*<\/crewcode_tool_call>/);
    if (xmlMatch && xmlMatch[1]) {
      try {
        const jsonContent = xmlMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
          this.logger.log(`Tool use detected from XML: ${parsed.name} with input ${JSON.stringify(parsed.input)}`);
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
    
    // Try parsing as JSONL (multiple JSON objects separated by newlines)
    const lines = content.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        
        // Check for result.result containing XML tags
        if (parsed.type === 'result' && parsed.result) {
          const xmlMatch = parsed.result.match(/<crewcode_tool_call>\s*([\s\S]*?)\s*<\/crewcode_tool_call>/);
          if (xmlMatch && xmlMatch[1]) {
            const toolCallJson = JSON.parse(xmlMatch[1].trim());
            if (toolCallJson.type === 'tool_use' && toolCallJson.name && toolCallJson.input) {
              this.logger.log(`Tool use detected from result XML: ${toolCallJson.name}`);
              return {
                isToolUse: true,
                toolName: toolCallJson.name,
                toolInput: toolCallJson.input,
              };
            }
          }
        }
        
        // Check for assistant message with tool_use content
        if (parsed.type === 'assistant' && parsed.message?.content) {
          const content = parsed.message.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'text' && item.text) {
                // Check for XML-wrapped tool call
                const xmlMatch = item.text.match(/<crewcode_tool_call>\s*([\s\S]*?)\s*<\/crewcode_tool_call>/);
                if (xmlMatch && xmlMatch[1]) {
                  const toolCallJson = JSON.parse(xmlMatch[1].trim());
                  if (toolCallJson.type === 'tool_use' && toolCallJson.name && toolCallJson.input) {
                    this.logger.log(`Tool use detected from assistant message: ${toolCallJson.name}`);
                    return {
                      isToolUse: true,
                      toolName: toolCallJson.name,
                      toolInput: toolCallJson.input,
                    };
                  }
                }
                
                // Check for JSON code block (```json ... ```)
                const jsonBlockMatch = item.text.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch && jsonBlockMatch[1]) {
                  try {
                    const toolCallJson = JSON.parse(jsonBlockMatch[1].trim());
                    if (toolCallJson.type === 'tool_use' && toolCallJson.name && toolCallJson.input) {
                      this.logger.log(`Tool use detected from JSON code block: ${toolCallJson.name}`);
                      return {
                        isToolUse: true,
                        toolName: toolCallJson.name,
                        toolInput: toolCallJson.input,
                      };
                    }
                  } catch (e) {
                    // Not valid JSON in code block
                  }
                }
              }
            }
          }
        }
        
        // Check for result.result containing JSON code block
        if (parsed.type === 'result' && parsed.result) {
          const jsonBlockMatch = parsed.result.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            try {
              const toolCallJson = JSON.parse(jsonBlockMatch[1].trim());
              if (toolCallJson.type === 'tool_use' && toolCallJson.name && toolCallJson.input) {
                this.logger.log(`Tool use detected from result JSON block: ${toolCallJson.name}`);
                return {
                  isToolUse: true,
                  toolName: toolCallJson.name,
                  toolInput: toolCallJson.input,
                };
              }
            } catch (e) {
              // Not valid JSON in code block
            }
          }
        }
      } catch (e) {
        // Not valid JSON or doesn't match expected format
      }
    }
    
    // Try to find JSON object in plain text (e.g., in markdown or text response)
    // Pattern: {...} that contains "type": "tool_use"
    const jsonObjectPattern = /\{[\s\S]*?"type"\s*:\s*"tool_use"[\s\S]*?\}/g;
    const jsonMatches = content.match(jsonObjectPattern);

    if (jsonMatches) {
      for (const jsonMatch of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonMatch);
          if (parsed.type === 'tool_use' && parsed.name && parsed.input !== undefined) {
            this.logger.log(`Tool use detected from plain text JSON: ${parsed.name}`);
            return {
              isToolUse: true,
              toolName: parsed.name,
              toolInput: parsed.input,
            };
          }
        } catch (e) {
          // Not valid JSON
        }
      }
    }

    // Original parsing logic as fallback
    try {
      const parsed = JSON.parse(content);

      // Check if it's a tool_use response
      if (parsed.type === 'tool_use' && parsed.name && parsed.input) {
        return {
          isToolUse: true,
          toolName: parsed.name,
          toolInput: parsed.input,
        };
      }

      // Check for Claude API format with content array
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

      // Check for stop_reason === 'tool_use'
      if (parsed.stop_reason === 'tool_use' && parsed.content) {
        const content = Array.isArray(parsed.content) ? parsed.content : [parsed.content];
        const toolUse = content.find((c: any) => c.type === 'tool_use');
        if (toolUse) {
          return {
            isToolUse: true,
            toolName: toolUse.name,
            toolInput: toolUse.input,
          };
        }
      }
    } catch (error) {
      // Not JSON or not a tool use
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
      
      // Log to task file
      if (options.taskId) {
        this['appendTaskLog'](options.taskId, 'INFO', `--- Tool Call Turn ${turn + 1}/${maxTurns} ---`);
      }

      // Execute query
      const response = await this.query(currentPrompt, options);

      if (!response.success) {
        return response;
      }

      // Check if response contains tool use
      const toolUse = this.parseToolUse(response.content);

      this.logger.log(`Tool use check result: ${JSON.stringify(toolUse)}`);

      if (!toolUse.isToolUse) {
        // No tool use detected, return the response
        this.logger.log('No tool use detected, returning response');
        
        if (options.taskId) {
          this['appendTaskLog'](options.taskId, 'INFO', `No tool use detected, returning final response`);
        }
        
        // Parse JSONL to extract final result text
        const parsedContent = this.parseJsonlResponse(response.content);
        
        return {
          ...response,
          content: parsedContent,
        };
      }

      // Execute the tool
      this.logger.log(`Executing tool: ${toolUse.toolName}`);
      
      if (options.taskId) {
        this['appendTaskLog'](options.taskId, 'INFO', `🔧 Claude requested tool: ${toolUse.toolName}`);
        this['appendTaskLog'](options.taskId, 'INFO', `Tool input: ${JSON.stringify(toolUse.toolInput, null, 2)}`);
      }

      try {
        const toolResult = await this.toolCallService.execute(
          toolUse.toolName!,
          toolUse.toolInput!
        );

        this.logger.log(`Tool executed successfully: ${toolUse.toolName}`);
        
        if (options.taskId) {
          this['appendTaskLog'](options.taskId, 'INFO', `✅ Tool executed successfully`);
          this['appendTaskLog'](options.taskId, 'INFO', `Tool result preview: ${JSON.stringify(toolResult).substring(0, 500)}...`);
        }
        
        // Build follow-up prompt with tool result
        // AI will interpret the result and provide a human-friendly response
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