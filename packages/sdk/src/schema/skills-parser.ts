/**
 * Skill parser and validator for CrewX SDK
 * Implements WBS-16 Phase 2: SDK Parser/Validator Implementation
 *
 * Provides functions to parse CrewX YAML config files and Claude skill manifests
 * with progressive disclosure and comprehensive error handling.
 *
 * @see wbs/wbs-16-phase-1-schema-design.md for design decisions
 * @see wbs/wbs-16-field-mapping.md for field mappings
 */

import { load as loadYaml } from 'js-yaml';
import { readFileSync } from 'fs';
import {
  SkillMetadata,
  SkillContent,
  SkillDefinition,
  SkillsConfig,
  CrewxProjectConfig,
  SkillManifest,
  SkillValidationError,
  SkillValidationResult,
  SkillLoadError,
  SkillNotFoundError,
  SkillParserOptions,
} from './skills.types';

/**
 * Default parser options
 */
const DEFAULT_PARSER_OPTIONS: Required<SkillParserOptions> = {
  validationMode: 'strict',
  loadContent: false, // Progressive disclosure: metadata only by default
  resolveDependencies: false,
  searchPaths: [],
  cache: true,
};

/**
 * Cache for parsed skills (progressive disclosure)
 */
interface SkillCache {
  metadata: Map<string, SkillMetadata>;
  content: Map<string, SkillContent>;
  definitions: Map<string, SkillDefinition>;
}

const skillCache: SkillCache = {
  metadata: new Map(),
  content: new Map(),
  definitions: new Map(),
};

/**
 * Parse CrewX YAML configuration file (crewx.yaml or agents.yaml)
 *
 * Supports progressive disclosure: returns only required fields by default.
 * Set options.loadContent = true to load full skill content immediately.
 *
 * @param yamlString - YAML configuration content
 * @param options - Parser options
 * @returns Parsed CrewX project configuration
 * @throws {SkillLoadError} If YAML parsing fails
 * @throws {ValidationError} If validation fails in strict mode
 *
 * @example
 * ```typescript
 * const config = parseCrewxConfig(yamlContent);
 * console.log(config.skills?.include); // ["code-formatter"]
 * ```
 */
