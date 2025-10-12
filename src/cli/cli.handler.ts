import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CliOptions } from '../cli-options';
import { StderrLogger } from '../stderr.logger';

const logger = new Logger('CLIHandler');

/**
 * Main CLI handler that routes commands to appropriate handlers
 */
export class CLIHandler {
  async handleCommand(app: any, args: CliOptions) {
    try {
      switch (args.command) {
        case 'query':
        case 'q':  // Shorthand for query
          const { handleQuery } = await import('./query.handler');
          await handleQuery(app, args);
          break;
        
        case 'execute':
        case 'x':  // Shorthand for execute
          const { handleExecute } = await import('./execute.handler');
          await handleExecute(app, args);
          break;
        
        case 'doctor':
          const { handleDoctor } = await import('./doctor.handler');
          await handleDoctor(app, args);
          break;
        
        case 'init':
          const { handleInit } = await import('./init.handler');
          await handleInit(app, args);
          break;

        case 'templates':
          const { handleTemplates } = await import('./templates.handler');
          await handleTemplates(app, args);
          break;

        case 'chat':
          const { handleChat } = await import('./chat.handler');
          await handleChat(app, args);
          break;

        case 'mcp':
          const { handleMcp } = await import('./mcp.handler');
          await handleMcp(app, args);
          break;

        case 'help':
          const { handleHelp } = await import('./help.handler');
          await handleHelp(app);
          break;

        default:
          logger.error(`Unknown command: ${args.command}`);
          console.log('Run \'crewcode help\' for a list of commands.');
          process.exit(1);
      }

      await app.close();
      process.exit(0);
    } catch (error) {
      console.error('Error in handleCommand:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`CLI command failed: ${errorMessage}`);
      if (app) {
        await app.close();
      }
      process.exit(1);
    }
  }
}