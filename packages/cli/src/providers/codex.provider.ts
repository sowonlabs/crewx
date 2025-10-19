import { Injectable } from '@nestjs/common';
import { CodexProvider as SdkCodexProvider } from '@sowonai/crewx-sdk';
import { CREWX_VERSION } from '../version';
import { createLoggerAdapter } from './logger.adapter';

@Injectable()
export class CodexProvider extends SdkCodexProvider {
  constructor() {
    super({
      logger: createLoggerAdapter('CodexProvider'),
      crewxVersion: CREWX_VERSION,
    });
  }
}