export function parseCrewxConfig(
  yamlString: string,
  options: Partial<SkillParserOptions> = {}
): CrewxProjectConfig {
  const opts = { ...DEFAULT_PARSER_OPTIONS, ...options };

  // Validate input
  if (!yamlString || typeof yamlString !== 'string') {
    throw new SkillLoadError('YAML string is required and must be a non-empty string');
  }

  // Parse YAML
  let parsed: any;
  try {
    const trimmed = yamlString.trim();
    parsed = loadYaml(trimmed);
  } catch (error) {
    throw new SkillLoadError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // Validate parsed structure
  if (
    parsed === null ||
    parsed === undefined ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new SkillLoadError('YAML must contain a valid object structure');
  }

  // Build configuration object
  const config: CrewxProjectConfig = {};

  // Extract skills_paths (project-level skill directories)
  if (parsed.skills_paths) {
    if (Array.isArray(parsed.skills_paths)) {
      config.skills_paths = parsed.skills_paths.filter((p: any) => typeof p === 'string');
    } else if (opts.validationMode === 'strict') {
      throw new SkillLoadError('skills_paths must be an array of strings');
    }
  }

  // Extract project-level skills configuration
  if (parsed.skills) {
    config.skills = parseSkillsConfig(parsed.skills, opts.validationMode);
  }

  // Extract layouts
  if (parsed.layouts && typeof parsed.layouts === 'object') {
    config.layouts = parsed.layouts;
  }

  // Extract documents
  if (parsed.documents && typeof parsed.documents === 'object') {
    config.documents = parsed.documents;
  }

  // Extract settings
  if (parsed.settings && typeof parsed.settings === 'object') {
    config.settings = parsed.settings;
  }

  // Extract agent definitions
  if (parsed.agents) {
    if (Array.isArray(parsed.agents)) {
      config.agents = parsed.agents.map((agent: any) => parseAgentDefinition(agent, opts.validationMode));
    } else if (opts.validationMode === 'strict') {
      throw new SkillLoadError('agents must be an array');
    }
  }

  // Preserve additional fields
  for (const key of Object.keys(parsed)) {
    if (!['skills_paths', 'skills', 'layouts', 'documents', 'settings', 'agents'].includes(key)) {
      config[key] = parsed[key];
    }
  }

  return config;
}

/**
 * Parse SkillsConfig from YAML object
 */
function parseSkillsConfig(
  skillsObj: any,
  validationMode: 'strict' | 'lenient'
): SkillsConfig {
  const config: SkillsConfig = {};

  if (typeof skillsObj !== 'object' || Array.isArray(skillsObj)) {
    if (validationMode === 'strict') {
      throw new SkillLoadError('skills configuration must be an object');
    }
    return config;
  }

  // Parse include array
  if (skillsObj.include !== undefined) {
    if (Array.isArray(skillsObj.include)) {
      config.include = skillsObj.include.filter((s: any) => typeof s === 'string');
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('skills.include must be an array of strings');
    }
  }

  // Parse exclude array
  if (skillsObj.exclude !== undefined) {
    if (Array.isArray(skillsObj.exclude)) {
      config.exclude = skillsObj.exclude.filter((s: any) => typeof s === 'string');
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('skills.exclude must be an array of strings');
    }
  }

  // Parse autoload boolean
  if (skillsObj.autoload !== undefined) {
    if (typeof skillsObj.autoload === 'boolean') {
      config.autoload = skillsObj.autoload;
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('skills.autoload must be a boolean');
    }
  }

  return config;
}

/**
 * Parse AgentDefinition from YAML object
 */
function parseAgentDefinition(agentObj: any, validationMode: 'strict' | 'lenient'): any {
  if (typeof agentObj !== 'object' || Array.isArray(agentObj)) {
    if (validationMode === 'strict') {
      throw new SkillLoadError('Agent definition must be an object');
    }
    return agentObj;
  }

  // Parse skills configuration if present
  if (agentObj.skills) {
    agentObj.skills = parseSkillsConfig(agentObj.skills, validationMode);
  }

  return agentObj;
}

/**
 * Parse Claude skill manifest from markdown file content
 *
 * Extracts metadata (frontmatter) and content sections (Role, Task, Instructions).
 * Supports progressive disclosure: set options.loadContent = false to load metadata only.
 *
 * @param markdownContent - Skill markdown file content
 * @param options - Parser options
 * @returns Parsed skill definition
 * @throws {SkillLoadError} If parsing fails
 *
 * @example
 * ```typescript
 * // Load metadata only (fast)
 * const skill = parseSkillManifest(content, { loadContent: false });
 * console.log(skill.metadata.name); // "code-formatter"
 *
 * // Load full content
 * const fullSkill = parseSkillManifest(content, { loadContent: true });
 * console.log(fullSkill.content?.role); // "You are an expert code formatter."
 * ```
 */
export function parseSkillManifest(
  markdownContent: string,
  options: Partial<SkillParserOptions> = {}
): SkillDefinition {
  const opts = { ...DEFAULT_PARSER_OPTIONS, ...options };

  // Validate input
  if (!markdownContent || typeof markdownContent !== 'string') {
    throw new SkillLoadError('Markdown content is required and must be a non-empty string');
  }

  // Extract frontmatter (YAML between --- delimiters)
  const frontmatterMatch = markdownContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

  if (!frontmatterMatch || !frontmatterMatch[1]) {
    throw new SkillLoadError('Skill manifest must contain YAML frontmatter (---...---)');
  }

  const frontmatterYaml: string = frontmatterMatch[1];
  const contentAfterFrontmatter = markdownContent.slice(frontmatterMatch[0].length);

  // Parse metadata from frontmatter
  let metadata: SkillMetadata;
  try {
    const parsed = loadYaml(frontmatterYaml) as any;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Frontmatter must be a YAML object');
    }
    metadata = parseSkillMetadata(parsed, opts.validationMode);
  } catch (error) {
    const skillName = (error as any)?.skillName || 'unknown';
    throw new SkillLoadError(
      `Failed to parse skill frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`,
      skillName,
      error instanceof Error ? error : undefined
    );
  }

  // Validate metadata
  const validationResult = validateSkillMetadata(metadata);
  if (!validationResult.valid && opts.validationMode === 'strict') {
    const errorMessages = validationResult.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new SkillLoadError(`Skill metadata validation failed: ${errorMessages}`, metadata.name);
  }

  // Build skill definition
  const definition: SkillDefinition = {
    metadata,
    fullyLoaded: opts.loadContent,
  };

  // Load content if requested (progressive disclosure)
  if (opts.loadContent) {
    definition.content = parseSkillContent(contentAfterFrontmatter);
  }

  return definition;
}

/**
 * Parse skill metadata from frontmatter object
 */
