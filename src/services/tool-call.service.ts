import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { AgentLoaderService } from './agent-loader.service';
import { DocumentManager } from '../knowledge/DocumentManager';

/**
 * Tool definition interface compatible with Mastra framework
 * Supports both input and output schema definitions
 */
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  output_schema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Enhanced execution context for tools
 * Provides runtime information similar to Mastra's ToolExecutionContext
 */
export interface ToolExecutionContext {
  input: Record<string, any>;        // Tool input parameters
  runId?: string;                     // Execution run ID for tracking
  threadId?: string;                  // Conversation thread ID
  resourceId?: string;                // Resource/user identifier
  agentId?: string;                   // Agent making the call
  tracingContext?: {                  // Tracing/logging context
    taskId?: string;
    parentSpan?: string;
  };
}

/**
 * Standardized tool execution result
 * Follows Mastra's pattern of structured responses
 */
export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    toolName?: string;
    runId?: string;
  };
}

export interface ToolExecutor {
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

@Injectable()
export class ToolCallService {
  private readonly logger = new Logger('ToolCallService');
  private tools: Map<string, { definition: Tool; executor: ToolExecutor }> = new Map();
  private crewXTool?: any; // Will be injected later to avoid circular dependency

  constructor(private readonly agentLoaderService: AgentLoaderService) {
    // Register built-in tools
    this.registerBuiltinTools();
  }

  /**
   * Set CrewXTool reference (called after module initialization to avoid circular dependency)
   */
  setCrewXTool(crewXTool: any): void {
    this.crewXTool = crewXTool;
    // Register MCP tools after CrewXTool is available
    this.registerMcpTools();
  }

