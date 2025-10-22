/**
 * Skill Runtime Types for CrewX SDK
 * Defines interfaces and types for skill execution lifecycle and progressive disclosure
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

import { SkillMetadata, SkillContent, SkillDefinition, SkillValidationError as SkillValidationDetail, SkillValidationResult } from '../schema/skills.types';
import { AgentDefinition } from '../schema/skills.types';

/**
 * Skill execution lifecycle stages
 */
export type SkillRuntimeStage = 'load' | 'validate' | 'prepare' | 'execute' | 'cleanup';

/**
 * Skill loading options
 */
export interface SkillLoadOptions {
  /** Validation mode */
  validationMode?: 'strict' | 'lenient';
  
  /** Whether to load full content immediately */
  loadContent?: boolean;
  
  /** Whether to resolve dependencies */
  resolveDependencies?: boolean;
  
  /** Additional search paths */
  searchPaths?: string[];
  
  /** Cache parsed skills */
  cache?: boolean;
  
  /** Include/exclude filters */
  filters?: {
    include?: string[];
    exclude?: string[];
  };
}

/**
 * Skill execution context
 * Contains all necessary information for skill execution
 */
export interface SkillExecutionContext {
  // Skill identification
  skillName: string;
  skillVersion: string;
  
  // Execution environment
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
  
  // Runtime requirements
  runtimeRequirements: {
    python?: string;
    node?: string;
    docker?: boolean;
    memory?: string;
    [key: string]: string | boolean | undefined;
  };
  
  // Skill configuration
  configuration: {
    metadata: SkillMetadata;
    content?: SkillContent;
    agentConfig: AgentDefinition;
  };
  
  // Execution options
  options: {
    validationMode: 'strict' | 'lenient';
    progressiveLoading: boolean;
    cacheEnabled: boolean;
  };
  
  // Execution metadata
  executionId: string;
  startTime: Date;
}

/**
 * SDK-specific execution context extensions
 */
export interface SDKExecutionContext extends SkillExecutionContext {
  // Internal SDK services
  services: {
    layoutLoader?: any; // Will be imported from layout-loader.service
    templateContext?: any; // Will be imported from template.types
    agentFactory?: any; // Will be imported from agent-factory
  };
}

/**
 * CLI-specific execution context extensions
 */
export interface CLIExecutionContext extends SkillExecutionContext {
  // CLI-specific options
  cliOptions: {
    verbose?: boolean;
    dryRun?: boolean;
    debugMode?: boolean;
    interactive?: boolean;
  };
  
  // Terminal handling
  terminal: {
    width: number;
    height: number;
    interactive: boolean;
  };
}

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  
  /** Execution output (if successful) */
  output?: string;
  
  /** Execution error (if failed) */
  error?: Error;
  
  /** Execution metadata */
  metadata: {
    executionId: string;
    executionTime: number; // milliseconds
    memoryUsage?: number; // bytes
    dependenciesUsed: string[];
    cacheHits: number;
    cacheMisses: number;
  };
  
  /** Skill output artifacts (files generated, etc.) */
  artifacts?: {
    type: 'file' | 'directory' | 'url';
    path: string;
    description?: string;
  }[];
}

/**
 * Progressive disclosure loader interface
 */
export interface IProgressiveSkillLoader {
  /** Load metadata only (fast path) */
  loadMetadata(skillPaths: string[]): Promise<SkillMetadata[]>;
  
  /** Load full content for specific skill */
  loadFullContent(skillName: string): Promise<SkillDefinition>;
  
  /** Check if skill has full content loaded */
  isFullyLoaded(skillName: string): boolean;
  
  /** Preload content for skills */
  preloadContent(skillNames: string[]): Promise<void>;
  
  /** Clear cached content */
  clearContentCache(): Promise<void>;
}

/**
 * Skill cache statistics
 */
export interface SkillCacheStats {
  metadataCache: {
    count: number;
    size: number; // bytes
    hitRate: number; // percentage
  };
  contentCache: {
    count: number;
    size: number; // bytes
    hitRate: number; // percentage
  };
  total: {
    size: number;
    hitRate: number;
  };
}

/**
 * Skill runtime interface
 * Main interface for skill execution lifecycle
 */
export interface ISkillRuntime {
  // Lifecycle methods
  loadSkills(options?: SkillLoadOptions): Promise<SkillMetadata[]>;
  validateSkill(skillName: string): Promise<SkillValidationResult>;
  prepareContext(skillName: string, agentConfig: AgentDefinition, options?: Partial<SkillExecutionContext>): Promise<SkillExecutionContext>;
  executeSkill(context: SkillExecutionContext, input: string): Promise<SkillExecutionResult>;
  cleanup(context: SkillExecutionContext): Promise<void>;
  
  // Discovery methods
  listAvailableSkills(): Promise<string[]>;
  getSkillMetadata(skillName: string): Promise<SkillMetadata | null>;
  getSkillDefinition(skillName: string): Promise<SkillDefinition | null>;
  resolveDependencies(skillName: string): Promise<SkillResolutionResult>;
  
  // Cache management
  clearCache(): Promise<void>;
  getCacheStats(): SkillCacheStats;
  
  // Runtime management
  getRuntimeInfo(): SkillRuntimeInfo;
  shutdown(): Promise<void>;
}