function parseSkillMetadata(
  frontmatter: any,
  validationMode: 'strict' | 'lenient'
): SkillMetadata {
  const metadata: SkillMetadata = {
    name: '',
    description: '',
    version: '',
  };

  // Required fields
  if (typeof frontmatter.name === 'string') {
    metadata.name = frontmatter.name;
  } else if (validationMode === 'strict') {
    throw new SkillLoadError('Skill name is required and must be a string');
  } else {
    metadata.name = ''; // Set empty string for lenient mode
  }

  if (typeof frontmatter.description === 'string') {
    metadata.description = frontmatter.description;
  } else if (validationMode === 'strict') {
    throw new SkillLoadError('Skill description is required and must be a string');
  } else {
    metadata.description = ''; // Set empty string for lenient mode
  }

  if (typeof frontmatter.version === 'string') {
    metadata.version = frontmatter.version;
  } else if (validationMode === 'strict') {
    throw new SkillLoadError('Skill version is required and must be a string');
  } else {
    metadata.version = ''; // Set empty string for lenient mode
  }

  // Optional fields
  if (frontmatter.dependencies !== undefined) {
    if (Array.isArray(frontmatter.dependencies)) {
      metadata.dependencies = frontmatter.dependencies.filter((d: any) => typeof d === 'string');
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('Skill dependencies must be an array');
    }
  }

  if (frontmatter.runtime !== undefined) {
    if (typeof frontmatter.runtime === 'object' && frontmatter.runtime !== null) {
      metadata.runtime = frontmatter.runtime;
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('Skill runtime must be an object');
    }
  }

  if (frontmatter.visibility !== undefined) {
    if (
      typeof frontmatter.visibility === 'string' &&
      ['public', 'private', 'internal'].includes(frontmatter.visibility)
    ) {
      metadata.visibility = frontmatter.visibility as 'public' | 'private' | 'internal';
    } else if (validationMode === 'strict') {
      throw new SkillLoadError('Skill visibility must be "public", "private", or "internal"');
    }
  }

  // Preserve custom metadata fields
  for (const key of Object.keys(frontmatter)) {
    if (!['name', 'description', 'version', 'dependencies', 'runtime', 'visibility'].includes(key)) {
      metadata[key] = frontmatter[key];
    }
  }

  return metadata;
}

/**
 * Parse skill content sections from markdown
 */
