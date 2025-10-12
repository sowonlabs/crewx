import { Controller, Post, Get, Body, HttpCode, UseFilters, Req, Res, Logger, Inject } from '@nestjs/common';
import { McpHandler, JsonRpcRequest, JsonRpcExceptionFilter } from '@sowonai/nestjs-mcp-adapter';
import { Request, Response } from 'express';
import { SERVER_NAME } from './constants';
import { CliOptions } from './cli-options';

@Controller('mcp')
@UseFilters(JsonRpcExceptionFilter)
export class McpController {
  private readonly logger = new Logger('McpController');

  constructor(
    private readonly mcpHandler: McpHandler,
    @Inject('CLI_OPTIONS') private readonly cliOptions: CliOptions,
  ) {}

  @Post()
  @HttpCode(202)
  async handlePost(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    this.logger.debug(`request body: ${JSON.stringify(body)}`);

    if (this.cliOptions.protocol === 'HTTP') {
      const configuredKey = this.cliOptions.apiKey ?? process.env.CREWX_MCP_KEY;
      if (configuredKey) {
        const authHeader = req.headers['authorization'];
        const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

        if (!token || !token.toLowerCase().startsWith('bearer ')) {
          this.logger.warn('Unauthorized MCP HTTP request without bearer token');
          return res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Unauthorized: missing bearer token',
            },
          });
        }

        const providedKey = token.slice('bearer '.length).trim();

        if (providedKey !== configuredKey) {
          this.logger.warn('Unauthorized MCP HTTP request with invalid bearer token');
          return res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Unauthorized: invalid bearer token',
            },
          });
        }
      }
    }
    
    // Handle prompts/list request - return empty list to prevent Gemini CLI errors
    if (body && body.method === 'prompts/list') {
      this.logger.debug('Handling prompts/list request - returning empty list');
      return res.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          prompts: []
        }
      });
    }
    
    const result = await this.mcpHandler.handleRequest(SERVER_NAME, req, res, body);

    // Empty response if it's a notification request or response is null
    if (result === null) {
      return res.end();
    }

    this.logger.debug(`response body: ${JSON.stringify(result)}`);

    // Response for general requests
    return res.json(result);
  }
}