/**
 * Skill resolution result
 */
export interface SkillResolutionResult {
  /** Resolved skill name */
  name: string;
  
  /** Skill definition */
  definition: SkillDefinition;
  
  /** Resolved dependencies (in dependency order) */
  dependencies: SkillResolutionResult[];
  
  /** Source path where skill was found */
  sourcePath: string;
  
  /** Resolution metadata */
  metadata: {
    resolvedAt: Date;
    version: string;
    dependenciesCount: number;
  };
}

/**
 * Runtime information
 */
export interface SkillRuntimeInfo {
  version: string;
  startTime: Date;
  skillsLoaded: number;
  uptime: number; // milliseconds
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

/**
 * Claude skill adapter interface
 */
export interface IClaudeSkillAdapter {
  /** Extract metadata from skills.md file */
  extractMetadata(skillFilePath: string): Promise<SkillMetadata>;
  
  /** Parse markdown content sections */
  parseContent(fullContent: string): SkillContent;
  
  /** Map Claude skill to CrewX agent configuration */
  mapToCrewXAgent(skill: SkillDefinition): AgentDefinition;
  
  /** Validate skill file format */
  validateSkillFile(filePath: string): Promise<SkillValidationResult>;
  
  /** Discover skills in directory */
  discoverSkills(directory: string): Promise<string[]>;
}

/**
 * Skill execution error details
 */
export interface SkillExecutionErrorDetails {
  stage: SkillRuntimeStage;
  skillName: string;
  executionId?: string;
  error: Error;
  recoverable: boolean;
  suggestions: string[];
  timestamp: Date;
}

/**
 * Skill runtime events
 */
export interface SkillRuntimeEvents {
  'skill:loaded': { skillName: string; metadata: SkillMetadata };
  'skill:validated': { skillName: string; result: SkillValidationResult };
  'skill:executed': { skillName: string; result: SkillExecutionResult };
  'skill:error': { error: SkillExecutionErrorDetails };
  'cache:cleared': {};
  'runtime:shutdown': {};
}

/**
 * Progressive disclosure configuration
 */
export interface ProgressiveDisclosureConfig {
  /** Enable progressive loading */
  enabled: boolean;
  
  /** Cache metadata for this duration (ms) */
  metadataCacheTTL: number;
  
  /** Cache content for this duration (ms) */
  contentCacheTTL: number;
  
  /** Maximum number of skills to preload */
  maxPreloadSkills: number;
  
  /** Preload strategy */
  preloadStrategy: 'recent' | 'popular' | 'dependency' | 'none';
  
  /** Content loading threshold */
  contentLoadThreshold: number; // skills count
}

/**
 * Runtime requirements validation
 */
export interface RuntimeRequirementsValidator {
  /** Validate Python version requirement */
  validatePython(requirement: string): Promise<boolean>;
  
  /** Validate Node.js version requirement */
  validateNode(requirement: string): Promise<boolean>;
  
  /** Validate Docker availability */
  validateDocker(): Promise<boolean>;
  
  /** Validate memory requirement */
  validateMemory(requirement: string): Promise<boolean>;
  
  /** Get current runtime info */
  getCurrentRuntime(): Promise<RuntimeInfo>;
}

/**
 * Current runtime information
 */
export interface RuntimeInfo {
  python?: {
    version: string;
    available: boolean;
  };
  node?: {
    version: string;
    available: boolean;
  };
  docker?: {
    version: string;
    available: boolean;
  };
  memory: {
    total: number;
    available: number;
  };
}

/**
 * Skill bundling information (for Phase 2)
 */
export interface SkillBundleInfo {
  /** Bundle identifier */
  id: string;
  
  /** Bundle version */
  version: string;
  
  /** Skills included in bundle */
  skills: string[];
  
  /** Bundle metadata */
  metadata: {
    name: string;
    description: string;
    author?: string;
    createdAt: Date;
    size: number;
  };
  
  /** Runtime requirements for all skills */
  runtimeRequirements: {
    python?: string;
    node?: string;
    docker?: boolean;
    [key: string]: string | boolean | undefined;
  };
}

/**
 * Error classes for skill runtime
 */
export class SkillRuntimeError extends Error {
  constructor(
    message: string,
    public readonly stage: SkillRuntimeStage,
    public readonly skillName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SkillRuntimeError';
  }
}

export class ProgressiveLoadingError extends SkillRuntimeError {
  constructor(message: string, skillName?: string, cause?: Error) {
    super(message, 'load', skillName, cause);
    this.name = 'ProgressiveLoadingError';
  }
}

export class SkillValidationError extends SkillRuntimeError {
  constructor(
    message: string,
    public readonly validationErrors: SkillValidationDetail[],
    skillName?: string
  ) {
    super(message, 'validate', skillName);
    this.name = 'SkillValidationError';
  }
}

export class SkillExecutionError extends SkillRuntimeError {
  constructor(
    message: string,
    skillName: string,
    public readonly executionId: string,
    cause?: Error
  ) {
    super(message, 'execute', skillName, cause);
    this.name = 'SkillExecutionError';
  }
}

export class SkillContextError extends SkillRuntimeError {
  constructor(message: string, skillName?: string, cause?: Error) {
    super(message, 'prepare', skillName, cause);
    this.name = 'SkillContextError';
  }
}