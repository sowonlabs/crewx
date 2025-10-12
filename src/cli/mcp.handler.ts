import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { ToolCallService } from '../services/tool-call.service';
import { getErrorMessage } from '../utils/error-utils';

const logger = new Logger('McpCliHandler');

export async function handleMcp(app: any, args: CliOptions) {
  const subcommand = args.mcpSubcommand;

  switch (subcommand) {
    case 'call_tool':
      await handleCallTool(app, args);
      break;
    default:
      throw new Error(`Unknown MCP subcommand: ${subcommand}`);
  }
}

async function handleCallTool(app: any, args: CliOptions) {
  const toolName = args.mcpToolName;
  if (!toolName) {
    throw new Error('Missing tool name. Usage: crewx mcp call_tool <toolName> [jsonInput]');
  }

  const rawInput = args.mcpToolInput;
  let parsedInput: Record<string, any> = {};

  if (rawInput && rawInput.trim().length > 0) {
    try {
      parsedInput = JSON.parse(rawInput);
    } catch (error) {
      logger.warn(`Failed to parse tool input JSON: ${getErrorMessage(error)}. Using empty object.`);
    }
  }

  const toolCallService = app.get(ToolCallService);

  try {
    const result = await toolCallService.execute(toolName, parsedInput);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    throw new Error(`Tool execution failed: ${getErrorMessage(error)}`);
  }
}
