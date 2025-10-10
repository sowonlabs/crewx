# Tool System Guide

Complete guide for the CrewX tool system, including creating custom tools and template integration.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Creating Custom Tools](#creating-custom-tools)
- [Built-in Tools](#built-in-tools)
- [Template Integration](#template-integration)
- [Best Practices](#best-practices)

## Overview

CrewX's tool system is designed to be compatible with the Mastra framework, enabling AI agents to safely and efficiently execute external tools.

**Key Features:**
- Mastra-compatible tool definitions
- Type-safe execution context
- Standardized result format
- Template integration for dynamic tool documentation
- Automatic tool registration

## Architecture

### Tool Definition

Tools are defined using this structure:

```typescript
interface Tool {
  name: string;                    // Unique tool identifier
  description: string;             // Description for AI agent selection
  input_schema: {                  // Input parameter definition
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  output_schema?: {                // Output structure (optional)
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### Execution Context

Tools receive rich context information during execution:

```typescript
interface ToolExecutionContext {
  input: Record<string, any>;      // Tool input parameters
  runId?: string;                   // Execution tracking ID
  threadId?: string;                // Conversation thread ID
  resourceId?: string;              // Resource/user identifier
  agentId?: string;                 // Calling agent ID
  tracingContext?: {                // Tracing/logging context
    taskId?: string;
    parentSpan?: string;
  };
}
```

### Execution Result

Standardized execution result format:

```typescript
interface ToolExecutionResult<T = any> {
  success: boolean;                 // Execution success status
  data?: T;                         // Result data
  error?: string;                   // Error message
  metadata?: {                      // Metadata
    executionTime?: number;
    toolName?: string;
    runId?: string;
  };
}
```

## Creating Custom Tools

### Basic Example

```typescript
import { ToolCallService, Tool, ToolExecutor, ToolExecutionContext, ToolExecutionResult } from '@/services/tool-call.service';

// 1. Define the tool
const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  input_schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The arithmetic operation to perform'
      },
      a: {
        type: 'number',
        description: 'First number'
      },
      b: {
        type: 'number',
        description: 'Second number'
      }
    },
    required: ['operation', 'a', 'b']
  }
};

