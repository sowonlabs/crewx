import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpTool } from '@sowonai/nestjs-mcp-adapter';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIService } from './ai.service';
import { AIProviderService } from './ai-provider.service';
import { ProjectService } from './project.service';
import { PREFIX_TOOL_NAME, SERVER_NAME } from './constants';
import { AgentInfo } from './agent.types';
import { getErrorMessage, getErrorStack } from './utils/error-utils';
import { ParallelProcessingService } from './services/parallel-processing.service';
import { TaskManagementService } from './services/task-management.service';
import { ResultFormatterService } from './services/result-formatter.service';
import { TemplateService } from './services/template.service';
import { DocumentLoaderService } from './services/document-loader.service';
import { ToolCallService } from './services/tool-call.service';
import { AgentLoaderService } from './services/agent-loader.service';
import { RemoteAgentService } from './services/remote-agent.service';
import type { TemplateContext } from './utils/template-processor';

@Injectable()
export class CrewXTool implements OnModuleInit {
  private readonly logger = new Logger(CrewXTool.name);

  /**
   * Generate a random security key for prompt injection protection
   * @returns Random 16-character hexadecimal string
   */
  private generateSecurityKey(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Build tools context for template processing
   * @returns Tools context object with list, json, and count
   */
  private buildToolsContext(): TemplateContext['tools'] {
    const tools = this.toolCallService.list();

    if (!tools || tools.length === 0) {
      return undefined;
    }

    return {
      list: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
        output_schema: t.output_schema,
      })),
      json: JSON.stringify(tools, null, 2),
      count: tools.length,
    };
  }

  constructor(
    private readonly aiService: AIService,
    private readonly aiProviderService: AIProviderService,
    private readonly projectService: ProjectService,
    private readonly parallelProcessingService: ParallelProcessingService,
    private readonly taskManagementService: TaskManagementService,
    private readonly resultFormatterService: ResultFormatterService,
    private readonly templateService: TemplateService,
    private readonly documentLoaderService: DocumentLoaderService,
    private readonly toolCallService: ToolCallService,
    private readonly agentLoaderService: AgentLoaderService,
    private readonly remoteAgentService: RemoteAgentService,
  ) {}

  /**
   * NestJS lifecycle hook - called after module initialization
   * This is the right place to register MCP tools to avoid circular dependency issues
   */
  onModuleInit() {
    this.toolCallService.setCrewXTool(this);
    this.logger.log('CrewXTool registered to ToolCallService');
  }


  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}getTaskLogs`,
    description: 'Get task logs by task ID to monitor progress and detailed execution logs.',
    input: {
      taskId: z.string().optional().describe('Task ID to get logs for. If not provided, returns all recent tasks.')
    },
    annotations: {
      title: 'Get Task Logs',
      readOnlyHint: true,
      desctructiveHint: false
    }
  })
  async getTaskLogs(input: { taskId?: string }) {
    this.logger.log('=== getTaskLogs called ===');
    this.logger.log(`Input taskId: ${input.taskId}`);
    
    try {
      const logsContent = this.taskManagementService.getTaskLogsFromFile(input.taskId);
      
      return {
        content: [{ type: 'text', text: logsContent }],
        isError: false
      };
    } catch (error: any) {
      this.logger.error('Error reading logs:', error);
      return {
        content: [{ type: 'text', text: `Error reading logs: ${error.message}` }],
        isError: true
      };
    }
  }

  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}checkAIProviders`,
    description: 'Check the status of available AI CLI tools (Claude, Gemini, GitHub Copilot).',
    input: {},
    annotations: {
      title: 'Check AI Providers Status',
      readOnlyHint: true,
      desctructiveHint: false
    }
  })
  async checkAIProviders() {
    this.logger.log('Checking AI provider availability');
    
    try {
      const availableProviders = await this.aiService.checkAvailableProviders();
      const installation = await this.aiService.validateCLIInstallation();
      const recommendations = this.getInstallationRecommendations(installation);

      // Compose MCP response text
      const responseText = `🤖 **AI Providers Status**

**Available Providers:**
${availableProviders.length > 0 ? availableProviders.map(p => `✅ ${p}`).join('\n') : '❌ No providers available'}

**Installation Status:**
• Claude CLI: ${installation.claude ? '✅ Installed' : '❌ Not Installed'}
• Gemini CLI: ${installation.gemini ? '✅ Installed' : '❌ Not Installed'}  
• Copilot CLI: ${installation.copilot ? '✅ Installed' : '❌ Not Installed'}

**Recommendations:**
${recommendations.map(r => `• ${r}`).join('\n')}`;

      return {
        content: [
          { 
            type: 'text', 
            text: responseText
          }
        ],
        success: true,
        availableProviders,
        installation: {
          claude: installation.claude,
          gemini: installation.gemini,
          copilot: installation.copilot,
        },
        recommendations,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Provider check failed: ${errorMessage}`, getErrorStack(error));
      return {
        content: [
          { 
            type: 'text', 
            text: `❌ **AI Providers Check Failed**

**Error:** ${errorMessage}

No AI providers could be verified.`
          }
        ],
        success: false,
        error: errorMessage,
        availableProviders: [],
        installation: {
          claude: { installed: false },
          gemini: { installed: false },
          copilot: { installed: false }
        }
      };
    }
  }



  private getInstallationRecommendations(installation: { claude: boolean; gemini: boolean; copilot: boolean }): string[] {
    const recommendations: string[] = [];
    
    if (!installation.claude) {
      recommendations.push('Claude CLI installation: npm install -g @anthropic-ai/claude-code');
    }
    
    if (!installation.gemini) {
      recommendations.push('Gemini CLI installation: npm install -g @google/gemini-cli');
    }
    
    if (!installation.copilot) {
      recommendations.push('GitHub Copilot CLI installation: npm install -g @github/copilot-cli or gh extension install github/gh-copilot');
    }
    
    if (installation.claude && installation.gemini && installation.copilot) {
      recommendations.push('All AI providers are available!');
    }
    
    return recommendations;
  }

  // =================================
  // Agent-based AI interaction tools
  // =================================

  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}listAgents`,
    description: 'List available specialist AI agents that can be utilized. Each agent is specialized in a specific domain.',
    input: {},
    annotations: {
      title: 'List Available AI Agents',
      readOnlyHint: true,
      desctructiveHint: false
    }
  })
  async listAgents() {
    try {
      // Use AgentLoaderService to get all agents
      const agents = await this.agentLoaderService.getAllAgents();

      this.logger.log(`Retrieved ${agents.length} available agents`);

      // Re-read configuration file to show original YAML structure
      const agentsConfigPath = process.env.CREWX_CONFIG;
      let yamlContent = '';
      if (agentsConfigPath) {
        try {
          const { readFile } = await import('fs/promises');
          yamlContent = await readFile(agentsConfigPath, 'utf-8');
        } catch (error) {
          this.logger.warn('Could not read YAML file for display:', getErrorMessage(error));
        }
      }
      
      const responseText = `🤖 **Available AI Agents (${agents.length} total)**

**Configuration Source:** ${process.env.CREWX_CONFIG ? 'External YAML file' : 'Built-in defaults'}
${process.env.CREWX_CONFIG ? `**Config Path:** \`${process.env.CREWX_CONFIG}\`` : ''}

**Parsed Agent Summary:**
${agents.map((agent, index) => `${index + 1}. **${agent.id}**
   - Provider: ${agent.provider}
   - Working Dir: ${agent.workingDirectory}
   ${agent.name ? `- Name: ${agent.name}` : ''}
   ${agent.role ? `- Role: ${agent.role}` : ''}
   ${agent.team ? `- Team: ${agent.team}` : ''}
`).join('')}

${yamlContent ? `**Full YAML Configuration:**
\`\`\`yaml
${yamlContent}
\`\`\`

**💡 Customization Guide:**
You can customize agents by modifying the YAML file. Required fields:
- \`id\`: Unique identifier
- \`working_directory\`: Path for agent operations  
- \`inline.provider\`: AI provider (claude/gemini/copilot)
- \`inline.system_prompt\`: Agent's specialized instructions

Optional fields (like \`name\`, \`role\`, \`team\`, etc.) can be added for better organization.` : `**Default Configuration:**
No external YAML file configured. Using built-in agents.
Set \`CREWX_CONFIG\` environment variable to use custom agents.

**Example YAML Structure:**
\`\`\`yaml
agents:
  - id: "your_agent_id"
    name: "Your Agent Name"
    role: "specialist"
    working_directory: "/path/to/project"
    inline:
      type: "agent"
      provider: "claude"
      system_prompt: |
        You are a specialized AI agent for...
\`\`\``}

**Recommendations:**

**🚀 Performance Tip:** For optimal results, formulate queries in English. Testing shows English queries typically produce more detailed responses, faster processing times (20% improvement), and higher success rates compared to other languages.

**Configuration Source:** ${process.env.CREWX_CONFIG ? 'External YAML file' : 'Default hardcoded values'}`;

      return {
        content: [
          { 
            type: 'text', 
            text: responseText
          }
        ],
        success: true,
        availableAgents: agents,
        totalCount: agents.length,
        configurationSource: process.env.CREWX_CONFIG ? 'External YAML file' : 'Default hardcoded values'
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Agent listing failed:', errorMessage);
      return {
        content: [
          { 
            type: 'text', 
            text: `❌ **Error loading agents:** ${errorMessage}

**Fallback:** No agents available due to configuration error.`
          }
        ],
        success: false,
        error: errorMessage,
        availableAgents: [],
        totalCount: 0
      };
    }
  }

  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}queryAgent`,
    description: 'Query a specific specialist agent (read-only mode). You can request code analysis, explanations, reviews, etc. No file modifications will be performed.',
    input: {
      agentId: z.string().describe('Agent ID to query (e.g., frontend_developer, backend_developer, devops_engineer, security_analyst, or custom agents)'),
      query: z.string().describe('Question or request to ask the agent'),
      projectPath: z.string().describe('Absolute path of the project to analyze').optional(),
      context: z.string().describe('Additional context or background information').optional(),
      model: z.string().describe('Model to use for this query (e.g., sonnet, gemini-2.5-pro, gpt-5)').optional(),
    },
    annotations: {
      title: 'Query Specialist Agent (Read-Only)',
      readOnlyHint: true,
      desctructiveHint: false
    }
  })
  async queryAgent(args: {
    agentId: string;
    query: string;
    context?: string;
    model?: string;
    messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
    platform?: 'slack' | 'cli';
  }) {
    // Generate task ID and start tracking
    const taskId = this.taskManagementService.createTask({
      type: 'query',
      provider: 'claude', // will be determined later
      prompt: args.query,
      agentId: args.agentId
    });
    this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Started query agent ${args.agentId}` });

    try {
      const { agentId, query, context, model, messages, platform } = args;

      this.logger.log(`[${taskId}] Querying agent ${agentId}: ${query.substring(0, 50)}...`);
      this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Query: ${query.substring(0, 100)}...` });
      if (model) {
        this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Model: ${model}` });
      }

      // Dynamically load agent configuration using AgentLoaderService (includes plugin providers)
      const agents = await this.agentLoaderService.getAllAgents();
      const agent = agents.find(a => a.id === agentId);

      if (!agent) {
        return {
          content: [
            { 
              type: 'text', 
              text: `❌ **Agent Not Found**

**Error:** Agent '${agentId}' not found.

**Available Agents:** ${agents.map(a => a.id).join(', ')}

Please check the agent ID and try again.`
            }
          ],
          success: false,
          agent: agentId,
          error: `Agent '${agentId}' not found`,
          availableAgents: agents.map(a => a.id),
          readOnlyMode: true
        };
      }

      if (agent.remote?.type === 'mcp-http' || agent.provider === 'remote') {
        try {
          const remoteResult = await this.remoteAgentService.queryRemoteAgent(agent, {
            query,
            context,
            model,
          });

          const normalized = this.normalizeRemoteResult(agent, taskId, remoteResult);
          normalized.readOnlyMode = normalized.readOnlyMode ?? true;
          normalized.readOnly = normalized.readOnly ?? true;

          const logLevel = normalized.success ? 'info' : 'error';
          this.taskManagementService.addTaskLog(taskId, {
            level: logLevel,
            message: normalized.success
              ? 'Remote agent query completed successfully'
              : `Remote agent query failed: ${normalized.error || 'Unknown error'}`,
          });

          this.taskManagementService.completeTask(taskId, normalized, normalized.success !== false);
          return normalized;
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          this.taskManagementService.addTaskLog(taskId, {
            level: 'error',
            message: `Remote agent query failed: ${errorMessage}`,
          });
          this.taskManagementService.completeTask(taskId, { success: false, error: errorMessage }, false);

          return {
            content: [
              {
                type: 'text',
                text: `❌ **Remote agent error**\n\`\`\`${errorMessage}\`\`\``,
              },
            ],
            success: false,
            agent: agentId,
            provider: 'remote',
            error: errorMessage,
            taskId,
            readOnlyMode: true,
            readOnly: true,
          };
        }
      }

      // Configure agent's system prompt
      // Use current directory to avoid non-existent directory issues
      const workingDir = agent.workingDirectory || process.cwd();
      let systemPrompt = agent.systemPrompt || agent.description || `You are an expert ${agentId}.`;

      // Generate security key for this session
      const securityKey = this.generateSecurityKey();

      // Always process template if agent has a system prompt with template variables
      // This handles both document references and conversation history
      if (systemPrompt) {
        const { processDocumentTemplate } = await import('./utils/template-processor');

        // For query mode, exclude current message from conversation history
        // For execute mode, include all messages as context
        const contextMessages = messages && messages.length > 0 ? messages.slice(0, -1) : [];
        
        const templateContext: TemplateContext = {
          env: process.env,
          agent: {
            id: agent.id,
            name: agent.name || agent.id,
            provider: (Array.isArray(agent.provider) ? agent.provider[0] : agent.provider) || 'claude',
            model: model || agent.inline?.model,
            workingDirectory: workingDir,
          },
          mode: 'query',
          messages: contextMessages, // Previous conversation messages (excluding current query)
          platform: platform, // Pass platform information (slack/cli)
          tools: this.buildToolsContext(),
          vars: {
            security_key: securityKey,
          },
        };
        
        systemPrompt = await processDocumentTemplate(systemPrompt, this.documentLoaderService, templateContext);
      }

      // Add context information
      systemPrompt += `

Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Analysis'}
Working Directory: ${workingDir}`;

      // Wrap user query with security tag to prevent prompt injection
      const wrappedQuery = `
<user_query key="${securityKey}">
${query}
</user_query>`;

      // Build the full prompt with proper conversation history formatting
      let fullPrompt = systemPrompt;

      // If there's conversation context, add it (already formatted by template)
      if (context) {
        fullPrompt += `\n\n${context}`;
      }

      // Add the current query
      fullPrompt += `\n\n${wrappedQuery}`;

      // Use agent's AI provider - using queryAI wrapper
      let response;
      let provider: string;
      
      // Determine provider strategy based on agent configuration
      if (Array.isArray(agent.provider)) {
        // Provider is an array: use fallback mechanism (unless model is specified)
        if (agent.inline?.model || model) {
          // Model specified: use first provider in array as fixed provider
          provider = agent.provider[0] || 'claude';
        } else {
          // No model: use fallback through the provider array
          provider = await this.getAvailableProvider(agent.provider);
          this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Using fallback provider: ${provider}` });
        }
      } else {
        // Provider is a single string: use it as fixed provider (no fallback)
        provider = agent.provider || 'claude';
      }
      
      // Get mode-specific options for this agent (query mode) with provider context
      const agentOptions = this.getOptionsForAgent(agent, 'query', provider);
      
      // Determine model to use (priority: runtime override > inline.model)
      const modelToUse = model || agent.inline?.model;
      
      response = await this.aiService.queryAI(fullPrompt, provider, {
        workingDirectory: workingDir,
        timeout: 1200000, // 20min for all providers (bug-00000015)
        additionalArgs: agentOptions, // Pass mode-specific options
        taskId, // Pass taskId to AIService
        model: modelToUse, // Use determined model
        securityKey, // Pass security key for injection protection
      });

      // Handle task completion
      this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Query completed. Success: ${response.success}` });
      this.taskManagementService.completeTask(taskId, response, response.success);

      // Compose MCP response text (simple format for Slack)
      const responseText = response.success 
        ? response.content 
        : `❌ **Error**\n\`\`\`${response.error}\`\`\`\n\nAgent: ${agentId} (${response.provider}) · Task ID: \`${taskId}\``;

      return {
        content: [
          { 
            type: 'text', 
            text: responseText
          }
        ],
        taskId: taskId,
        success: response.success,
        agent: agentId,
        provider: response.provider,
        query: query,
        response: response.content,
        readOnlyMode: true,
        error: response.error,
        workingDirectory: workingDir
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.taskManagementService.addTaskLog(taskId, { level: 'error', message: `Query failed: ${errorMessage}` });
      this.taskManagementService.completeTask(taskId, { error: errorMessage }, false);
      
      this.logger.error(`[${taskId}] Agent query failed for ${args.agentId}:`, errorMessage);
      return {
        content: [
          { 
            type: 'text', 
            text: `❌ **Agent Query Failed**

**Task ID:** ${taskId}
**Agent:** ${args.agentId}
**Error:** ${errorMessage}
**Query:** ${args.query}

Read-Only Mode: No files were modified.`
          }
        ],
        success: false,
        agent: args.agentId,
        error: errorMessage,
        readOnlyMode: true
      };
    }
  }

  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}executeAgent`,
    description: 'Execute tasks through a specialist agent. Can provide implementation guidance, code examples, and actionable solutions.',
    input: {
      agentId: z.string().describe('Agent ID to execute (e.g., frontend_developer, backend_developer, devops_engineer, security_analyst, or custom agents)'),
      task: z.string().describe('Task or implementation request for the agent to perform'),
      projectPath: z.string().describe('Absolute path of the project to work on').optional(),
      context: z.string().describe('Additional context or background information').optional(),
      model: z.string().describe('Model to use for this execution (e.g., sonnet, gemini-2.5-pro, gpt-5)').optional(),
    },
    annotations: {
      title: 'Execute Agent Task (Can Modify Files)',
      readOnlyHint: false,
      desctructiveHint: true
    }
  })
  async executeAgent(args: {
    agentId: string;
    task: string;
    projectPath?: string;
    context?: string;
    model?: string;
    messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
    platform?: 'slack' | 'cli';
  }) {
    // Generate task ID and start tracking
    const taskId = this.taskManagementService.createTask({
      type: 'execute',
      provider: 'claude', // will be determined later
      prompt: args.task,
      agentId: args.agentId
    });
    this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Started execute agent ${args.agentId}` });

    try {
      const { agentId, task, projectPath, context, model, messages, platform } = args;

      this.logger.log(`[${taskId}] Executing agent ${agentId}: ${task.substring(0, 50)}...`);
      this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Task: ${task.substring(0, 100)}...` });
      if (model) {
        this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Model: ${model}` });
      }

      // Dynamically load agent configuration using AgentLoaderService (includes plugin providers)
      const agents = await this.agentLoaderService.getAllAgents();
      const agent = agents.find(a => a.id === agentId);

      if (!agent) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ **Agent Not Found**

