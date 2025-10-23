# WBS-9 Phase 2 Migration Guide

## Overview
- Base AI provider and built-in providers (Claude, Gemini, Copilot, Codex) now live in the SDK under `packages/sdk/src/core/providers/`.
- CLI packages keep thin Nest wrappers that adapt CrewX logging, version metadata, and tool execution services.
- SDK exports shared provider configuration types (`AIProviderConfig`, `LoggerLike`, `ToolCallHandler`) so external consumers can compose providers without Nest dependencies.

## Key Changes
- `BaseAIProvider` constructor accepts `AIProviderConfig` with optional logger, tool handler, timeout config, log directory, and CrewX version string.
- Built-in providers receive the same `AIProviderConfig` object; tool support is activated when `toolCallHandler` is supplied.
- CLI `ToolCallService` implements `ToolCallHandler` and continues to own concrete tool registrations.
- SDK public surface (`packages/sdk/src/index.ts`) exports all providers and helper types via `@sowonai/crewx-sdk`.

## Upgrade Steps
1. **Update Imports**
   ```ts
   import {
     BaseAIProvider,
     ClaudeProvider,
     type AIProviderConfig,
   } from '@sowonai/crewx-sdk';
   ```
2. **Create Logger Adapter (if needed)**
   ```ts
   import { Logger } from '@nestjs/common';
   import { createLoggerAdapter } from './providers/logger.adapter';

   const config: AIProviderConfig = {
     logger: createLoggerAdapter('ClaudeProvider'),
     toolCallHandler,
     crewxVersion: CREWX_VERSION,
   };
   ```
3. **Instantiate Provider**
   ```ts
   const provider = new ClaudeProvider(config);
   ```
4. **Provide Tool Handler** – supply an object that exposes `list()` and `execute()` (e.g., CLI `ToolCallService`).
5. **Update Dynamic Providers** – continue extending `BaseAIProvider`; no Nest imports required.

## Extending BaseAIProvider
```ts
import { BaseAIProvider, type AIProviderConfig } from '@sowonai/crewx-sdk';

export class MyProvider extends BaseAIProvider {
  readonly name = 'plugin/my-provider';

  constructor(config: AIProviderConfig) {
    super('MyProvider', config);
  }

  protected getCliCommand(): string {
    return 'my-provider-cli';
  }

  protected getDefaultArgs(): string[] {
    return ['--mode=json'];
  }

  protected getExecuteArgs(): string[] {
    return ['--mode=json', '--execute'];
  }

  protected getNotInstalledMessage(): string {
    return 'Install my-provider-cli from https://example.com/downloads';
  }
}
```

## Testing Checklist
- `npm run test --workspace @sowonai/crewx-sdk`
- `npm run test --workspace @sowonai/crewx-cli`
- `npm run build --workspace @sowonai/crewx-sdk`
- `npm run build --workspace @sowonai/crewx-cli`

## Backwards Compatibility
- CLI commands and configuration remain unchanged.
- Tool calling requires explicitly wiring `toolCallHandler`; providers degrade gracefully to plain query/execute without it.
- Structured payload format is unchanged; Base provider still normalises piped context and history.
