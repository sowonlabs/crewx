/**
 * Skills Module Index
 * Exports all skill runtime components for WBS-17 Phase 1
 *
 * WBS-17 Phase 1: SkillRuntime Design
 */

// Main interfaces and types
export * from '../types/skill-runtime.types';

// Progressive loading
export { ProgressiveSkillLoader } from './runtime/progressive-loader';

// Claude skill adapter
export { ClaudeSkillAdapter } from './adapter/claude-skill-adapter';

// Runtime validation
export { SystemRuntimeValidator, MockRuntimeValidator } from './runtime/runtime-requirements-validator';

// Re-export schema types for convenience (excluding duplicates)
export type {
  SkillMetadata,
  SkillContent,
  SkillDefinition,
  SkillsConfig,
  CrewxProjectConfig,
  AgentDefinition,
  SkillParserOptions,
  SkillManifest,
} from '../schema/skills.types';

export {
  SkillLoadError,
  SkillNotFoundError,
  SkillDependencyError,
  SkillVersionMismatchError,
} from '../schema/skills.types';