**Error:** Agent '${agentId}' not found.

**Available Agents:** ${agents.map(a => a.id).join(', ')}

Please check the agent ID and try again.`
            }
          ],
          success: false,
          agent: agentId,
          error: `Agent '${agentId}' not found`,
          availableAgents: agents.map(a => a.id),
          executionMode: true
        };
      }

      if (agent.remote?.type === 'mcp-http' || agent.provider === 'remote') {
        try {
          const remoteResult = await this.remoteAgentService.executeRemoteAgent(agent, {
            task,
            context,
            model,
            platform,
            messages,
          });

          const normalized = this.normalizeRemoteResult(agent, taskId, remoteResult);
          normalized.readOnlyMode = normalized.readOnlyMode ?? false;
          normalized.readOnly = normalized.readOnly ?? false;

          const logLevel = normalized.success ? 'info' : 'error';
          this.taskManagementService.addTaskLog(taskId, {
            level: logLevel,
            message: normalized.success
              ? 'Remote agent task completed successfully'
              : `Remote agent task failed: ${normalized.error || 'Unknown error'}`,
          });

          this.taskManagementService.completeTask(taskId, normalized, normalized.success !== false);
          return normalized;
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          this.taskManagementService.addTaskLog(taskId, {
            level: 'error',
            message: `Remote agent task failed: ${errorMessage}`,
          });
          this.taskManagementService.completeTask(taskId, { success: false, error: errorMessage }, false);

          return {
            content: [
              {
                type: 'text',
                text: `❌ **Remote agent error**\n\`\`\`${errorMessage}\`\`\``,
              },
            ],
            success: false,
            agent: agentId,
            provider: 'remote',
            error: errorMessage,
            taskId,
            readOnlyMode: false,
            readOnly: false,
          };
        }
      }

      // Configure agent's system prompt
      const workingDir = projectPath || agent.workingDirectory || './';
      let systemPrompt = agent.systemPrompt || agent.description || `You are an expert ${agentId}.`;

      // Generate security key for this session
      const securityKey = this.generateSecurityKey();

      // Always process template if agent has a system prompt with template variables
      // This handles both document references and conversation history
      if (systemPrompt) {
        const { processDocumentTemplate } = await import('./utils/template-processor');

        // For execute mode, exclude current task from conversation history
        // The current task is added separately below as "Task: ${task}"
        const contextMessages = messages && messages.length > 0 ? messages.slice(0, -1) : [];

        const templateContext: TemplateContext = {
          env: process.env,
          agent: {
            id: agent.id,
            name: agent.name || agent.id,
            provider: (Array.isArray(agent.provider) ? agent.provider[0] : agent.provider) || 'claude',
            model: model || agent.inline?.model,
            workingDirectory: workingDir,
          },
          mode: 'execute',
          messages: contextMessages, // Previous conversation messages (excluding current task)
          platform: platform, // Pass platform information (slack/cli)
          tools: this.buildToolsContext(),
          vars: {
            security_key: securityKey,
          },
        };

        systemPrompt = await processDocumentTemplate(systemPrompt, this.documentLoaderService, templateContext);
      }

      // Add context information
      systemPrompt += `
Specialties: ${agent.specialties?.join(', ') || 'General'}
Capabilities: ${agent.capabilities?.join(', ') || 'Implementation'}
Working Directory: ${workingDir}`;

      // Build full prompt (context already formatted by template)
      const fullPrompt = context 
        ? `${systemPrompt}
${context}

Task: ${task}
`
        : `${systemPrompt}

Task: ${task}
`;

      // Use agent's AI provider (execution mode)
      let response;
      let provider: string;
      
      // Determine provider strategy based on agent configuration
      if (Array.isArray(agent.provider)) {
        // Provider is an array: use fallback mechanism (unless model is specified)
        if (agent.inline?.model || model) {
          // Model specified: use first provider in array as fixed provider
          provider = agent.provider[0] || 'claude';
        } else {
          // No model: use fallback through the provider array
          provider = await this.getAvailableProvider(agent.provider);
          this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Using fallback provider: ${provider}` });
        }
      } else {
        // Provider is a single string: use it as fixed provider (no fallback)
        provider = agent.provider || 'claude';
      }
      
      this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Using provider: ${provider}` });
      
      // Get mode-specific options for this agent (execute mode) with provider context
      const agentOptions = this.getOptionsForAgent(agent, 'execute', provider);
      
      // Determine model to use (priority: runtime override > inline.model)
      const modelToUse = model || agent.inline?.model;
      
      // Use new unified executeAI for all providers
      // Use 20 minutes timeout for all providers to handle complex multi-turn tool calls
      // (especially when nested tools like Task agent call other tools)
      response = await this.aiService.executeAI(fullPrompt, provider, {
        workingDirectory: workingDir,
        timeout: 1200000, // 20min for all providers (bug-00000015)
        taskId: taskId,
        additionalArgs: agentOptions, // Pass mode-specific options
        model: modelToUse, // Use determined model
      });

      // Handle task completion
      this.taskManagementService.addTaskLog(taskId, { level: 'info', message: `Execution completed. Success: ${response.success}` });
      this.taskManagementService.completeTask(taskId, response, response.success);

      // Compose MCP response text - Clean format for Slack
      // Only show the actual AI response content, not metadata
      const responseText = response.success ? response.content : `❌ Execution Failed: ${response.error}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ],
        success: response.success,
        // Internal metadata (not displayed in Slack, used by parallel execution)
        taskId: taskId,
        agent: agentId,
        provider: response.provider,
        implementation: response.content,
        error: response.error,
        recommendations: []
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.taskManagementService.addTaskLog(taskId, { level: 'error', message: `Execution failed: ${errorMessage}` });
      this.taskManagementService.completeTask(taskId, { error: errorMessage }, false);

      this.logger.error(`[${taskId}] Agent execution failed for ${args.agentId}:`, errorMessage);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Execution Failed: ${errorMessage}`
          }
        ],
        success: false,
        // Internal metadata (not displayed in Slack, used by parallel execution)
        taskId: taskId,
        agent: args.agentId,
        provider: 'unknown',
        implementation: null,
        error: errorMessage,
        recommendations: []
      };
    }
  }

  /**
   * Get mode-specific options for a given agent and execution mode
   */
  private normalizeRemoteResult(agent: AgentInfo, taskId: string, remoteResult: any) {
    const normalizedAgentId = remoteResult?.agent ?? agent.remote?.agentId ?? agent.id;
    const provider = remoteResult?.provider ?? 'remote';

    let content = remoteResult?.content;
    if (!Array.isArray(content) || content.length === 0) {
      let fallbackText: unknown = remoteResult?.response ?? remoteResult?.implementation ?? remoteResult?.message;
      if (fallbackText === undefined) {
        fallbackText = remoteResult ? JSON.stringify(remoteResult, null, 2) : 'Remote agent returned no content.';
      }

      if (typeof fallbackText !== 'string') {
        fallbackText = JSON.stringify(fallbackText, null, 2);
      }

      content = [
        {
          type: 'text',
          text: fallbackText as string,
        },
      ];
    }

    return {
      ...remoteResult,
      content,
      agent: normalizedAgentId,
      provider,
      taskId: remoteResult?.taskId ?? taskId,
      success: remoteResult?.success !== false,
    };
  }

  private getOptionsForAgent(agent: AgentInfo, mode: 'query' | 'execute', provider?: string): string[] {
    try {
      // Handle new structure: agent.options.query / agent.options.execute
      if (agent.options && typeof agent.options === 'object' && !Array.isArray(agent.options)) {
        const modeOptions = (agent.options as any)[mode];
        
        // If modeOptions is an object with provider-specific options
        if (modeOptions && typeof modeOptions === 'object' && !Array.isArray(modeOptions)) {
          // Try to get provider-specific options first
          if (provider && modeOptions[provider]) {
            return modeOptions[provider];
          }
          // Fall back to 'default' key if exists
          if (modeOptions['default']) {
            return modeOptions['default'];
          }
          // If no provider match, return empty (avoid using wrong provider options)
          return [];
        }
        
        // If modeOptions is an array (backward compatibility)
        return modeOptions || [];
      }
      
      // Handle legacy structure: agent.options array (for backward compatibility)
      if (agent.options && Array.isArray(agent.options)) {
        return agent.options;
      }
      
      return [];
    } catch (error) {
      this.logger.warn(`Failed to get options for agent ${agent.id}: ${error}`);
      return [];
    }
  }


  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}queryAgentParallel`,
    description: 'Query multiple specialist agents simultaneously in parallel (read-only mode). Efficiently send multiple tasks to the same agent or different questions to various agents.',
    input: {
      queries: z.array(z.object({
        agentId: z.string().describe('Agent ID to query (e.g., frontend_developer, backend_developer, gmail_mcp_developer, etc.)'),
        query: z.string().describe('Question or request to ask the agent'),
        projectPath: z.string().describe('Absolute path of the project to analyze').optional(),
        context: z.string().describe('Additional context or background information').optional(),
      })).describe('Array of queries to process in parallel'),
    },
    annotations: {
      title: 'Query Multiple Agents in Parallel (Read-Only)',
      readOnlyHint: true,
      desctructiveHint: false
    }
  })
  async queryAgentParallel(args: {
    queries: Array<{
      agentId: string;
      query: string;
      projectPath?: string;
      context?: string;
      model?: string;
      messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
      platform?: 'slack' | 'cli';
    }>;
  }) {
    try {
      const { queries } = args;
      
      this.logger.log(`Starting parallel agent queries (${queries.length} queries)`);
      
      if (!queries || queries.length === 0) {
        return {
          content: [
            { 
              type: 'text', 
              text: `❌ **No Queries Provided**

