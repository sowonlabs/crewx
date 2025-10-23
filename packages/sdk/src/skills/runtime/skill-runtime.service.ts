/**
 * Skill Runtime Implementation
 * Main skill execution lifecycle management with progressive disclosure
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

import { EventEmitter } from 'events';
import path from 'path';
import { 
  ISkillRuntime,
  IProgressiveSkillLoader,
  IClaudeSkillAdapter,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillLoadOptions,
  SkillResolutionResult,
  SkillCacheStats,
  SkillRuntimeInfo,
  SkillRuntimeEvents,
  SkillRuntimeError,
  ProgressiveLoadingError,
  SkillValidationError,
  SkillExecutionError,
  SkillContextError,
  RuntimeRequirementsValidator,
  ProgressiveDisclosureConfig
} from '../../types/skill-runtime.types';

import { 
  SkillMetadata, 
  SkillDefinition, 
  SkillValidationResult,
  AgentDefinition 
} from '../../schema/skills.types';

/**
 * Main Skill Runtime implementation
 * Implements the complete skill execution lifecycle
 */
export class SkillRuntime extends EventEmitter implements ISkillRuntime {
  private readonly progressiveLoader: IProgressiveSkillLoader;
  private readonly claudeAdapter: IClaudeSkillAdapter;
  private readonly runtimeValidator: RuntimeRequirementsValidator;
  private readonly config: ProgressiveDisclosureConfig;
  
  private startTime: Date;
  private skillsCache: Map<string, SkillMetadata> = new Map();
  private contentCache: Map<string, SkillDefinition> = new Map();
  private activeExecutions: Map<string, SkillExecutionContext> = new Map();
  private cacheStats: SkillCacheStats;

  constructor(
    progressiveLoader: IProgressiveSkillLoader,
    claudeAdapter: IClaudeSkillAdapter,
    runtimeValidator: RuntimeRequirementsValidator,
    config?: Partial<ProgressiveDisclosureConfig>
  ) {
    super();
    
    this.progressiveLoader = progressiveLoader;
    this.claudeAdapter = claudeAdapter;
    this.runtimeValidator = runtimeValidator;
    this.startTime = new Date();
    
    // Default configuration
    this.config = {
      enabled: true,
      metadataCacheTTL: 30 * 60 * 1000, // 30 minutes
      contentCacheTTL: 60 * 60 * 1000, // 1 hour
      maxPreloadSkills: 10,
      preloadStrategy: 'recent',
      contentLoadThreshold: 50,
      ...config
    };
    
    this.cacheStats = this.initializeCacheStats();
    this.setupCacheCleanup();
  }

  // ===== Lifecycle Methods =====

  async loadSkills(options?: SkillLoadOptions): Promise<SkillMetadata[]> {
    const startTime = Date.now();
    
    try {
      // Load metadata only (progressive disclosure)
      const skillPaths = options?.searchPaths || [];
      const metadata = await this.progressiveLoader.loadMetadata(skillPaths);
      
      // Apply filters if provided
      const filteredMetadata = this.applyFilters(metadata, options?.filters);
      
      // Update cache
      for (const meta of filteredMetadata) {
        this.skillsCache.set(meta.name, meta);
      }
      
      // Emit events
      for (const meta of filteredMetadata) {
        this.emit('skill:loaded', { skillName: meta.name, metadata: meta });
      }
      
      // Update cache stats
      this.updateCacheStats();
      
      console.log(`Loaded ${filteredMetadata.length} skills in ${Date.now() - startTime}ms`);
      
      return filteredMetadata;
      
    } catch (error) {
      throw new ProgressiveLoadingError(
        `Failed to load skills: ${(error as Error).message}`,
        undefined,
        error as Error
      );
    }
  }

  async validateSkill(skillName: string): Promise<SkillValidationResult> {
    try {
      const metadata = await this.getSkillMetadata(skillName);
      if (!metadata) {
        return {
          valid: false,
          errors: [{
            skillName,
            field: 'name',
            message: `Skill "${skillName}" not found`,
            actual: skillName
          }]
        };
      }

      // Validate metadata structure
      const errors = this.validateMetadataStructure(metadata);
      
      // Validate dependencies if available
      if (metadata.dependencies) {
        const depErrors = await this.validateDependencies(metadata.dependencies);
        errors.push(...depErrors);
      }

      const result: SkillValidationResult = {
        valid: errors.length === 0,
        errors
      };

      this.emit('skill:validated', { skillName, result });
      
      return result;
      
    } catch (error) {
      throw new SkillValidationError(
        `Validation failed for skill "${skillName}"`,
        [{ skillName, field: 'validation', message: (error as Error).message }],
        skillName
      );
    }
  }

