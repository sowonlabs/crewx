/**
 * Shared tool calling contracts consumed by both SDK providers and CLI adapters.
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

export interface ToolExecutionContext {
  input: Record<string, any>;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  agentId?: string;
  tracingContext?: {
    taskId?: string;
    parentSpan?: string;
  };
}

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

export interface ToolCallHandler {
  list(): Tool[];
  execute(
    name: string,
    input: Record<string, any>,
    context?: Partial<Omit<ToolExecutionContext, 'input'>>,
  ): Promise<ToolExecutionResult>;
}

