import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TaskManagementService } from '../services/task-management.service';
import { ResultFormatterService } from '../services/result-formatter.service';
import { TemplateService } from '../services/template.service';

export interface InitOptions {
  config?: string;
  workingDirectory?: string;
  force?: boolean;
  template?: string; // 'default', 'minimal', 'development', 'production'
  templateVersion?: string;  // Template version (default: 'main')
}

@Injectable()
export class InitHandler {
  constructor(
    private readonly taskManagementService: TaskManagementService,
    private readonly resultFormatterService: ResultFormatterService,
    private readonly templateService: TemplateService,
  ) {}

  async handle(options: InitOptions = {}): Promise<{ success: boolean; message: string; taskId: string }> {
    const taskId = this.taskManagementService.createTask({
      type: 'init',
      command: 'crewx init',
      options: options
    });

    try {
      this.taskManagementService.addTaskLog(taskId, { 
        level: 'info', 
        message: 'Starting CrewX project initialization' 
      });

      const workingDir = options.workingDirectory || process.cwd();
      const configPath = options.config || 'crewx.yaml';
      const fullConfigPath = join(workingDir, configPath);
      const templateName = options.template || 'default';
      const templateVersion = options.templateVersion || 'main';

      // Check if config file already exists
      if (existsSync(fullConfigPath) && !options.force) {
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'warn', 
          message: `Configuration file already exists: ${fullConfigPath}` 
        });
        
        const message = `⚠️  CrewX configuration already exists at ${configPath}\n\nUse --force to overwrite existing configuration.`;
        
        this.taskManagementService.completeTask(taskId, { message }, false);
        return { success: false, message, taskId };
      }

