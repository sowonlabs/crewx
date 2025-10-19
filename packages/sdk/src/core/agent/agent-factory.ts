/**
 * Factory function for creating CrewX agents.
 * This is the main entry point for SDK consumers.
 */

import { AgentRuntime, AgentRuntimeOptions } from './agent-runtime';
import { EventBus, EventListener } from './event-bus';

export interface ProviderConfig {
  namespace: string;
  id: string;
  apiKey?: string;
  model?: string;
}

export interface KnowledgeBaseConfig {
  path?: string;
  sources?: string[];
}

export interface CrewxAgentConfig {
  provider?: ProviderConfig;
  knowledgeBase?: KnowledgeBaseConfig;
  enableCallStack?: boolean;
  defaultAgentId?: string;
}

export interface CrewxAgent {
  /**
   * Execute a query (read-only mode).
   */
  query: AgentRuntime['query'];

  /**
   * Execute an action (write mode).
   */
  execute: AgentRuntime['execute'];

  /**
   * Get the current call stack (if enabled).
   */
  getCallStack: AgentRuntime['getCallStack'];
}

export interface CrewxAgentResult {
  /**
   * The agent instance with query/execute methods.
   */
  agent: CrewxAgent;

  /**
   * Subscribe to agent events.
   * @param eventName - Event to listen for (e.g., 'callStackUpdated', 'agentStarted')
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  onEvent: <T = any>(eventName: string, listener: EventListener<T>) => () => void;

  /**
   * Access the underlying event bus for advanced usage.
   */
  eventBus: EventBus;
}

/**
 * Create a CrewX agent with the specified configuration.
 *
 * @example
 * ```ts
 * const { agent, onEvent } = await createCrewxAgent({
 *   provider: { namespace: 'cli', id: 'codex', apiKey: process.env.CODEX_TOKEN },
 *   enableCallStack: true,
 * });
 *
 * onEvent('callStackUpdated', (stack) => {
 *   console.log('Call stack:', stack);
 * });
 *
 * const result = await agent.query({
 *   prompt: 'What is the current status?',
 *   context: 'Project: CrewX',
 * });
 * ```
 */
export async function createCrewxAgent(
  config: CrewxAgentConfig = {},
): Promise<CrewxAgentResult> {
  // Create event bus
  const eventBus = new EventBus();

  // Create runtime options
  const runtimeOptions: AgentRuntimeOptions = {
    eventBus,
    enableCallStack: config.enableCallStack ?? false,
    defaultAgentId: config.defaultAgentId ?? 'crewx',
  };

  // Initialize runtime
  const runtime = new AgentRuntime(runtimeOptions);

  // Create agent interface
  const agent: CrewxAgent = {
    query: runtime.query.bind(runtime),
    execute: runtime.execute.bind(runtime),
    getCallStack: runtime.getCallStack.bind(runtime),
  };

  // Return agent with event subscription interface
  return {
    agent,
    onEvent: (eventName, listener) => eventBus.on(eventName, listener),
    eventBus,
  };
}

/**
 * Load agent configuration from YAML string.
 * Re-exported from config/yaml-loader for convenience.
 *
 * @see loadAgentConfigFromYaml in config/yaml-loader.ts for implementation
 */
export { loadAgentConfigFromYaml, loadAgentConfigFromFile } from '../../config/yaml-loader';
