import { Injectable } from '@nestjs/common';
import { CopilotProvider as SdkCopilotProvider } from '@sowonai/crewx-sdk';
import { ToolCallService } from '../services/tool-call.service';
import { CREWX_VERSION } from '../version';
import { createLoggerAdapter } from './logger.adapter';

@Injectable()
export class CopilotProvider extends SdkCopilotProvider {
  constructor(toolCallService?: ToolCallService) {
    super({
      logger: createLoggerAdapter('CopilotProvider'),
      toolCallHandler: toolCallService,
      crewxVersion: CREWX_VERSION,
    });
  }
}
