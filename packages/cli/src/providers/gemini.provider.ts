import { Injectable } from '@nestjs/common';
import { GeminiProvider as SdkGeminiProvider } from '@sowonai/crewx-sdk';
import { ToolCallService } from '../services/tool-call.service';
import { CREWX_VERSION } from '../version';
import { createLoggerAdapter } from './logger.adapter';

@Injectable()
export class GeminiProvider extends SdkGeminiProvider {
  constructor(toolCallService?: ToolCallService) {
    super({
      logger: createLoggerAdapter('GeminiProvider'),
      toolCallHandler: toolCallService,
      crewxVersion: CREWX_VERSION,
    });
  }
}
