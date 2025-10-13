import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { McpAdapterModule } from '@sowonai/nestjs-mcp-adapter';
import { AIService } from './ai.service';
import { ProjectService } from './project.service';
import { CrewXTool } from './crewx.tool';
import { McpController } from './mcp.controller';
import { CliOptions } from './cli-options';
import { SERVER_NAME } from './constants';
import { AIProviderService } from './ai-provider.service';
import { ClaudeProvider } from './providers/claude.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CodexProvider } from './providers/codex.provider';
import { DynamicProviderFactory } from './providers/dynamic-provider.factory';
import { ParallelProcessingService } from './services/parallel-processing.service';
import { TaskManagementService } from './services/task-management.service';
import { ResultFormatterService } from './services/result-formatter.service';
import { ToolCallService } from './services/tool-call.service';
import { AgentLoaderService } from './services/agent-loader.service';
import { TemplateService } from './services/template.service';
import { DocumentLoaderService } from './services/document-loader.service';
import { InitHandler } from './cli/init.handler';
import { DoctorHandler } from './cli/doctor.handler';
import { HelpService } from './services/help.service';
import { ConfigService } from './services/config.service';
import { ContextEnhancementService } from './services/context-enhancement.service';
import { IntelligentCompressionService } from './services/intelligent-compression.service';
import { ConfigValidatorService } from './services/config-validator.service';
import { ConversationProviderFactory } from './conversation';
import { AuthService } from './services/auth.service';
import { BearerAuthGuard } from './guards/bearer-auth.guard';
import { HealthController } from './health.controller';
import { McpClientService } from './services/mcp-client.service';
import { RemoteAgentService } from './services/remote-agent.service';

@Module({})
export class AppModule {
  static forRoot(options: CliOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DiscoveryModule,
        McpAdapterModule.forRoot({
          servers: {
            [SERVER_NAME]: {
              version: '0.1.0',
              instructions: 'CrewX server: AI-powered code analysis and project exploration tools.',
            },
          }
        }),
      ],
      providers: [
        {
          provide: 'CLI_OPTIONS',
          useValue: options,
        },
        AIService,
        ProjectService,
        CrewXTool,
        AIProviderService,
        ClaudeProvider,
        CopilotProvider,
        GeminiProvider,
        CodexProvider,
        DynamicProviderFactory,
        ParallelProcessingService,
        TaskManagementService,
        ResultFormatterService,
        TemplateService,
        DocumentLoaderService,
        ConfigValidatorService,
        // Enhanced Context Services
        ContextEnhancementService,
        IntelligentCompressionService,
        // Conversation System
        ConversationProviderFactory,
        // Tool System
        ToolCallService,
        AgentLoaderService,
        McpClientService,
        RemoteAgentService,
        AuthService,
        BearerAuthGuard,
        // CLI Handlers
        InitHandler,
        DoctorHandler,
        HelpService,
        ConfigService,
      ],
      controllers: [McpController, HealthController],
      exports: [AIService, ProjectService, CrewXTool, AIProviderService],
    };
  }
}