Please provide at least one query in the queries array.

**Example:**
\`\`\`json
{
  "queries": [
    {
      "agentId": "gmail_mcp_developer",
      "query": "Analyze the README"
    },
    {
      "agentId": "frontend_developer", 
      "query": "Explain the component structure"
    }
  ]
}
\`\`\``
            }
          ],
          success: false,
          error: 'No queries provided',
          results: []
        };
      }

      // Log each query
      queries.forEach((q, index) => {
        this.logger.log(`Query ${index + 1}: ${q.agentId} -> "${q.query.substring(0, 50)}..."`);
      });

      // Execute queries in parallel using Promise.all to preserve template processing
      const startTime = Date.now();
      const queryPromises = queries.map(async (q, index) => {
        const queryStart = Date.now();
        try {
          const result = await this.queryAgent({
            agentId: q.agentId,
            query: q.query,
            context: q.context,
            model: q.model,
            messages: q.messages,
            platform: q.platform
          });
          const duration = Date.now() - queryStart;
          return {
            index: index + 1,
            agentId: q.agentId,
            query: q.query,
            success: result.success !== false,
            response: result.response || result.content?.[0]?.text,
            provider: result.provider,
            duration,
            taskId: result.taskId
          };
        } catch (error: any) {
          const duration = Date.now() - queryStart;
          return {
            index: index + 1,
            agentId: q.agentId,
            query: q.query,
            success: false,
            error: error.message,
            duration
          };
        }
      });

      const results = await Promise.all(queryPromises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      const summary = {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        totalDuration,
        averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
      };

      this.logger.log(`Parallel queries completed: ${successCount} success, ${failureCount} failed, ${totalDuration}ms total`);

      // Results are already in the correct format
      const enhancedResults = results;

      // Format response using ResultFormatterService
      const formattedResult = this.resultFormatterService.formatParallelResult(
        enhancedResults, 
        {
          total: summary.total,
          success: summary.successful,
          failed: summary.failed,
          totalDuration: summary.totalDuration,
          averageDuration: summary.averageDuration,
          fastest: Math.min(...results.map(r => r.duration)),
          slowest: Math.max(...results.map(r => r.duration)),
          timeSaved: Math.max(0, results.reduce((sum, r) => sum + r.duration, 0) - summary.totalDuration)
        },
        true // readOnly mode
      );

      return {
        content: [
          { 
            type: 'text', 
            text: formattedResult.mcp
          }
        ],
        success: true,
        summary: {
          totalQueries: summary.total,
          successful: summary.successful,
          failed: summary.failed,
          totalDuration: summary.totalDuration,
          averageDuration: summary.averageDuration
        },
        results: enhancedResults,
        performance: {
          fastestQuery: Math.min(...results.map(r => r.duration)),
          slowestQuery: Math.max(...results.map(r => r.duration)),
          timeSaved: Math.max(0, results.reduce((sum, r) => sum + r.duration, 0) - summary.totalDuration)
        },
        readOnlyMode: true
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Parallel agent queries failed:', errorMessage);
      return {
        content: [
          { 
            type: 'text', 
            text: `❌ **Parallel Agent Queries Failed**

**Error:** ${errorMessage}

**Total Queries:** ${args.queries?.length || 0}

Read-Only Mode: No files were modified.`
          }
        ],
        success: false,
        error: errorMessage,
        results: [],
        readOnlyMode: true
      };
    }
  }

  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}executeAgentParallel`,
    description: 'Execute multiple tasks through specialist agents simultaneously in parallel (execution mode). Efficiently distribute implementation work across multiple agents.',
    input: {
      tasks: z.array(z.object({
        agentId: z.string().describe('Agent ID to execute (e.g., frontend_developer, backend_developer, crewcode_developer_claude, etc.)'),
        task: z.string().describe('Task or implementation request for the agent to perform'),
        projectPath: z.string().describe('Absolute path of the project to work on').optional(),
        context: z.string().describe('Additional context or background information').optional(),
      })).describe('Array of tasks to execute in parallel'),
    },
    annotations: {
      title: 'Execute Multiple Agent Tasks in Parallel (Can Modify Files)',
      readOnlyHint: false,
      desctructiveHint: true
    }
  })
  async executeAgentParallel(args: {
    tasks: Array<{
      agentId: string;
      task: string;
      projectPath?: string;
      context?: string;
    }>;
  }) {
    try {
      const { tasks } = args;
      
      this.logger.log(`Starting parallel agent execution (${tasks.length} tasks)`);
      
      if (!tasks || tasks.length === 0) {
        return {
          content: [
            { 
              type: 'text', 
              text: `❌ **No Tasks Provided**

