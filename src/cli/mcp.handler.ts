import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CliOptions } from '../cli-options';
import { StderrLogger } from '../stderr.logger';
import { ToolCallService, Tool } from '../services/tool-call.service';
import { ConfigService } from '../services/config.service';
import { AIProviderService } from '../ai-provider.service';

const logger = new Logger('McpCliHandler');

function parseToolParams(paramString?: string): Record<string, any> {
  if (!paramString || !paramString.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(paramString);
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('JSON root must be an object');
    }
    return parsed as Record<string, any>;
  } catch (error: any) {
    throw new Error(`Invalid JSON provided via --params: ${error.message || String(error)}`);
  }
}

async function prepareApplicationContext(args: CliOptions) {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(args), {
    logger: args.log ? new StderrLogger('CrewXMCP', { timestamp: true }) : false,
  });

  if (args.config) {
    const configService = app.get(ConfigService);
    const aiProviderService = app.get(AIProviderService);
    configService.setConfigPath(args.config);
    configService.loadAgentConfigs();
    await aiProviderService.reloadPluginProviders();
  }

  return app;
}

export async function handleMcpCallTool(args: CliOptions): Promise<number> {
  if (!args.mcpToolName) {
    console.error('❌ Missing tool name. Usage: crewx mcp call_tool "<tool_name>" --params \'{"key":"value"}\'');
    return 1;
  }

  let app: any;
  let exitCode = 0;

  try {
    const input = parseToolParams(args.mcpParams);
    app = await prepareApplicationContext(args);
    const toolCallService = app.get(ToolCallService);

    logger.log(`Invoking MCP tool '${args.mcpToolName}'`);

    const result = await toolCallService.execute(args.mcpToolName, input, {
      agentId: 'cli:mcp',
      threadId: args.thread,
    });

    if (result.success) {
      console.log(`✅ Tool '${args.mcpToolName}' executed successfully`);

      if (result.data !== undefined) {
        const output = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
        console.log(output);
      }

      if (result.metadata) {
        console.log('');
        console.log('ℹ️  Metadata:');
        console.log(JSON.stringify(result.metadata, null, 2));
      }

      exitCode = 0;
    } else {
      console.error(`❌ Tool '${args.mcpToolName}' execution failed`);
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }
      if (result.data) {
        console.error('Partial data:');
        console.error(JSON.stringify(result.data, null, 2));
      }
      exitCode = 1;
    }
  } catch (error: any) {
    console.error(`❌ Failed to execute tool '${args.mcpToolName}': ${error.message || error}`);
    exitCode = 1;
  } finally {
    if (app) {
      await app.close();
    }
  }

  return exitCode;
}

export async function handleMcpListTools(args: CliOptions): Promise<number> {
  let app: any;
  let exitCode = 0;

  try {
    app = await prepareApplicationContext(args);
    const toolCallService = app.get(ToolCallService);

    const tools = toolCallService.list();

    if (!tools || tools.length === 0) {
      console.log('ℹ️  No MCP tools are registered.');
      return exitCode;
    }

    console.log(`🔧 Registered MCP tools (${tools.length}):`);
    tools.forEach((tool: Tool) => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    exitCode = 0;
  } catch (error: any) {
    console.error(`❌ Failed to list MCP tools: ${error.message || error}`);
    exitCode = 1;
  } finally {
    if (app) {
      await app.close();
    }
  }

  return exitCode;
}