  async prepareContext(
    skillName: string, 
    agentConfig: AgentDefinition,
    options?: Partial<SkillExecutionContext>
  ): Promise<SkillExecutionContext> {
    const executionId = this.generateExecutionId();
    
    try {
      // Get skill metadata and definition
      const metadata = await this.getSkillMetadata(skillName);
      if (!metadata) {
        throw new SkillContextError(`Skill "${skillName}" not found`, skillName);
      }

      const definition = await this.getSkillDefinition(skillName);
      
      // Validate skill first
      const validation = await this.validateSkill(skillName);
      if (!validation.valid) {
        throw new SkillValidationError(
          `Skill "${skillName}" failed validation`,
          validation.errors,
          skillName
        );
      }

      // Check runtime requirements
      await this.validateRuntimeRequirements(metadata);

      // Create execution context
      const context: SkillExecutionContext = {
        skillName,
        skillVersion: metadata.version,
        workingDirectory: options?.workingDirectory || process.cwd(),
        environment: options?.environment || (process.env as Record<string, string>),
        timeout: options?.timeout || 30000, // 30 seconds default
        runtimeRequirements: metadata.runtime || {},
        configuration: {
          metadata,
          content: definition?.content,
          agentConfig
        },
        options: {
          validationMode: options?.options?.validationMode || 'lenient',
          progressiveLoading: options?.options?.progressiveLoading ?? true,
          cacheEnabled: options?.options?.cacheEnabled ?? true
        },
        executionId,
        startTime: new Date()
      };

      // Store active execution
      this.activeExecutions.set(executionId, context);
      
      return context;
      
    } catch (error) {
      throw new SkillContextError(
        `Failed to prepare context for skill "${skillName}": ${(error as Error).message}`,
        skillName,
        error as Error
      );
    }
  }

  async executeSkill(context: SkillExecutionContext, input: string): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Load full content if not already loaded (progressive disclosure)
      if (!context.configuration.content) {
        const definition = await this.progressiveLoader.loadFullContent(context.skillName);
        context.configuration.content = definition.content;
      }

      // Build complete prompt from skill content and user input
      const prompt = this.buildExecutionPrompt(context, input);
      
      // Execute skill (this would integrate with AI provider)
      const output = await this.executeWithAIProvider(context, prompt);
      
      // Calculate execution metadata
      const executionTime = Date.now() - startTime;
      const memoryUsage = this.getMemoryUsage();
      
      const result: SkillExecutionResult = {
        success: true,
        output,
        metadata: {
          executionId: context.executionId,
          executionTime,
          memoryUsage,
          dependenciesUsed: context.configuration.metadata.dependencies || [],
          cacheHits: this.getCacheHits(),
          cacheMisses: this.getCacheMisses()
        }
      };

      // Emit success event
      this.emit('skill:executed', { skillName: context.skillName, result });
      
