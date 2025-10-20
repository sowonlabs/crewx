/**
 * Public API surface for the CrewX SDK.
 * Export only the symbols that are safe for external consumers.
 */

// Constants
export {
  SERVER_NAME,
  PREFIX_TOOL_NAME,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
} from './constants';

// Configuration
export type { TimeoutConfig } from './config/timeout.config';
export { getTimeoutConfig, getDefaultTimeoutConfig } from './config/timeout.config';

// Conversation contracts
export type {
  BaseMessage,
  ConversationMessage,
  ConversationThread,
  FetchHistoryOptions,
  IConversationHistoryProvider,
} from './conversation/conversation-history.interface';
export type { ConversationConfig } from './conversation/conversation-config';
export {
  DEFAULT_CONVERSATION_CONFIG,
  getConversationConfig,
} from './conversation/conversation-config';

// Knowledge utilities
export { DocumentManager } from './knowledge/DocumentManager';

// Provider contracts
export {
  ProviderNamespace,
  BuiltInProviders,
  ProviderNotAvailableError,
} from './core/providers/ai-provider.interface';
export type {
  ProviderNamespaceType,
  AIProvider,
  AIQueryOptions,
  AIResponse,
} from './core/providers/ai-provider.interface';
export { BaseAIProvider } from './core/providers/base-ai.provider';
export {
  ClaudeProvider,
  GeminiProvider,
  CopilotProvider,
  CodexProvider,
  BaseDynamicProviderFactory,
  MockProvider,
  createProviderFromConfig,
} from './core/providers';
export type {
  BaseAIProviderOptions,
  LoggerLike,
  AIProviderConfig,
} from './core/providers/base-ai.types';
export type {
  PluginProviderConfig,
  RemoteProviderConfig,
  DynamicProviderConfig,
  DynamicProviderFactoryOptions,
} from './core/providers/dynamic-provider.factory';
export type {
  ProviderConfig,
  ProviderInput,
  ProviderResolutionResult,
} from './types/provider.types';
export type {
  Tool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolCallHandler,
} from './core/providers/tool-call.types';

// Agent domain types
export type {
  AgentAction,
  AgentConfig,
  AgentsConfig,
  AgentInfo,
  AgentQueryOptions,
  AgentResponse,
  RemoteAgentConfigInput,
  RemoteAgentInfo,
} from './types/agent.types';
export { ExecutionMode, SecurityLevel } from './types/agent.types';

// Shared utilities
export { getErrorMessage, getErrorStack, isError } from './utils/error-utils';
export {
  MentionParser,
  loadAvailableAgents,
  type MentionTask,
  type ParsedMentions,
} from './utils/mention-parser';
export {
  BaseMessageFormatter,
  DefaultMessageFormatter,
  type StructuredMessage as FormatterStructuredMessage,
  type FormatterOptions,
} from './utils/base-message-formatter';

// Structured payload types (NEW: WBS-10 Phase 1)
export type {
  StructuredPayload,
  StructuredMessage,
  AgentInfo as StructuredAgentInfo,
  StructuredPayloadMetadata,
} from './types/structured-payload.types';
export {
  isStructuredPayload,
  parseStructuredPayload,
  createStructuredPayload,
} from './types/structured-payload.types';

// Agent creation and runtime (NEW: WBS-8, enhanced in WBS-10)
export {
  createCrewxAgent,
  loadAgentConfigFromYaml,
  loadAgentConfigFromFile,
  resolveProvider,
  type CrewxAgent,
  type CrewxAgentConfig,
  type CrewxAgentResult,
  type ProviderConfig as AgentProviderConfig,
  type KnowledgeBaseConfig,
} from './core/agent';
export {
  type AgentQueryRequest,
  type AgentExecuteRequest,
  type AgentResult,
  type AgentRuntimeOptions,
  type CallStackFrame,
  type EventListener,
} from './core/agent';

// Remote agent management (NEW: WBS-9 Phase 3)
export {
  RemoteAgentManager,
  FetchRemoteTransport,
  MockRemoteTransport,
  type RemoteAgentManagerOptions,
} from './core/remote';
export type {
  RemoteAgentConfig,
  RemoteTransport,
  RemoteTransportRequestOptions,
  RemoteAgentQueryRequest,
  RemoteAgentExecuteRequest,
  RemoteAgentResponse,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  ToolNameMapping,
  RemoteAgentDescriptor,
} from './core/remote';

// Parallel execution (NEW: WBS-9 Phase 4)
export {
  ParallelRunner,
  ParallelRunnerTimeoutError,
  createDefaultParallelRunner,
  runQueriesParallel,
  runExecutesParallel,
} from './core/parallel';
export type {
  ParallelRunnerMetrics,
  ParallelRunnerOptions,
  Task,
  TaskResult,
  TaskCallbacks,
  TaskExecutionContext,
  ParallelConfig,
  HelperResult,
  RetryPolicy,
} from './core/parallel';

// Layout system (WBS-12)
export {
  PropsValidator,
  type ValidationMode,
} from './services/props-validator.service';
export type {
  PropSchema,
  ValidationResult as PropsValidationResult,
  ValidationError as PropsValidationDetail,
} from './types/layout.types';

// Layout system (NEW: WBS-12 Phase 3, enhanced WBS-13)
export { LayoutLoader } from './services/layout-loader.service';
export {
  LayoutRenderer,
  PropsValidationError,
  type RenderOptions,
} from './services/layout-renderer.service';
export type {
  RenderContext,
  LayoutDefinition,
  ValidationResult,
  ValidationError,
  LoaderOptions,
  LayoutLoadError,
  InlineLayoutSpec,
  CustomLayoutDefinition,
} from './types/layout.types';

// Template system (WBS-14 Phase 3)
export type {
  BaseContext,
  TemplateContext,
  AgentMetadata,
  TemplateVars,
} from './types/template.types';

// Skills schema (WBS-16 Phase 1)
export type {
  SkillMetadata,
  SkillContent,
  SkillDefinition,
  SkillsConfig,
  CrewxProjectConfig,
  AgentDefinition,
  SkillParserOptions,
  SkillManifest,
} from './schema/skills.types';
export {
  SkillLoadError,
  SkillNotFoundError,
  SkillDependencyError,
  SkillVersionMismatchError,
} from './schema/skills.types';

// Skills parser (WBS-16 Phase 2)
export {
  parseCrewxConfig,
  parseCrewxConfigFromFile,
  parseSkillManifest,
  parseSkillManifestFromFile,
  validateSkillMetadata,
  loadSkillContent,
  clearSkillCache,
} from './schema/skills-parser';

// Skill Runtime (WBS-17 Phase 1)
export {
  ProgressiveSkillLoader,
  ClaudeSkillAdapter,
  SystemRuntimeValidator,
  MockRuntimeValidator,
} from './skills';
export type {
  ISkillRuntime,
  IProgressiveSkillLoader,
  IClaudeSkillAdapter,
  RuntimeRequirementsValidator,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillLoadOptions,
  SkillCacheStats,
  SkillRuntimeInfo,
  SkillRuntimeEvents,
  SkillRuntimeError,
  ProgressiveLoadingError,
  SkillExecutionError,
  SkillContextError,
  SDKExecutionContext,
  CLIExecutionContext,
  ProgressiveDisclosureConfig,
  RuntimeInfo,
  SkillBundleInfo,
} from './skills';