  /**
   * Register built-in tools like read_file
   */
  private registerBuiltinTools(): void {
    // Hello tool - simple test tool
    this.register(
      {
        name: 'hello',
        description: 'A simple greeting tool that returns a hello message with the provided name',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name to greet',
            },
          },
          required: ['name'],
        },
        output_schema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The greeting message',
            },
          },
          required: ['message'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const { name } = context.input;
            if (!name || typeof name !== 'string') {
              return {
                success: false,
                error: 'Invalid input: name is required and must be a string',
                metadata: {
                  executionTime: Date.now() - startTime,
                  toolName: 'hello',
                  runId: context.runId,
                },
              };
            }

            const message = `Hello, ${name}! 👋 Welcome to CodeCrew tool system!`;
            return {
              success: true,
              data: { message },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'hello',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to generate greeting: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'hello',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Read file tool
    this.register(
      {
        name: 'read_file',
        description: 'Read the contents of a file from the filesystem',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the file to read',
            },
          },
          required: ['path'],
        },
        output_schema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The content of the file',
            },
          },
          required: ['content'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const { path } = context.input;
            if (!path || typeof path !== 'string') {
              return {
                success: false,
                error: 'Invalid input: path is required and must be a string',
                metadata: {
                  executionTime: Date.now() - startTime,
                  toolName: 'read_file',
                  runId: context.runId,
                },
              };
            }

            const content = readFileSync(path, 'utf-8');
            return {
              success: true,
              data: { content },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'read_file',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to read file: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'read_file',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // List agents tool - uses AgentLoaderService for consistency
    this.register(
      {
        name: 'list_agents',
        description: 'List all available AI agents in the CodeCrew system. Returns detailed information about each agent including their ID, provider, capabilities, and specialties. Use this tool to discover which agents are available for delegation or collaboration.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        output_schema: {
          type: 'object',
          properties: {
            agents: {
              type: 'array',
              description: 'List of available agents',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Agent unique identifier' },
                  name: { type: 'string', description: 'Agent display name' },
                  provider: { type: 'string', description: 'AI provider (claude/gemini/copilot)' },
                  role: { type: 'string', description: 'Agent role' },
                  team: { type: 'string', description: 'Agent team' },
                  workingDirectory: { type: 'string', description: 'Working directory path' },
                  capabilities: { type: 'array', items: { type: 'string' }, description: 'Agent capabilities' },
                  description: { type: 'string', description: 'Agent description' },
                  specialties: { type: 'array', items: { type: 'string' }, description: 'Agent specialties' },
                },
              },
            },
            totalCount: {
              type: 'number',
              description: 'Total number of available agents',
            },
          },
          required: ['agents', 'totalCount'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            console.log('Executing list_agents tool');

            // Use AgentLoaderService to get all agents
            const agents = await this.agentLoaderService.getAllAgents();
            const configSource = this.agentLoaderService.getConfigSource();

            this.logger.log(`list_agents tool returned ${agents.length} agents`);

            return {
              success: true,
              data: {
                agents: agents.map(agent => ({
                  id: agent.id,
                  name: agent.name || agent.id,
                  role: agent.role || 'AI Agent',
                  team: agent.team || 'AI Team',
                  provider: Array.isArray(agent.provider) ? agent.provider[0] : agent.provider,
                  workingDirectory: agent.workingDirectory || './',
                  capabilities: agent.capabilities || [],
                  description: agent.description || `${agent.name || agent.id} agent`,
                  specialties: agent.specialties || [],
                })),
                totalCount: agents.length,
                configurationSource: configSource.source,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'list_agents',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to list agents: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'list_agents',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Get markdown headings tool
    this.register(
      {
        name: 'get_markdown_headings',
        description: 'Extract table of contents (headings) from a markdown file. Use this tool to efficiently understand the structure of large markdown files without reading the entire content.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the markdown file',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum heading depth to include (1-6, default: 3)',
            },
          },
          required: ['path'],
        },
        output_schema: {
          type: 'object',
          properties: {
            headings: {
              type: 'array',
              description: 'Array of heading objects with depth and text',
              items: {
                type: 'object',
                properties: {
                  depth: { type: 'number', description: 'Heading depth (1-6)' },
                  text: { type: 'string', description: 'Heading text' },
                },
              },
            },
            toc: {
              type: 'string',
              description: 'Table of contents as markdown string',
            },
            fileSize: {
              type: 'number',
              description: 'File size in bytes',
            },
          },
          required: ['headings', 'toc', 'fileSize'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const { path, maxDepth = 3 } = context.input;

            if (!path || typeof path !== 'string') {
              return {
                success: false,
                error: 'Invalid input: path is required and must be a string',
                metadata: {
                  executionTime: Date.now() - startTime,
                  toolName: 'get_markdown_headings',
                  runId: context.runId,
                },
              };
            }

            // Validate maxDepth
            const depth = typeof maxDepth === 'number' ? Math.min(Math.max(maxDepth, 1), 6) : 3;

            // Read file and get stats
            const content = readFileSync(path, 'utf-8');
            const stats = statSync(path);

            // Extract TOC using DocumentManager
            const tocMarkdown = await DocumentManager.extractToc(content, depth);

            // Parse TOC into structured headings array
            const headings = tocMarkdown.split('\n').filter(line => line.trim()).map(line => {
              const match = line.match(/^(#{1,6})\s+(.+)$/);
              if (match && match[1] && match[2]) {
                return {
                  depth: match[1].length,
                  text: match[2].trim(),
                };
              }
              return null;
            }).filter((h): h is { depth: number; text: string } => h !== null);

            return {
              success: true,
              data: {
                headings,
                toc: tocMarkdown,
                fileSize: stats.size,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_markdown_headings',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to extract markdown headings: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_markdown_headings',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Get markdown sections tool
    this.register(
      {
        name: 'get_markdown_sections',
        description: 'Extract specific sections from a markdown file by heading names. Use this after get_markdown_headings to selectively read only the sections you need.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the markdown file',
            },
            headings: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of heading texts to extract sections for',
            },
          },
          required: ['path', 'headings'],
        },
        output_schema: {
          type: 'object',
          properties: {
            sections: {
              type: 'array',
              description: 'Array of extracted sections',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string', description: 'Requested heading text' },
                  content: { type: 'string', description: 'Section content' },
                  found: { type: 'boolean', description: 'Whether the section was found' },
                },
              },
            },
            totalSize: {
              type: 'number',
              description: 'Total size of extracted content in bytes',
            },
            notFound: {
              type: 'array',
              items: { type: 'string' },
              description: 'Headings that were not found',
            },
          },
          required: ['sections', 'totalSize', 'notFound'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const { path, headings } = context.input;

            if (!path || typeof path !== 'string') {
              return {
                success: false,
                error: 'Invalid input: path is required and must be a string',
                metadata: {
                  executionTime: Date.now() - startTime,
                  toolName: 'get_markdown_sections',
                  runId: context.runId,
                },
              };
            }

            if (!Array.isArray(headings) || headings.length === 0) {
              return {
                success: false,
                error: 'Invalid input: headings is required and must be a non-empty array',
                metadata: {
                  executionTime: Date.now() - startTime,
                  toolName: 'get_markdown_sections',
                  runId: context.runId,
                },
              };
            }

            // Read file content
            const content = readFileSync(path, 'utf-8');

            // Extract each requested section
            const sections: Array<{ heading: string; content: string; found: boolean }> = [];
            const notFound: string[] = [];
            let totalSize = 0;

            for (const heading of headings) {
              if (typeof heading !== 'string') {
                sections.push({
                  heading: String(heading),
                  content: '',
                  found: false,
                });
                notFound.push(String(heading));
                continue;
              }

              try {
                // Use regex to find heading and extract content until next same-level or higher-level heading
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const headingRegex = new RegExp(`^(#{1,6})\\s+${escapeRegex(heading)}\\s*$`, 'm');
                const match = content.match(headingRegex);

                if (match && match.index !== undefined && match[1]) {
                  const startIndex = match.index;
                  const headingLevel = match[1].length;

                  // Find next heading of same or higher level
                  const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, 'gm');
                  nextHeadingRegex.lastIndex = startIndex + match[0].length;
                  const nextMatch = nextHeadingRegex.exec(content);

                  const endIndex = nextMatch ? nextMatch.index : content.length;
                  const sectionContent = content.substring(startIndex, endIndex).trim();

                  sections.push({
                    heading,
                    content: sectionContent,
                    found: true,
                  });
                  totalSize += sectionContent.length;
                } else {
                  sections.push({
                    heading,
                    content: '',
                    found: false,
                  });
                  notFound.push(heading);
                }
              } catch (error) {
                sections.push({
                  heading,
                  content: '',
                  found: false,
                });
                notFound.push(heading);
              }
            }

            return {
              success: true,
              data: {
                sections,
                totalSize,
                notFound,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_markdown_sections',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to extract markdown sections: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_markdown_sections',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    this.logger.log('Built-in tools registered: hello, read_file, list_agents, get_markdown_headings, get_markdown_sections');
  }

  /**
   * Register MCP tools from CrewXTool
   */
  private registerMcpTools(): void {
    if (!this.crewXTool) {
      this.logger.warn('CrewXTool not available, skipping MCP tools registration');
      return;
    }

    // Register getTaskLogs tool
    this.register(
      {
        name: 'get_task_logs',
        description: 'Get task execution logs by task ID. Use this to monitor task progress and detailed execution logs for debugging or tracking purposes.',
        input_schema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to get logs for. If not provided, returns all recent tasks.',
            },
          },
          required: [],
        },
        output_schema: {
          type: 'object',
          properties: {
            logs: {
              type: 'string',
              description: 'Task logs content',
            },
          },
          required: ['logs'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await this.crewXTool.getTaskLogs({ taskId: context.input.taskId });
            return {
              success: result.isError !== true,
              data: {
                logs: result.content?.[0]?.text || 'No logs available',
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_task_logs',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to get task logs: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'get_task_logs',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Register checkAIProviders tool
    this.register(
      {
        name: 'check_ai_providers',
        description: 'Check the status of available AI CLI tools (Claude, Gemini, GitHub Copilot). Returns information about which providers are installed and ready to use.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
        output_schema: {
          type: 'object',
          properties: {
            availableProviders: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of available AI providers',
            },
            installation: {
              type: 'object',
              description: 'Installation status for each provider',
            },
          },
          required: ['availableProviders'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await this.crewXTool.checkAIProviders();
            return {
              success: result.success !== false,
              data: {
                availableProviders: result.availableProviders || [],
                installation: result.installation || {},
                recommendations: result.recommendations || [],
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'check_ai_providers',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to check AI providers: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'check_ai_providers',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Register queryAgent tool
    this.register(
      {
        name: 'query_agent',
        description:
          'Query a specific AI agent in read-only mode. Use this to ask questions, request code analysis, explanations, or reviews. No file modifications will be performed. This is ideal for getting expert opinions or analysis from specialized agents.',
        input_schema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description:
                'Agent ID to query (e.g., claude, gemini, copilot, or custom agents from agents.yaml). Use list_agents tool to see available agents.',
            },
            query: {
              type: 'string',
              description: 'Question or request to ask the agent',
            },
            context: {
              type: 'string',
              description: 'Additional context or background information (optional)',
            },
          },
          required: ['agentId', 'query'],
        },
        output_schema: {
          type: 'object',
          properties: {
            response: {
              type: 'string',
              description: 'Agent response to the query',
            },
            agent: {
              type: 'string',
              description: 'Agent that responded',
            },
            provider: {
              type: 'string',
              description: 'AI provider used',
            },
            taskId: {
              type: 'string',
              description: 'Task ID for tracking',
            },
          },
          required: ['response', 'agent'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await this.crewXTool.queryAgent({
              agentId: context.input.agentId,
              query: context.input.query,
              context: context.input.context,
            });

            return {
              success: result.success !== false,
              data: {
                response: result.response || result.content?.[0]?.text || 'No response',
                agent: result.agent,
                provider: result.provider,
                taskId: result.taskId,
                error: result.error,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'query_agent',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to query agent: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'query_agent',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    // Register executeAgent tool
    this.register(
      {
        name: 'execute_agent',
        description:
          'Execute tasks through a specialist agent. This allows file modifications and implementations. Use this when you need an agent to perform actual work like code generation, file editing, or system changes. Be cautious as this can modify files.',
        input_schema: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description:
                'Agent ID to execute (e.g., claude, gemini, copilot, or custom agents). Use list_agents to see available agents.',
            },
            task: {
              type: 'string',
              description: 'Task or implementation request for the agent to perform',
            },
            context: {
              type: 'string',
              description: 'Additional context or background information (optional)',
            },
          },
          required: ['agentId', 'task'],
        },
        output_schema: {
          type: 'object',
          properties: {
            implementation: {
              type: 'string',
              description: 'Implementation result or guidance',
            },
            agent: {
              type: 'string',
              description: 'Agent that executed the task',
            },
            provider: {
              type: 'string',
              description: 'AI provider used',
            },
            taskId: {
              type: 'string',
              description: 'Task ID for tracking',
            },
          },
          required: ['implementation', 'agent'],
        },
      },
      {
        execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
          const startTime = Date.now();
          try {
            const result = await this.crewXTool.executeAgent({
              agentId: context.input.agentId,
              task: context.input.task,
              context: context.input.context,
            });

            return {
              success: result.success !== false,
              data: {
                implementation: result.implementation || result.content?.[0]?.text || 'No implementation',
                agent: result.agent,
                provider: result.provider,
                taskId: result.taskId,
                error: result.error,
                recommendations: result.recommendations,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'execute_agent',
                runId: context.runId,
              },
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to execute agent: ${error.message}`,
              metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'execute_agent',
                runId: context.runId,
              },
            };
          }
        },
      }
    );

    this.logger.log('MCP tools registered: get_task_logs, check_ai_providers, query_agent, execute_agent');
  }

  /**
   * Register a new tool
   */
  register(definition: Tool, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
    this.logger.log(`Tool registered: ${definition.name}`);
  }

  /**
   * Get list of all available tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Execute a tool by name with enhanced context
   * @param name Tool name
   * @param input Tool input parameters
   * @param context Optional execution context (runId, threadId, etc.)
   */
  async execute(
    name: string,
    input: Record<string, any>,
    context?: Partial<Omit<ToolExecutionContext, 'input'>>
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      this.logger.error(`Tool not found: ${name}`);
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    const executionContext: ToolExecutionContext = {
      input,
      runId: context?.runId,
      threadId: context?.threadId,
      resourceId: context?.resourceId,
      agentId: context?.agentId,
      tracingContext: context?.tracingContext,
    };

    this.logger.log(`Executing tool: ${name} with input:`, JSON.stringify(input));

    try {
      const result = await tool.executor.execute(executionContext);
      this.logger.log(`Tool ${name} executed successfully`, {
        success: result.success,
        runId: executionContext.runId,
      });
      return result;
    } catch (error: any) {
      this.logger.error(`Tool ${name} execution failed:`, error.message);
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
        metadata: {
          toolName: name,
          runId: executionContext.runId,
        },
      };
    }
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}