      return result;
      
    } catch (error) {
      const result: SkillExecutionResult = {
        success: false,
        error: error as Error,
        metadata: {
          executionId: context.executionId,
          executionTime: Date.now() - startTime,
          dependenciesUsed: context.configuration.metadata.dependencies || [],
          cacheHits: this.getCacheHits(),
          cacheMisses: this.getCacheMisses()
        }
      };

      // Emit error event
      this.emit('skill:error', {
        stage: 'execute',
        skillName: context.skillName,
        executionId: context.executionId,
        error: error as Error,
        recoverable: true,
        suggestions: ['Check skill content format', 'Verify runtime requirements'],
        timestamp: new Date()
      });

      throw new SkillExecutionError(
        `Skill execution failed: ${(error as Error).message}`,
        context.skillName,
        context.executionId,
        error as Error
      );
    }
  }

  async cleanup(context: SkillExecutionContext): Promise<void> {
    try {
      // Remove from active executions
      this.activeExecutions.delete(context.executionId);
      
      // Update cache stats
      this.updateCacheStats();
      
      // Optional: Clear specific cache entries if needed
      if (!context.options.cacheEnabled) {
        this.contentCache.delete(context.skillName);
      }
      
    } catch (error) {
      console.warn(`Cleanup failed for execution ${context.executionId}:`, error);
    }
  }

  // ===== Discovery Methods =====

  async listAvailableSkills(): Promise<string[]> {
    return Array.from(this.skillsCache.keys());
  }

  async getSkillMetadata(skillName: string): Promise<SkillMetadata | null> {
    // Check cache first
    if (this.skillsCache.has(skillName)) {
      return this.skillsCache.get(skillName)!;
    }

    // Try to load from disk
    try {
      const metadata = await this.progressiveLoader.loadMetadata([path.dirname(skillName)]);
      const skill = metadata.find(m => m.name === skillName);
      
      if (skill) {
        this.skillsCache.set(skillName, skill);
        return skill;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to load metadata for skill "${skillName}":`, error);
      return null;
    }
  }

  async getSkillDefinition(skillName: string): Promise<SkillDefinition | null> {
    // Check content cache first
    if (this.contentCache.has(skillName)) {
      return this.contentCache.get(skillName)!;
    }

    // Load full content
    try {
      const definition = await this.progressiveLoader.loadFullContent(skillName);
      this.contentCache.set(skillName, definition);
      return definition;
    } catch (error) {
      console.warn(`Failed to load definition for skill "${skillName}":`, error);
      return null;
    }
  }

  async resolveDependencies(skillName: string): Promise<SkillResolutionResult> {
    const visited = new Set<string>();
    
    const resolve = async (name: string): Promise<SkillResolutionResult> => {
      if (visited.has(name)) {
        throw new SkillRuntimeError(
          `Circular dependency detected: ${name}`,
          'validate',
          name
        );
      }
      
      visited.add(name);
      
      const definition = await this.getSkillDefinition(name);
      if (!definition) {
        throw new SkillRuntimeError(
          `Skill "${name}" not found during dependency resolution`,
          'validate',
          name
        );
      }

      const dependencies: SkillResolutionResult[] = [];
      
      if (definition.metadata.dependencies) {
        for (const depName of definition.metadata.dependencies) {
          const dep = await resolve(depName);
          dependencies.push(dep);
        }
      }

      return {
        name,
        definition,
        dependencies,
        sourcePath: definition.filePath || '',
        metadata: {
          resolvedAt: new Date(),
          version: definition.metadata.version,
          dependenciesCount: dependencies.length
        }
      };
    };

    return resolve(skillName);
  }

  // ===== Cache Management =====

  async clearCache(): Promise<void> {
    this.skillsCache.clear();
    this.contentCache.clear();
    this.cacheStats = this.initializeCacheStats();
    
    this.emit('cache:cleared', {});
  }

  getCacheStats(): SkillCacheStats {
    this.updateCacheStats();
    return { ...this.cacheStats };
  }

  // ===== Runtime Management =====

  getRuntimeInfo(): SkillRuntimeInfo {
    return {
      version: '1.0.0', // Would come from package.json
      startTime: this.startTime,
      skillsLoaded: this.skillsCache.size,
      uptime: Date.now() - this.startTime.getTime(),
      memoryUsage: process.memoryUsage()
    };
  }

  async shutdown(): Promise<void> {
    try {
      // Clear all active executions
      for (const context of this.activeExecutions.values()) {
        await this.cleanup(context);
      }
      
      // Clear caches
      await this.clearCache();
      
      // Remove all listeners
      this.removeAllListeners();
      
      // Emit shutdown event
      this.emit('runtime:shutdown', {});
      
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  // ===== Private Helper Methods =====

  private initializeCacheStats(): SkillCacheStats {
    return {
      metadataCache: { count: 0, size: 0, hitRate: 0 },
      contentCache: { count: 0, size: 0, hitRate: 0 },
      total: { size: 0, hitRate: 0 }
    };
  }

  private setupCacheCleanup(): void {
    // Setup periodic cache cleanup
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.config.metadataCacheTTL);
  }

  private applyFilters(
    metadata: SkillMetadata[], 
    filters?: { include?: string[]; exclude?: string[] }
  ): SkillMetadata[] {
    if (!filters) return metadata;

    let filtered = metadata;

    if (filters.include?.length) {
      filtered = filtered.filter(meta => filters.include!.includes(meta.name));
    }

    if (filters.exclude?.length) {
      filtered = filtered.filter(meta => !filters.exclude!.includes(meta.name));
    }

    return filtered;
  }

  private validateMetadataStructure(metadata: SkillMetadata): any[] {
    const errors = [];

    if (!metadata.name || !metadata.name.trim()) {
      errors.push({
        skillName: metadata.name || 'unknown',
        field: 'name',
        message: 'Skill name is required',
        actual: metadata.name
      });
    }

    if (!metadata.description || !metadata.description.trim()) {
      errors.push({
        skillName: metadata.name,
        field: 'description',
        message: 'Skill description is required',
        actual: metadata.description
      });
    }

    if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push({
        skillName: metadata.name,
        field: 'version',
        message: 'Semantic version is required (e.g., "1.0.0")',
        actual: metadata.version
      });
    }

    return errors;
  }

  private async validateDependencies(dependencies: string[]): Promise<any[]> {
    const errors = [];

    for (const dep of dependencies) {
      try {
        const metadata = await this.getSkillMetadata(dep);
        if (!metadata) {
          errors.push({
            skillName: dep,
            field: 'dependency',
            message: `Dependency "${dep}" not found`,
            actual: dep
          });
        }
      } catch (error) {
        errors.push({
          skillName: dep,
          field: 'dependency',
          message: `Failed to validate dependency "${dep}": ${(error as Error).message}`,
          actual: dep
        });
      }
    }

    return errors;
  }

  private async validateRuntimeRequirements(metadata: SkillMetadata): Promise<void> {
    if (!metadata.runtime) return;

    const requirements = metadata.runtime;

    if (requirements.python) {
      const isValid = await this.runtimeValidator.validatePython(requirements.python);
      if (!isValid) {
        throw new SkillContextError(
          `Python requirement not met: ${requirements.python}`,
          metadata.name
        );
      }
    }

    if (requirements.node) {
      const isValid = await this.runtimeValidator.validateNode(requirements.node);
      if (!isValid) {
        throw new SkillContextError(
          `Node.js requirement not met: ${requirements.node}`,
          metadata.name
        );
      }
    }

    if (requirements.docker) {
      const isValid = await this.runtimeValidator.validateDocker();
      if (!isValid) {
        throw new SkillContextError(
          'Docker requirement not met',
          metadata.name
        );
      }
    }

    if (requirements.memory) {
      const isValid = await this.runtimeValidator.validateMemory(requirements.memory);
      if (!isValid) {
        throw new SkillContextError(
          `Memory requirement not met: ${requirements.memory}`,
          metadata.name
        );
      }
    }
  }

  private buildExecutionPrompt(context: SkillExecutionContext, input: string): string {
    const content = context.configuration.content;
    if (!content) {
      throw new SkillContextError('Skill content not loaded', context.skillName);
    }

    let prompt = '';

    if (content.role) {
      prompt += `## Role\n${content.role}\n\n`;
    }

    if (content.task) {
      prompt += `## Task\n${content.task}\n\n`;
    }

    if (content.instructions) {
      prompt += `## Instructions\n${content.instructions}\n\n`;
    }

    prompt += `## User Input\n${input}`;

    return prompt;
  }

  private async executeWithAIProvider(context: SkillExecutionContext, prompt: string): Promise<string> {
    // This would integrate with the AI provider system
    // For now, return a mock response
    return `[Skill: ${context.skillName}] Executed with prompt: ${prompt.substring(0, 100)}...`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  private getCacheHits(): number {
    // Would be tracked with proper cache implementation
    return 0;
  }

  private getCacheMisses(): number {
    // Would be tracked with proper cache implementation
    return 0;
  }

  private updateCacheStats(): void {
    this.cacheStats.metadataCache.count = this.skillsCache.size;
    this.cacheStats.contentCache.count = this.contentCache.size;
    
    // Calculate sizes (rough estimation)
    this.cacheStats.metadataCache.size = this.skillsCache.size * 1024; // ~1KB per skill
    this.cacheStats.contentCache.size = this.contentCache.size * 10240; // ~10KB per skill
    
    this.cacheStats.total.size = this.cacheStats.metadataCache.size + this.cacheStats.contentCache.size;
  }

  private cleanupExpiredCache(): void {
    // Implementation would check TTL and remove expired entries
    // For now, just update stats
    this.updateCacheStats();
  }
}