Please provide at least one task in the tasks array.

**Example:**
\`\`\`json
{
  "tasks": [
    {
      "agentId": "crewcode_developer_claude",
      "task": "Create a utility function for handling timeouts"
    },
    {
      "agentId": "crewcode_developer_gemini", 
      "task": "Write unit tests for the new utility function"
    }
  ]
}
\`\`\``
            }
          ],
          success: false,
          error: 'No tasks provided',
          results: []
        };
      }

      // Log each task
      tasks.forEach((t, index) => {
        this.logger.log(`Task ${index + 1}: ${t.agentId} -> "${t.task.substring(0, 50)}..."`);
      });

      const startTime = Date.now();

      // Use Promise.all for parallel processing
      const results = await Promise.all(
        tasks.map(async (taskItem, index) => {
          const taskStartTime = Date.now();
          
          try {
            // Reuse existing executeAgent method
            const result = await this.executeAgent({
              agentId: taskItem.agentId,
              task: taskItem.task,
              projectPath: taskItem.projectPath,
              context: taskItem.context,
            });

            const taskDuration = Date.now() - taskStartTime;
            
            return {
              index: index + 1,
              agentId: taskItem.agentId,
              task: taskItem.task,
              success: result.success,
              implementation: result.implementation || result.error,
              provider: result.provider,
              duration: taskDuration,
              error: result.error,
              context: taskItem.context,
              workingDirectory: taskItem.projectPath || `Default for ${taskItem.agentId}`,
              recommendations: result.recommendations || [],
              taskId: result.taskId
            };
          } catch (error: any) {
            const taskDuration = Date.now() - taskStartTime;
            
            return {
              index: index + 1,
              agentId: taskItem.agentId,
              task: taskItem.task,
              success: false,
              implementation: null,
              provider: 'unknown',
              duration: taskDuration,
              error: error.message || 'Unknown error occurred',
              context: taskItem.context,
              workingDirectory: taskItem.projectPath || `Default for ${taskItem.agentId}`,
              recommendations: [],
              taskId: null
            };
          }
        })
      );

      const totalDuration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Parallel execution completed: ${successCount} success, ${failureCount} failed, ${totalDuration}ms total`);

      // Compose MCP response text
      const responseText = `⚡ **Parallel Agent Execution Results**