// 2. Implement the executor
const calculatorExecutor: ToolExecutor = {
  execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const startTime = Date.now();

    try {
      const { operation, a, b } = context.input;

      // Validate input
      if (typeof a !== 'number' || typeof b !== 'number') {
        return {
          success: false,
          error: 'Both a and b must be numbers'
        };
      }

      // Perform calculation
      let result: number;
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return { success: false, error: 'Division by zero' };
          }
          result = a / b;
          break;
        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }

      return {
        success: true,
        data: { result, operation },
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: 'calculator'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Execution failed: ${error.message}`
      };
    }
  }
};

// 3. Register the tool
@Injectable()
export class CustomToolsService {
  constructor(private readonly toolCallService: ToolCallService) {
    this.registerTools();
  }

  private registerTools(): void {
    this.toolCallService.register(calculatorTool, calculatorExecutor);
  }
}
```

### Advanced Example with External API

```typescript
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather information for a location',
  input_schema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or location'
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature units',
        default: 'celsius'
      }
    },
    required: ['location']
  }
};

const weatherExecutor: ToolExecutor = {
  execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const startTime = Date.now();

    try {
      const { location, units = 'celsius' } = context.input;

      // Call external weather API
      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=YOUR_API_KEY&q=${encodeURIComponent(location)}`
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Weather API error: ${response.statusText}`
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          temperature: units === 'celsius' ? data.current.temp_c : data.current.temp_f,
          humidity: data.current.humidity,
          conditions: data.current.condition.text,
          location: data.location.name
        },
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: 'get_weather'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch weather: ${error.message}`
      };
    }
  }
};
```

## Built-in Tools

### read_file

Reads file contents from the filesystem.

**Input:**
```json
{
  "path": "string"  // File path to read
}
```

**Output:**
```json
{
  "content": "string"  // File contents
}
```

**Usage Example:**
```bash
crewx query "@gemini README.md 파일을 읽고 요약해줘"
```

## Template Integration

### Using Tools in Agent Prompts

Tools registered at runtime are automatically available in agent templates via the `tools` variable.

#### Template Variables

```yaml
{{#if tools}}
  # Tools are available
  {{tools.count}}        # Number of available tools
  {{{tools.json}}}       # All tools as formatted JSON
  {{#each tools.list}}   # Iterate through tools
    {{this.name}}
    {{this.description}}
  {{/each}}
{{else}}
  # No tools available
{{/if}}
```

#### Tools Object Structure

```typescript
tools: {
  count: number;          // Number of available tools
  json: string;           // JSON string of tool definitions
  list: Array<{           // Array of tool definitions
    name: string;
    description: string;
    input_schema: object;
    output_schema?: object;
  }>;
}
```

### Usage Examples

#### Example 1: Basic Tool Awareness

```yaml
agents:
  - id: "my_agent"
    inline:
      system_prompt: |
        You are an AI assistant.

        {{#if tools}}
        You have access to {{tools.count}} tool(s).
        Use them when appropriate to provide accurate information.
        {{else}}
        Respond based on your knowledge without tools.
        {{/if}}
```

#### Example 2: Detailed Tool Instructions

```yaml
agents:
  - id: "tool_expert"
    inline:
      system_prompt: |
        You are a helpful AI assistant.

        {{#if tools}}
        ## Available Tools

        You have {{tools.count}} tool(s) at your disposal:

        <tools>
        {{{tools.json}}}
        </tools>

        **Instructions:**
        1. Analyze user requests carefully
        2. Use tools when they provide accurate, real-time data
        3. Explain what tool you're using and why
        4. Always validate tool results before responding
        {{/if}}

        ## Your Task
        Answer questions clearly and use tools effectively.
```

#### Example 3: Conditional Tool Guidance

```yaml
agents:
  - id: "smart_agent"
    inline:
      system_prompt: |
        You are an AI assistant.

        {{#if tools}}
          {{#if (eq tools.count 1)}}
          You have access to 1 tool. Use it wisely.
          {{else}}
          You have access to {{tools.count}} tools. Choose the most appropriate one.
          {{/if}}

          <available-tools>
          {{{tools.json}}}
          </available-tools>
        {{else}}
          Note: No tools are currently available.
        {{/if}}
```

#### Example 4: Custom Tool List Formatting

```yaml
agents:
  - id: "custom_format_agent"
    inline:
      system_prompt: |
        You are an AI assistant with tool capabilities.

        {{#if tools}}
        ## Your Toolkit ({{tools.count}} tools)

        {{#each tools.list}}
        ### {{this.name}}
        - **Description:** {{this.description}}
        - **Required Parameters:** {{#each this.input_schema.required}}{{this}}, {{/each}}

        {{/each}}

        Use these tools to enhance your responses.
        {{/if}}
```

### Dynamic Tool Registration

Tools registered at runtime are automatically included in template context:

```typescript
// In your custom service
toolCallService.register(
  {
    name: 'custom_tool',
    description: 'My custom tool',
    input_schema: { /* ... */ }
  },
  {
    execute: async (context) => { /* ... */ }
  }
);

// Agent templates automatically see this new tool
// No need to update agent configs!
```

## Best Practices

### 1. Always Validate Input

```typescript
execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
  const { input } = context;

  // Validate required fields
  if (!input.field1 || !input.field2) {
    return {
      success: false,
      error: 'Missing required fields: field1, field2'
    };
  }

  // Validate types
  if (typeof input.field1 !== 'string') {
    return {
      success: false,
      error: 'field1 must be a string'
    };
  }

  // Continue with execution...
}
```

### 2. Handle Errors Gracefully

```typescript
execute: async (context: ToolExecutionContext): Promise<ToolExecutionResult> => {
  try {
    // Tool logic
    return { success: true, data: result };
  } catch (error: any) {
    return {
      success: false,
      error: `Tool execution failed: ${error.message}`,
      metadata: {
        toolName: 'my_tool',
        runId: context.runId,
      }
    };
  }
}
```

### 3. Provide Execution Metadata

```typescript
const startTime = Date.now();

return {
  success: true,
  data: result,
  metadata: {
    executionTime: Date.now() - startTime,
    toolName: 'my_tool',
    runId: context.runId,
  }
};
```

### 4. Use Descriptive Tool Names and Descriptions

```typescript
{
  name: 'search_database',  // Clear, action-oriented
  description: 'Search the product database by name, category, or SKU. Returns matching products with details.',  // Detailed for AI understanding
}
```

### 5. Check Tool Availability in Templates

```yaml
{{#if tools}}
  # Tool-specific instructions
{{else}}
  # Fallback behavior
{{/if}}
```

### 6. Provide Clear Tool Usage Guidelines

```yaml
{{#if tools}}
**When to use tools:**
- For reading files: use read_file
- For calculations: use calculator
- For API calls: use http_request

**When NOT to use tools:**
- For general knowledge questions
- For creative writing
- For mathematical proofs (unless calculation needed)
{{/if}}
```

## Tool Execution Flow

1. **Tool Registration**: Tool registered with ToolCallService at service startup
2. **AI Request**: AI agent analyzes user request
3. **Tool Selection**: AI selects appropriate tool
4. **Input Validation**: Tool input parameters validated
5. **Execution**: Tool executor runs
6. **Result Formatting**: Structured result returned
7. **AI Response**: AI uses tool result to generate response

## Debugging Tools

### View Available Tools

```typescript
const tools = toolCallService.list();
console.log('Available tools:', tools.map(t => t.name));
```

### Check Tool Existence

```typescript
if (toolCallService.has('my_tool')) {
  console.log('Tool is registered');
}
```

### Direct Tool Execution

```typescript
const result = await toolCallService.execute('calculator', {
  operation: 'add',
  a: 5,
  b: 3
}, {
  runId: 'test-run-123',
  agentId: 'test-agent'
});

console.log('Result:', result);
```

## Benefits

✅ **Mastra Compatible** - Works with Mastra framework
✅ **Type Safe** - Full TypeScript support
✅ **Template Integration** - Automatic tool documentation in agent prompts
✅ **Dynamic Registration** - Tools added at runtime appear in templates
✅ **Standardized Results** - Consistent success/error handling
✅ **Rich Context** - Execution tracking and tracing support

## See Also

- [Agent Configuration Guide](agent-configuration.md) - Agent setup
- [Template System Guide](templates.md) - Template integration
- [CLI Guide](cli-guide.md) - Command-line usage
