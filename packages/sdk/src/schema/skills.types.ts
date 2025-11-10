/**
 * Skill metadata and configuration types for CrewX SDK
 * Based on Claude skills.md format and CrewX YAML integration
 *
 * @see wbs/wbs-16-field-mapping.md for field mapping details
 * @see wbs/wbs-16-sdk-config-schema.md for Phase 1 requirements
 */

/**
 * Claude skill metadata (from skills.md frontmatter)
 * This represents the YAML frontmatter in a Claude skill markdown file
 */
export interface SkillMetadata {
  /** Skill identifier (kebab-case) */
  name: string;

  /** Short description of the skill */
  description: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Array of dependent skills (optional) */
  dependencies?: string[];

  /** Runtime requirements (optional) */
  runtime?: {
    python?: string;
    node?: string;
    [key: string]: string | undefined;
  };

  /** Visibility level (optional) */
  visibility?: 'public' | 'private' | 'internal';

  /** Custom metadata fields */
  [key: string]: unknown;
}

/**
 * Parsed Claude skill content sections
 * Represents the markdown content structure
 */
export interface SkillContent {
  /** Role section from markdown */
  role?: string;

  /** Task section from markdown */
  task?: string;

  /** Instructions section from markdown */
  instructions?: string;

  /** Full raw markdown content (for progressive disclosure) */
  raw?: string;
}

/**
 * Complete skill definition combining metadata and content
 */
export interface SkillDefinition {
  /** Skill metadata from frontmatter */
  metadata: SkillMetadata;

  /** Parsed content sections (loaded on demand) */
  content?: SkillContent;

  /** File path to the skill markdown file */
  filePath?: string;

  /** Whether full content is loaded */
  fullyLoaded?: boolean;
}

/**
 * Skills configuration in CrewX YAML (agent or project level)
 */
export interface SkillsConfig {
  /** Custom skill directories to search (project-level only) */
  paths?: string[];

  /** Explicitly include these skills */
  include?: string[];

  /** Explicitly exclude these skills */
  exclude?: string[];

  /** Auto-load all skills from paths (default: true) */
  autoload?: boolean;
}

/**
 * Project-level CrewX configuration
 * Extends existing crewx.yaml structure with skills support
 */
export interface CrewxProjectConfig {
  /** @deprecated Use skills.paths instead */
  skills_paths?: string[];

  /** Project-wide skills configuration */
  skills?: SkillsConfig;

  /** Layout definitions */
  layouts?: Record<string, string>;

  /** Document definitions */
  documents?: Record<string, string>;

  /** Settings */
  settings?: {
    slack?: {
      log_conversations?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  /** Agent definitions */
  agents?: AgentDefinition[];

  /** Allow additional fields */
  [key: string]: unknown;
}

/**
 * Agent definition with skills support
 * Extends existing agent.types.ts AgentInfo structure
 */
export interface AgentDefinition {
  /** Agent identifier */
  id: string;

  /** Display name (optional) */
  name?: string;

  /** Agent role (optional) */
  role?: string;

  /** Team name (optional) */
  team?: string;

  /** AI provider or array of providers for fallback */
  provider: string | string[];

  /** Working directory (optional) */
  working_directory?: string;

  /** Agent description (optional) */
  description?: string;

  /** Agent specialties (optional) */
  specialties?: string[];

  /** Agent capabilities (optional) */
  capabilities?: string[];

  /** Skills configuration for this agent */
  skills?: SkillsConfig;

  /** Inline agent configuration */
  inline?: {
    /** Type identifier */
    type?: 'agent';

    /** Model name */
    model?: string;

    /** System prompt */
    system_prompt?: string;

    /** Alternative to system_prompt */
    prompt?: string;

    /** Layout reference */
    layout?: string | { id: string; props?: Record<string, unknown> };

    /** Skill version (NEW - WBS-16) */
    version?: string;

    /** Skill dependencies (NEW - WBS-16) */
    dependencies?: string[];

    /** Agent-specific documents */
    documents?: Record<string, string>;

    /** Allow additional fields */
    [key: string]: unknown;
  };

  /** CLI options */
  options?: {
    query?: string[] | Record<string, string[]>;
    execute?: string[] | Record<string, string[]>;
  };

  /** Remote agent configuration */
  remote?: {
    type: string;
    url: string;
    apiKey?: string;
    agentId?: string;
    timeoutMs?: number;
    [key: string]: unknown;
  };

  /** Allow additional fields */
  [key: string]: unknown;
}

/**
 * Skill resolution result
 * Contains resolved skill definition and metadata
 */
export interface SkillResolutionResult {
  /** Resolved skill name */
  name: string;

  /** Skill definition */
  definition: SkillDefinition;

  /** Resolved dependencies (in dependency order) */
  dependencies?: SkillResolutionResult[];

  /** Source path where skill was found */
  sourcePath: string;
}

/**
 * Options for skill parsing and loading
 */
export interface SkillParserOptions {
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
}

/**
 * Skill validation error
 */
export interface SkillValidationError {
  /** Skill name */
  skillName: string;

  /** Error field path */
  field: string;

  /** Error message */
  message: string;

  /** Expected value or constraint */
  expected?: string;

  /** Actual value */
  actual?: unknown;
}

/**
 * Skill validation result
 */
export interface SkillValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors (if any) */
  errors: SkillValidationError[];

  /** Warnings (non-critical issues) */
  warnings?: SkillValidationError[];
}

/**
 * Error thrown when skill loading fails
 */
export class SkillLoadError extends Error {
  constructor(
    message: string,
    public readonly skillName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SkillLoadError';
  }
}

/**
 * Error thrown when skill not found
 */
export class SkillNotFoundError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly searchPaths: string[]
  ) {
    super(`Skill "${skillName}" not found in paths: ${searchPaths.join(', ')}`);
    this.name = 'SkillNotFoundError';
  }
}

/**
 * Error thrown when skill dependency resolution fails
 */
export class SkillDependencyError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly missingDependencies: string[]
  ) {
    super(
      `Skill "${skillName}" missing dependencies: ${missingDependencies.join(', ')}`
    );
    this.name = 'SkillDependencyError';
  }
}

/**
 * Error thrown when skill version mismatch occurs
 */
export class SkillVersionMismatchError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly requiredVersion: string,
    public readonly foundVersion: string
  ) {
    super(
      `Skill "${skillName}" version mismatch. Required: ${requiredVersion}, Found: ${foundVersion}`
    );
    this.name = 'SkillVersionMismatchError';
  }
}

/**
 * Skill manifest for packaging and distribution
 * Used in Phase 2 (WBS-17) for skill runtime
 */
export interface SkillManifest {
  /** Skill metadata */
  metadata: SkillMetadata;

  /** Bundled files */
  files: {
    /** Main skill markdown file */
    main: string;

    /** Additional resource files */
    resources?: string[];
  };

  /** Package checksum for integrity */
  checksum?: string;

  /** Digital signature (optional) */
  signature?: string;

  /** Build metadata */
  build?: {
    timestamp: string;
    builder?: string;
    [key: string]: unknown;
  };
}