**Summary:**
- Total Tasks: ${results.length}
- Successful: ${successCount}
- Failed: ${failureCount}
- Total Duration: ${totalDuration}ms
- Average Duration: ${Math.round(totalDuration / results.length)}ms per task

**Individual Results:**

${results.map(result => `---
**${result.index}. Agent: ${result.agentId}** (${result.provider}) - ${result.duration}ms
**Task:** ${result.task}
**Status:** ${result.success ? '✅ Success' : '❌ Failed'}
**Working Directory:** ${result.workingDirectory}
${result.context ? `**Context:** ${result.context}\n` : ''}
**Implementation:**
${result.success ? result.implementation : `Error: ${result.error}`}

${result.recommendations.length > 0 ? `**Recommendations:**
${result.recommendations.map(r => `• ${r}`).join('\n')}` : ''}
`).join('\n')}

**Performance Insights:**
- Fastest Task: ${Math.min(...results.map(r => r.duration))}ms
- Slowest Task: ${Math.max(...results.map(r => r.duration))}ms
- Parallel processing saved approximately ${Math.max(0, results.reduce((sum, r) => sum + r.duration, 0) - totalDuration)}ms compared to sequential execution

**⚠️ Important Notes:**
- All tasks were executed in IMPLEMENTATION MODE with potential file modifications
- Review all provided implementations before applying changes
- Test in development environment first
- Consider backing up files before making modifications`;

      return {
        content: [
          { 
            type: 'text', 
            text: responseText
          }
        ],
        success: true,
        summary: {
          totalTasks: results.length,
          successful: successCount,
          failed: failureCount,
          totalDuration,
          averageDuration: Math.round(totalDuration / results.length)
        },
        results: results,
        performance: {
          fastestTask: Math.min(...results.map(r => r.duration)),
          slowestTask: Math.max(...results.map(r => r.duration)),
          timeSaved: Math.max(0, results.reduce((sum, r) => sum + r.duration, 0) - totalDuration)
        },
        executionMode: true
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Parallel agent execution failed:', errorMessage);
      return {
        content: [
          { 
            type: 'text', 
            text: `❌ **Parallel Agent Execution Failed**

