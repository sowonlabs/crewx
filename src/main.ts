import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StdioExpressAdapter } from '@sowonai/nestjs-mcp-adapter';
import { Logger } from '@nestjs/common';
import { parseCliOptions } from "./cli-options";
import { StderrLogger } from './stderr.logger';
import { SERVER_NAME } from './constants';
import { getErrorMessage, getErrorStack } from './utils/error-utils';
import { CLIHandler } from './cli/cli.handler';
import { SlackBot } from './slack/slack-bot';
import { CrewXTool } from './crewx.tool';
import { ConfigService } from './services/config.service';
import { AIProviderService } from './ai-provider.service';

const logger = new Logger('Bootstrap');
const args = parseCliOptions();

// Handle EPIPE errors globally to prevent crashes when parent process closes pipe
// This is especially important when running via npx which may close stdio early
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    // Silently ignore EPIPE errors - parent process closed the pipe
    process.exit(0);
  }
});

process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    // Silently ignore EPIPE errors - parent process closed the pipe
    process.exit(0);
  }
});

// If --help or -h is used, force the command to be 'help'
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  args.command = 'help';
}

async function cli() {
  try {
    if (args.install) {
      logger.log('Installation mode - CodeCrew MCP Server setup');
      
      const app = await NestFactory.createApplicationContext(AppModule.forRoot(args), {
        logger: args.log ? new StderrLogger('CodeCrewInstall', { timestamp: true }) : false,
      });
      
      // Output simple installation information
      console.log(`
=================================
CodeCrew MCP Server Setup
=================================

This MCP server provides AI-powered code analysis tools using Claude CLI and Gemini CLI.

Prerequisites:
- Install Claude CLI: Follow the official installation guide for claude-cli
- Install Gemini CLI: Follow the official installation guide for gemini-cli

MCP Server Configuration:
Add this to your MCP client configuration:

{
  "mcpServers": {
    "${SERVER_NAME}": {
      "command": "npx",
      "args": ["@sowonlabs/crewx"]
    }
  }
}

Available Tools:
- analyzeProject: AI-powered project analysis
- reviewCode: Code review with AI
- exploreCodebase: Codebase exploration and analysis  
- checkAIProviders: Check AI CLI tool availability

Environment Variables (optional):
- Set working directory and other preferences as needed

Setup completed successfully!
=================================
      `);
      
      await app.close();
      process.exit(0);
    }
  } catch (error) {
    logger.error(`Installation failed: ${getErrorMessage(error)}`, getErrorStack(error));
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    let app;
    let adapter: StdioExpressAdapter;

    if (args.protocol === 'HTTP') {
      app = await NestFactory.create(AppModule.forRoot(args), {
        logger: args.log ? ['error', 'warn', 'debug', 'log'] : false
      });
    } else {
      adapter = new StdioExpressAdapter('/mcp');
      app = await NestFactory.create(AppModule.forRoot(args), adapter, {
        logger: args.log ? new StderrLogger('CodeCrew', { timestamp: true }) : false,
      });
    }

    await app.init();
    if (args.protocol === 'HTTP') {
      await app.listen(args.port, args.host);
      logger.log(`MCP HTTP server listening on http://${args.host}:${args.port}/mcp`);
    } else {
      await app.listen(args.port);
    }

    process.on('uncaughtException', (err) => {
      logger.error('Unexpected error occurred:', err);
    });

    const cleanup = async () => {
      await app.close();
      if (adapter) {
        await adapter.close();
      }
    }

    process.on('SIGTERM', async () => {
      logger.log('Shutting down application...');
      await cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('Shutting down application...');
      await cleanup();
      process.exit(0);
    });
    
    if (args.protocol !== 'HTTP') {
      logger.log('Code CLI MCP Server initialized successfully');
    }
    return app;

  } catch (error) {
    logger.error(`Bootstrap failed: ${getErrorMessage(error)}`, getErrorStack(error));
    process.exit(1);
  }
}

