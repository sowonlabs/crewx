import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Context Enhancement Service using Claude Agent SDK features
 * Provides project context loading and intelligent conversation compression
 */
@Injectable()
export class ContextEnhancementService {
  private readonly logger = new Logger(ContextEnhancementService.name);
  private readonly projectContextCache = new Map<string, { content: string; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30초 캐시

  /**
   * Load project context from CLAUDE.md files
   */
  async loadProjectContext(workingDir: string): Promise<string> {
    // 캐시 확인
    const cacheKey = workingDir;
    const cached = this.projectContextCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Using cached project context for ${workingDir}`);
      return cached.content;
    }

    const claudeMdPaths = [
      path.join(workingDir, 'CLAUDE.md'),
      path.join(workingDir, '.claude/CLAUDE.md'),
      path.join(os.homedir(), '.claude/CLAUDE.md')
    ];

    let projectContext = '';
    
    for (const claudeMdPath of claudeMdPaths) {
      try {
        if (fs.existsSync(claudeMdPath)) {
          const content = fs.readFileSync(claudeMdPath, 'utf-8');
          projectContext += `\n# Project Context from ${path.basename(claudeMdPath)}\n${content}`;
          this.logger.debug(`Loaded project context from ${claudeMdPath}`);
          break; // 첫 번째 발견된 파일만 사용
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to read ${claudeMdPath}: ${errorMessage}`);
      }
    }

    // 캐시에 저장
    if (projectContext) {
      this.projectContextCache.set(cacheKey, {
        content: projectContext,
        timestamp: Date.now()
      });
    }

    return projectContext;
  }

  /**
   * Enhance prompt with project context
   */
  async enhancePromptWithProjectContext(
    prompt: string,
    workingDir: string,
    options?: {
      includeProjectContext?: boolean;
      maxProjectContextLength?: number;
    }
  ): Promise<string> {
    const includeProjectContext = options?.includeProjectContext ?? true;
    const maxLength = options?.maxProjectContextLength ?? 2000;

    if (!includeProjectContext) {
      return prompt;
    }

    const projectContext = await this.loadProjectContext(workingDir);
    if (!projectContext) {
      return prompt;
    }

    // 프로젝트 컨텍스트 길이 제한
    const truncatedContext = projectContext.length > maxLength
      ? projectContext.substring(0, maxLength) + '\n... (truncated)'
      : projectContext;

    return `${truncatedContext}\n\n---\n\n${prompt}`;
  }

  /**
   * Check if project context is available
   */
  async hasProjectContext(workingDir: string): Promise<boolean> {
    const claudeMdPaths = [
      path.join(workingDir, 'CLAUDE.md'),
      path.join(workingDir, '.claude/CLAUDE.md'),
      path.join(os.homedir(), '.claude/CLAUDE.md')
    ];

    return claudeMdPaths.some(filePath => fs.existsSync(filePath));
  }

  /**
   * Create a sample CLAUDE.md file for the project
   */
  async createSampleClaudeMd(workingDir: string, projectName?: string): Promise<string> {
    const claudeDir = path.join(workingDir, '.claude');
    const claudeMdPath = path.join(claudeDir, 'CLAUDE.md');

    // .claude 디렉토리 생성
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    const sampleContent = `# ${projectName || 'Project'} Context

## Project Overview
This project uses CodeCrew for multi-AI agent collaboration.

## Key Architecture Points
- NestJS-based MCP server architecture
- Multiple AI provider integration (Claude, Gemini, Copilot)
- Conversation history management with pluggable providers
- Slack and CLI interfaces

## Coding Conventions
- Use NestJS dependency injection patterns
- Follow SOLID principles
- Implement comprehensive error handling
- Write unit and integration tests

## Current Focus
Implementing enhanced context management with Claude Agent SDK integration.

## Important Files
- \`src/services/\`: Core business logic services
- \`src/providers/\`: AI provider implementations
- \`src/conversation/\`: Conversation history management
- \`agents.yaml\`: Agent configuration

## Development Notes
- Use TypeScript strict mode
- Follow the existing provider pattern for new integrations
- Maintain backward compatibility with existing CLI interfaces
`;

    try {
      fs.writeFileSync(claudeMdPath, sampleContent, 'utf-8');
      this.logger.log(`Created sample CLAUDE.md at ${claudeMdPath}`);
      return claudeMdPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create CLAUDE.md: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Clear project context cache
   */
  clearCache(): void {
    this.projectContextCache.clear();
    this.logger.debug('Project context cache cleared');
  }
}