**Error:** ${errorMessage}

**Total Tasks:** ${args.tasks?.length || 0}

Execution Mode: Implementation guidance could not be provided.`
          }
        ],
        success: false,
        error: errorMessage,
        results: [],
        executionMode: true
      };
    }
  }

  /**
   * Clear all logs from the .crewx/logs directory
   */
  @McpTool({
    server: SERVER_NAME,
    name: `${PREFIX_TOOL_NAME}clearAllLogs`,
    description: 'Clear all log files from the .crewx/logs directory to clean up accumulated task logs',
    input: {},
    annotations: {
      title: 'Clear All Logs',
      readOnlyHint: false,
    }
  })
  async clearAllLogs() {
    try {
      const logsDir = path.join(process.cwd(), '.crewx', 'logs');
      
      // Check if logs directory exists
      if (!fs.existsSync(logsDir)) {
        return {
          content: [
            {
              type: 'text',
              text: `📁 **Log Directory Status**

❌ **No logs directory found**

The logs directory \`.crewx/logs\` does not exist. Nothing to clean.

**Path checked:** \`${logsDir}\`
`
            }
          ],
          success: true,
          message: 'No logs directory found',
          path: logsDir
        };
      }

      // Read all files in logs directory
      const files = fs.readdirSync(logsDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      if (logFiles.length === 0) {
        return {
          content: [
            {
              type: 'text', 
              text: `📁 **Log Directory Status**

✅ **Already clean**

The logs directory exists but contains no log files to clean.

**Directory:** \`${logsDir}\`
**Total files:** ${files.length}
**Log files:** 0
`
            }
          ],
          success: true,
          message: 'No log files to clean',
          path: logsDir,
          totalFiles: files.length,
          logFiles: 0
        };
      }

      // Calculate total size before deletion
      let totalSize = 0;
      let deletedCount = 0;
      const deletedFiles: string[] = [];

      for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          deletedFiles.push(file);
        } catch (error) {
          this.logger.warn(`Failed to delete log file ${file}:`, error);
        }
      }

      // Format file size
      const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        content: [
          {
            type: 'text',
            text: `🗑️ **Log Cleanup Complete**

✅ **Successfully cleared all log files**

**Directory:** \`${logsDir}\`
**Files deleted:** ${deletedCount}
**Total space freed:** ${formatSize(totalSize)}

${deletedCount > 10 ? 
  `**Sample deleted files:**
${deletedFiles.slice(0, 10).map(f => `  • ${f}`).join('\n')}
  • ... and ${deletedCount - 10} more files` :
  `**Deleted files:**
${deletedFiles.map(f => `  • ${f}`).join('\n')}`
}

The logs directory is now clean and ready for new task logs. 🧹✨
`
          }
        ],
        success: true,
        message: 'All log files cleared successfully',
        path: logsDir,
        deletedCount,
        totalSize,
        deletedFiles: deletedFiles.slice(0, 20) // Limit to first 20 for response size
      };

    } catch (error: any) {
      this.logger.error('Failed to clear logs:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Log Cleanup Failed**

**Error:** ${error.message}

Please check permissions and try again, or manually delete files from \`.crewx/logs/\` directory.
`
          }
        ],
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available provider with fallback support
   * Tries providers in order: claude → gemini → copilot
   * Returns the first available provider
   */
  /**
   * Get available provider with fallback support
   * @param providerConfig - Single provider string or array of providers for fallback
   * @returns Available provider name
   */
  private async getAvailableProvider(
    providerConfig?: 'claude' | 'gemini' | 'copilot' | ('claude' | 'gemini' | 'copilot')[]
  ): Promise<'claude' | 'gemini' | 'copilot'> {
    // Default fallback order if no config provided
    const defaultFallbackOrder: ('claude' | 'gemini' | 'copilot')[] = ['claude', 'gemini', 'copilot'];
    
    // Determine fallback order based on input
    let fallbackOrder: ('claude' | 'gemini' | 'copilot')[];
    
    if (!providerConfig) {
      // No config: use default order
      fallbackOrder = defaultFallbackOrder;
    } else if (Array.isArray(providerConfig)) {
      // Array: use as-is for fallback order
      fallbackOrder = providerConfig;
    } else {
      // Single string: try only this provider, then fall back to default order
      fallbackOrder = [providerConfig, ...defaultFallbackOrder.filter(p => p !== providerConfig)];
    }
    
    // Try providers in order
    for (const providerName of fallbackOrder) {
      const provider = this.aiProviderService.getProvider(providerName);
      if (provider) {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          if (fallbackOrder.indexOf(providerName) > 0) {
            this.logger.log(`Using fallback provider: ${providerName} (tried: ${fallbackOrder.slice(0, fallbackOrder.indexOf(providerName)).join(', ')})`);
          }
          return providerName;
        }
      }
    }
    
    // Default to claude if none available (will show error later)
    this.logger.warn('No providers available, defaulting to claude');
    return 'claude';
  }
}