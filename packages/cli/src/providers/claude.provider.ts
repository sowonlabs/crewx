import { Injectable } from '@nestjs/common';
import { ClaudeProvider as SdkClaudeProvider } from '@sowonai/crewx-sdk';
import { ToolCallService } from '../services/tool-call.service';
import { CREWX_VERSION } from '../version';
import { createLoggerAdapter } from './logger.adapter';

@Injectable()
export class ClaudeProvider extends SdkClaudeProvider {
  constructor(toolCallService?: ToolCallService) {
    super({
      logger: createLoggerAdapter('ClaudeProvider'),
      toolCallHandler: toolCallService,
      crewxVersion: CREWX_VERSION,
    });
  }
}