      // Create .crewx/logs directory
      const logDir = join(workingDir, '.crewx', 'logs');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'info', 
          message: `Created logs directory: ${logDir}` 
        });
      }

      // Create .crewx/templates directory and copy default template
      const templatesDir = join(workingDir, '.crewx', 'templates');
      if (!existsSync(templatesDir)) {
        mkdirSync(templatesDir, { recursive: true });
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'info', 
          message: `Created templates directory: ${templatesDir}` 
        });
        
        // Copy default conversation template
        try {
          const { readFileSync, writeFileSync } = require('fs');
          const templateSource = join(__dirname, '..', '..', 'documents', 'templates', 'conversation-history-default.hbs');
          const templateDest = join(templatesDir, 'conversation-history-default.hbs');
          
          if (existsSync(templateSource)) {
            const content = readFileSync(templateSource, 'utf8');
            writeFileSync(templateDest, content);
            this.taskManagementService.addTaskLog(taskId, { 
              level: 'info', 
              message: `Copied default conversation template` 
            });
          }
        } catch (error) {
          // Not critical, will use fallback inline template
          this.taskManagementService.addTaskLog(taskId, { 
            level: 'warn', 
            message: `Could not copy default template (will use fallback): ${error instanceof Error ? error.message : String(error)}` 
          });
        }
      }

      // Try to download template from GitHub
      let configContent: string;
      try {
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'info', 
          message: `Downloading template '${templateName}' from GitHub (${templateVersion})...` 
        });
        
        configContent = await this.templateService.downloadTemplate(templateName, templateVersion);
        
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'info', 
          message: `✅ Successfully downloaded template from GitHub` 
        });
      } catch (downloadError: any) {
        // Fallback to local default template
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'warn', 
          message: `Failed to download template: ${downloadError?.message || downloadError}` 
        });
        this.taskManagementService.addTaskLog(taskId, { 
          level: 'info', 
          message: 'Using local default template as fallback...' 
        });
        
        configContent = this.generateDefaultAgentsConfig(workingDir);
      }

      // Write configuration file
      writeFileSync(fullConfigPath, configContent, 'utf8');

      this.taskManagementService.addTaskLog(taskId, {
        level: 'info',
        message: `Created configuration file: ${fullConfigPath}`
      });

      const successMessage = this.formatSuccessMessage(configPath, workingDir, templateName);
      
      this.taskManagementService.completeTask(taskId, { message: successMessage }, true);
      return { success: true, message: successMessage, taskId };

    } catch (error) {
      const errorMessage = `Failed to initialize CrewX project: ${error instanceof Error ? error.message : String(error)}`;
      this.taskManagementService.addTaskLog(taskId, { 
        level: 'error', 
        message: errorMessage 
      });
      
      this.taskManagementService.completeTask(taskId, { error: errorMessage }, false);
      return { success: false, message: errorMessage, taskId };
    }
  }

  private generateDefaultAgentsConfig(workingDir: string): string {
    return `# CrewX Agents Configuration
# Generated by 'crewx init'

agents:
  # CrewX Assistant - Your guide to using CrewX
  - id: "crewx"
    name: "CrewX Assistant"
    role: "assistant"
    team: "CrewX"
    working_directory: "./"
    options:
      query:
        - "--add-dir=."
    inline:
      type: "agent"
      provider: "claude"  # Will fallback to gemini → copilot if claude is unavailable
      system_prompt: |
        You are the CrewX Assistant, designed to help users with:

        1. **Getting Started with CrewX**:
           - Explain how to use crewx CLI commands (query, execute, init, doctor)
           - Guide users through agent configuration in crewx.yaml
           - Help with model selection using @agent:model syntax

        2. **Agent Configuration**:
           - Assist with creating custom agents in crewx.yaml
           - Explain inline configuration (provider, model, system_prompt)
           - Help configure options for query and execute modes
        
        3. **Troubleshooting**:
           - Diagnose CLI tool availability issues
           - Explain error messages and suggest solutions
           - Guide users through authentication setup for claude/gemini/copilot
        
        4. **Best Practices**:
           - Recommend which models to use for different tasks
           - Suggest parallel vs sequential execution strategies
           - Advise on cost-effective model selection
        
        Always be helpful, concise, and provide practical examples.
        Focus on CrewX-specific guidance and tool usage.

  # Built-in AI Assistants (Ready to use)
  - id: "claude"
    name: "Claude AI"
    role: "AI Assistant"
    team: "AI Team"
    working_directory: "./"
    inline:
      type: "agent"
      provider: "claude"
      system_prompt: |
        Claude AI assistant for general tasks, code analysis, and writing assistance.
        
        Specialties: General AI, Code Analysis, Writing, Problem Solving
        Capabilities: general_assistance, code_analysis, writing

  - id: "gemini"
    name: "Gemini AI"
    role: "AI Assistant"
    team: "AI Team"
    working_directory: "./"
    inline:
      type: "agent"
      provider: "gemini"
      system_prompt: |
        Google Gemini AI assistant for analysis, development, and problem-solving.
        
        Specialties: Code Analysis, Architecture Design, Performance Optimization
        Capabilities: code_analysis, architecture_design, optimization

  - id: "copilot"
    name: "GitHub Copilot"
    role: "AI Assistant"
    team: "AI Team"
    working_directory: "./"
    inline:
      type: "agent"
      provider: "copilot"
      system_prompt: |
        GitHub Copilot AI assistant for code development and engineering tasks.
        
        Specialties: Code Development, Best Practices, Testing
        Capabilities: code_development, testing, best_practices

  # Custom Project Agents (Example configurations)
  # Uncomment and customize the sections below for your project needs
  
  # - id: "backend_developer"
  #   name: "Backend Developer"
  #   role: "developer"
  #   team: "Development Team"
  #   working_directory: "${workingDir}"
  #   options:
  #     - "--allowedTools=Edit,Bash,Computer"
  #     - "--add-dir=."
  #   inline:
  #     type: "agent"
  #     provider: "claude"
  #     system_prompt: |
  #       You are a senior backend developer specializing in server-side development.
  #       Focus on API design, database architecture, and system performance.
  #       
  #       Your expertise includes:
  #       - RESTful API development
  #       - Database design and optimization
  #       - Server architecture and scalability
  #       - Security best practices

  # - id: "frontend_developer"
  #   name: "Frontend Developer"
  #   role: "developer"
  #   team: "Development Team"
  #   working_directory: "${workingDir}"
  #   options:
  #     - "--allow-tool=terminal"
  #     - "--allow-tool=files"
  #     - "--add-dir=."
  #   inline:
  #     type: "agent"
  #     provider: "copilot"
  #     system_prompt: |
  #       You are a senior frontend developer specializing in user interface development.
  #       Focus on user experience, responsive design, and modern frontend frameworks.
  #       
  #       Your expertise includes:
  #       - React, Vue, Angular development
  #       - CSS/SCSS and responsive design
  #       - JavaScript/TypeScript best practices
  #       - Performance optimization

  # - id: "devops_engineer"
  #   name: "DevOps Engineer"
  #   role: "engineer"
  #   team: "Infrastructure Team"
  #   working_directory: "${workingDir}"
  #   inline:
  #     type: "agent"
  #     provider: "gemini"
  #     system_prompt: |
  #       You are a DevOps engineer specializing in infrastructure and deployment.
  #       Focus on automation, monitoring, and system reliability.
  #       
  #       Your expertise includes:
  #       - CI/CD pipeline design
  #       - Container orchestration (Docker, Kubernetes)
  #       - Cloud infrastructure (AWS, GCP, Azure)
  #       - Monitoring and logging systems

# Usage Examples:
# crewx query "@claude analyze this codebase"
# crewx query "@claude @gemini @copilot review security practices"
# crewx execute "@backend_developer create user authentication API"
# crewx execute "@frontend_developer @backend_developer implement OAuth flow"
`;
  }

  private formatSuccessMessage(configPath: string, workingDir: string, templateName?: string): string {
    const templateInfo = templateName && templateName !== 'default' 
      ? `\n**Template Used:** \`${templateName}\`` 
      : '';

    return `🎉 **CrewX Project Initialized Successfully!**

**Configuration File Created:** \`${configPath}\`
**Working Directory:** \`${workingDir}\`
**Logs Directory:** \`.crewx/logs\`${templateInfo}

**Available Agents:**
• \`@claude\` - Claude AI Assistant (General purpose)
• \`@gemini\` - Gemini AI Assistant (Analysis & Architecture)  
• \`@copilot\` - GitHub Copilot (Code Development)

**Next Steps:**
1. **Test your setup:**
   \`crewx doctor\`

2. **Try a simple query:**
   \`crewx query "@claude hello world"\`

3. **Customize your agents:**
   Edit \`${configPath}\` to add project-specific agents

4. **Learn more:**
   \`crewx --help\`

**Pro Tips:**
• Use multiple agents for different perspectives: \`crewx query "@claude @gemini analyze this code"\`
• Add custom agents in \`${configPath}\` for specialized tasks
• Check agent status anytime with \`crewx doctor\`

Happy coding with CrewX! 🚀`;
  }
}

// Legacy function for backward compatibility
import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';

const logger = new Logger('InitHandler');

/**
 * Handle init command: crewx init
 * Creates default crewx.yaml configuration and initializes project
 */
export async function handleInit(app: any, args: CliOptions) {
  logger.log('Init command received');

  try {
    // Get InitHandler from app context
    const initHandler = app.get(InitHandler);
    
    console.log('🚀 Initializing CrewX project...');
    
    // Use new InitHandler
    const result = await initHandler.handle({
      config: args.config,
      workingDirectory: process.cwd(),
      force: args.force || false,
      template: args.template || 'default',
      templateVersion: args.templateVersion || 'main',
    });
    
    // Output result
    console.log(result.message);
    
    if (!result.success) {
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`Init failed: ${error instanceof Error ? error.message : error}`);
    
    // Basic fallback message
    console.log('❌ Failed to initialize CrewX project');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    console.log('   Try running with --force or check file permissions');
    
    process.exit(1);
  }
}