async function runCli() {
  if (args.command) {
    // Handle CLI commands
    const app = await NestFactory.createApplicationContext(AppModule.forRoot(args), {
      logger: args.log ? new StderrLogger('CodeCrewCLI', { timestamp: true }) : false,
    });

    // Set custom config path if provided via --config
    if (args.config) {
      const configService = app.get(ConfigService);
      const aiProviderService = app.get(AIProviderService);

      configService.setConfigPath(args.config);
      configService.loadAgentConfigs();
      await aiProviderService.reloadPluginProviders();
    }

    const cliHandler = new CLIHandler();
    await cliHandler.handleCommand(app, args);
  } else {
    // Show help if no command is given
    const app = await NestFactory.createApplicationContext(AppModule.forRoot(args), {
      logger: args.log ? new StderrLogger('CodeCrewCLI', { timestamp: true }) : false,
    });

    // Set custom config path if provided via --config
    if (args.config) {
      const configService = app.get(ConfigService);
      const aiProviderService = app.get(AIProviderService);

      configService.setConfigPath(args.config);
      configService.loadAgentConfigs();
      await aiProviderService.reloadPluginProviders();
    }

    const cliHandler = new CLIHandler();
    await cliHandler.handleCommand(app, { ...args, command: 'help' });
  }
}

async function runSlackBot() {
  try {
    logger.log('Starting Slack Bot mode...');

    // ✅ EPIPE 에러 핸들러 추가 (프로세스 크래시 방지)
    process.stdout.on('error', (err: any) => {
      if (err.code === 'EPIPE') {
        logger.warn('EPIPE on stdout - ignoring (broken pipe)');
        return;
      }
      logger.error('Unexpected stdout error:', err);
    });

    process.stderr.on('error', (err: any) => {
      if (err.code === 'EPIPE') {
        logger.warn('EPIPE on stderr - ignoring (broken pipe)');
        return;
      }
      logger.error('Unexpected stderr error:', err);
    });

    // ✅ Uncaught Exception 핸들러 (EPIPE 허용)
    process.on('uncaughtException', (err: any) => {
      if (err.code === 'EPIPE') {
        logger.warn('Uncaught EPIPE exception - ignoring');
        return;
      }
      logger.error('Uncaught exception:', err);
      process.exit(1);
    });

    // Validate environment variables
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }
    if (!process.env.SLACK_APP_TOKEN) {
      throw new Error('SLACK_APP_TOKEN environment variable is required');
    }
    if (!process.env.SLACK_SIGNING_SECRET) {
      throw new Error('SLACK_SIGNING_SECRET environment variable is required');
    }

    // Create application context
    const app = await NestFactory.createApplicationContext(AppModule.forRoot(args), {
      logger: args.log ? new StderrLogger('CodeCrewSlack', { timestamp: true }) : false,
    });

    // Get CrewXTool, ConfigService, and AIProviderService from context
    const crewXTool = app.get(CrewXTool);
    const configService = app.get(ConfigService);
    const aiProviderService = app.get(AIProviderService);

    // Get default agent from CLI options (defaults to 'claude')
    const defaultAgent = args.slackAgent || 'claude';
    logger.log(`Using default agent for Slack: ${defaultAgent}`);

    // Create and start Slack Bot (validates agent exists)
    const slackBot = new SlackBot(crewXTool, configService, aiProviderService, defaultAgent);
    await slackBot.start();

    // Handle shutdown
    const cleanup = async () => {
      logger.log('Shutting down Slack Bot...');
      await slackBot.stop();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

  } catch (error) {
    logger.error(`Slack Bot failed: ${getErrorMessage(error)}`, getErrorStack(error));
    process.exit(1);
  }
}

// Main application routing logic
async function main() {
  if (args.install) {
    // Installation mode
    await cli();
  } else if (args.command === 'mcp') {
    if (!args.mcpSubcommand || args.mcpSubcommand === 'server') {
      // Explicit MCP Server mode
      if (args.log) logger.log('Starting MCP server mode...');
      await bootstrap();
    } else {
      // MCP utility commands (e.g., call_tool)
      if (args.log) logger.log(`Running MCP utility command: ${args.mcpSubcommand}`);
      await runCli();
    }
  } else if (args.command === 'slack') {
    // Slack Bot mode
    if (args.log) logger.log('Starting Slack Bot mode...');
    await runSlackBot();
  } else if (!args.command) {
    // No command specified - show help
    if (args.log) logger.log('Starting CLI mode (help)...');
    await runCli();
  } else {
    // CLI command mode
    if (args.log) logger.log('Starting CLI mode...');
    await runCli();
  }
}

// Execute main function
main().catch(err => {
  logger.error('Error during application startup:', err);
  process.exit(1);
});