function parseSkillContent(markdown: string): SkillContent {
  const content: SkillContent = {
    raw: markdown,
  };

  // Extract ## Role section
  const roleMatch = markdown.match(/##\s+Role\s*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n|$)/i);
  if (roleMatch && roleMatch[1]) {
    content.role = roleMatch[1].trim();
  }

  // Extract ## Task section
  const taskMatch = markdown.match(/##\s+Task\s*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n|$)/i);
  if (taskMatch && taskMatch[1]) {
    content.task = taskMatch[1].trim();
  }

  // Extract ## Instructions section
  const instructionsMatch = markdown.match(/##\s+Instructions\s*\n([\s\S]*?)(?=\n##\s+|\n---\s*\n|$)/i);
  if (instructionsMatch && instructionsMatch[1]) {
    content.instructions = instructionsMatch[1].trim();
  }

  return content;
}

/**
 * Validate skill metadata against schema rules
 *
 * @param metadata - Skill metadata to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSkillMetadata(metadata);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateSkillMetadata(metadata: SkillMetadata): SkillValidationResult {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationError[] = [];

  // Validate name (required, kebab-case, max 50 chars)
  const skillName = metadata.name || 'unknown';
  if (!metadata.name) {
    errors.push({
      skillName,
      field: 'name',
      message: 'Skill name is required',
      expected: 'non-empty string',
      actual: metadata.name,
    });
  } else {
    const namePattern = /^[a-z0-9-]+$/;
    if (!namePattern.test(metadata.name)) {
      errors.push({
        skillName: metadata.name,
        field: 'name',
        message: 'Skill name must be kebab-case (lowercase letters, numbers, and hyphens only)',
        expected: 'kebab-case format',
        actual: metadata.name,
      });
    }
    if (metadata.name.length > 50) {
      warnings?.push({
        skillName: metadata.name,
        field: 'name',
        message: 'Skill name should be 50 characters or less',
        expected: '≤50 characters',
        actual: metadata.name.length,
      });
    }
  }

  // Validate description (required, 10-200 chars)
  if (!metadata.description) {
    errors.push({
      skillName,
      field: 'description',
      message: 'Skill description is required',
      expected: 'non-empty string',
      actual: metadata.description,
    });
  } else {
    if (metadata.description.length < 10) {
      warnings?.push({
        skillName,
        field: 'description',
        message: 'Skill description should be at least 10 characters',
        expected: '≥10 characters',
        actual: metadata.description.length,
      });
    }
    if (metadata.description.length > 200) {
      warnings?.push({
        skillName,
        field: 'description',
        message: 'Skill description should be 200 characters or less',
        expected: '≤200 characters',
        actual: metadata.description.length,
      });
    }
  }

  // Validate version (required, semantic versioning)
  if (!metadata.version) {
    errors.push({
      skillName,
      field: 'version',
      message: 'Skill version is required',
      expected: 'semantic version (e.g., "1.0.0")',
      actual: metadata.version,
    });
  } else {
    const versionPattern = /^\d+\.\d+\.\d+$/;
    if (!versionPattern.test(metadata.version)) {
      errors.push({
        skillName,
        field: 'version',
        message: 'Skill version must follow semantic versioning (major.minor.patch)',
        expected: 'X.Y.Z format',
        actual: metadata.version,
      });
    }
  }

  // Validate dependencies (optional, array of strings with optional @version)
  if (metadata.dependencies) {
    if (!Array.isArray(metadata.dependencies)) {
      errors.push({
        skillName,
        field: 'dependencies',
        message: 'Dependencies must be an array',
        expected: 'array of strings',
        actual: typeof metadata.dependencies,
      });
    } else {
      const depPattern = /^[a-z0-9-]+(@\d+\.\d+\.\d+)?$/;
      metadata.dependencies.forEach((dep, index) => {
        if (typeof dep !== 'string' || !depPattern.test(dep)) {
          errors.push({
            skillName,
            field: `dependencies[${index}]`,
            message: 'Dependency must be in format "skill-name" or "skill-name@version"',
            expected: 'kebab-case name with optional @version',
            actual: dep,
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings || [],
  };
}

/**
 * Load skill content on demand (progressive disclosure)
 *
 * If skill definition was loaded with loadContent=false, this function
 * loads the full content sections from the file.
 *
 * @param definition - Skill definition with metadata
 * @param filePath - Path to skill markdown file
 * @returns Updated skill definition with loaded content
 *
 * @example
 * ```typescript
 * const skill = parseSkillManifest(content, { loadContent: false });
 * // ... later when content is needed ...
 * const fullSkill = loadSkillContent(skill, './skills/code-formatter.md');
 * ```
 */
export function loadSkillContent(
  definition: SkillDefinition,
  filePath: string
): SkillDefinition {
  if (definition.fullyLoaded) {
    return definition; // Already loaded
  }

  // Check cache first
  const cacheKey = filePath || definition.metadata.name;
  if (skillCache.content.has(cacheKey)) {
    definition.content = skillCache.content.get(cacheKey);
    definition.fullyLoaded = true;
    return definition;
  }

  // Load file content
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new SkillLoadError(
      `Failed to read skill file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      definition.metadata.name,
      error instanceof Error ? error : undefined
    );
  }

  // Extract content after frontmatter
  const frontmatterMatch = fileContent.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  const contentAfterFrontmatter = frontmatterMatch
    ? fileContent.slice(frontmatterMatch[0].length)
    : fileContent;

  // Parse content
  const content = parseSkillContent(contentAfterFrontmatter);

  // Update cache
  skillCache.content.set(cacheKey, content);

  // Update definition
  definition.content = content;
  definition.fullyLoaded = true;

  return definition;
}

/**
 * Clear skill cache (for testing or cache invalidation)
 */
export function clearSkillCache(): void {
  skillCache.metadata.clear();
  skillCache.content.clear();
  skillCache.definitions.clear();
}

/**
 * Parse skill manifest from file path
 *
 * Convenience function that reads file and parses manifest.
 *
 * @param filePath - Path to skill markdown file
 * @param options - Parser options
 * @returns Parsed skill definition
 *
 * @example
 * ```typescript
 * const skill = parseSkillManifestFromFile('./skills/code-formatter.md');
 * ```
 */
export function parseSkillManifestFromFile(
  filePath: string,
  options: Partial<SkillParserOptions> = {}
): SkillDefinition {
  if (!filePath || typeof filePath !== 'string') {
    throw new SkillLoadError('File path is required and must be a non-empty string');
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new SkillLoadError(
      `Failed to read skill file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  const definition = parseSkillManifest(fileContent, options);
  definition.filePath = filePath;

  return definition;
}

/**
 * Parse CrewX config from file path
 *
 * Convenience function that reads file and parses configuration.
 *
 * @param filePath - Path to crewx.yaml or agents.yaml file
 * @param options - Parser options
 * @returns Parsed configuration
 *
 * @example
 * ```typescript
 * const config = parseCrewxConfigFromFile('./crewx.yaml');
 * ```
 */
export function parseCrewxConfigFromFile(
  filePath: string,
  options: Partial<SkillParserOptions> = {}
): CrewxProjectConfig {
  if (!filePath || typeof filePath !== 'string') {
    throw new SkillLoadError('File path is required and must be a non-empty string');
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new SkillLoadError(
      `Failed to read config file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  return parseCrewxConfig(fileContent, options);
}
