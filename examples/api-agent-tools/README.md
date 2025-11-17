# Tool Calling Example

This example demonstrates how to create agents with custom tools using CrewX's function injection pattern.

## Overview

This example shows:
- Function injection pattern (SowonFlow-style)
- Custom tool definitions with Zod validation
- Tool execution with context access
- Multi-step tool calling
- Error handling in tools

## Architecture

```
User Code (tools defined in TypeScript)
    ↓
CrewX Framework (tools injected)
    ↓
MastraAPIProvider (tools converted)
    ↓
Mastra Agent (tools executed)
    ↓
Tool Results → Final Response
```

## Prerequisites

- Node.js 18+
- CrewX CLI installed
- API keys (OpenAI, Anthropic, etc.)
- Weather API key (OpenWeatherMap)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Weather API (https://openweathermap.org/api)
WEATHER_API_KEY=...

# Company API (example)
COMPANY_API_KEY=...
```

### 3. Build TypeScript

```bash
npm run build
```

## Project Structure

```
examples/api-agent-tools/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
├── crewx.yaml                    # Agent configuration
├── src/
│   ├── index.ts                   # Main entry point
│   ├── tools/
│   │   ├── weather.tool.ts        # Weather tool
│   │   ├── company.tool.ts        # Company search tool
│   │   └── calculator.tool.ts     # Calculator tool
│   └── types/
│       └── context.ts             # Context types
└── dist/                          # Compiled JavaScript
```

## Examples

### Example 1: Weather Tool

**File**: `src/tools/weather.tool.ts`

```typescript
import { z } from 'zod';
import { FrameworkToolDefinition } from '@crewx/sdk';

export const weatherTool: FrameworkToolDefinition = {
  name: 'weather',
  description: 'Get current weather for a city. Returns temperature, humidity, and conditions.',

  // Zod schema for input validation
  parameters: z.object({
    city: z.string().min(1).describe('City name (e.g., "Seoul", "Tokyo")'),
    units: z.enum(['celsius', 'fahrenheit'])
      .optional()
      .default('celsius')
      .describe('Temperature units'),
  }),

  // Execute function with context
  execute: async ({ city, units }, context) => {
    // Access environment variables
    const apiKey = context.env.WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    // Log with agent info
    console.log(`[${context.agent.id}] Weather request for ${city}`);

    // Make API call
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        city: data.name,
        temperature: data.main.temp,
        humidity: data.main.humidity,
        conditions: data.weather[0].description,
        units,
      };
    } catch (error) {
      console.error(`Weather tool error: ${error.message}`);
      return {
        error: true,
        message: `Failed to fetch weather: ${error.message}`
      };
    }
  },
};
```

**Usage**:

```bash
npm start -- "What's the weather in Seoul?"
```

**Expected Output**:

```
Agent: research_agent
Provider: api/openai
Model: gpt-4o

The current weather in Seoul is 15°C with clear skies.
Humidity is at 60%.

[Tool Calls]
- weather(city="Seoul", units="celsius")
  Result: { temperature: 15, conditions: "clear sky", humidity: 60 }
```

### Example 2: Company Search Tool

**File**: `src/tools/company.tool.ts`

```typescript
import { z } from 'zod';
import { FrameworkToolDefinition } from '@crewx/sdk';

export const companySearchTool: FrameworkToolDefinition = {
  name: 'company_search',
  description: 'Search company database for information about companies.',

  parameters: z.object({
    query: z.string().describe('Company name or search query'),
    limit: z.number().int().positive().optional().default(5),
  }),

  execute: async ({ query, limit }, context) => {
    // Access custom variables from YAML
    const apiVersion = context.vars?.apiVersion || 'v1';

    console.log(`[${context.agent.id}] Company search: "${query}"`);

    // Mock company search (replace with real API)
    const mockCompanies = [
      {
        name: 'OpenAI',
        industry: 'Artificial Intelligence',
        founded: 2015,
        description: 'AI research and deployment company',
      },
      {
        name: 'Anthropic',
        industry: 'Artificial Intelligence',
        founded: 2021,
        description: 'AI safety and research company',
      },
    ];

    const results = mockCompanies.filter(company =>
      company.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);

    return {
      results,
      count: results.length,
      query,
    };
  },
};
```

### Example 3: Calculator Tool

**File**: `src/tools/calculator.tool.ts`

```typescript
import { z } from 'zod';
import { FrameworkToolDefinition } from '@crewx/sdk';

export const calculatorTool: FrameworkToolDefinition = {
  name: 'calculator',
  description: 'Perform basic mathematical calculations',

  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),

  execute: async ({ operation, a, b }, context) => {
    console.log(`[${context.agent.id}] Calculate: ${a} ${operation} ${b}`);

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
          return {
            error: true,
            message: 'Division by zero',
          };
        }
        result = a / b;
        break;
    }

    return {
      operation,
      a,
      b,
      result,
    };
  },
};
```

### Example 4: Tool Injection

**File**: `src/index.ts`

```typescript
import { CrewX } from '@crewx/sdk';
import { weatherTool } from './tools/weather.tool';
import { companySearchTool } from './tools/company.tool';
import { calculatorTool } from './tools/calculator.tool';

// Initialize CrewX with tool injection
const crewx = new CrewX({
  configPath: './crewx.yaml',

  // Function injection: tools defined in TypeScript
  tools: [
    weatherTool,
    companySearchTool,
    calculatorTool,
  ],
});

async function main() {
  const input = process.argv.slice(2).join(' ') || 'What is the weather in Seoul?';

  console.log(`\n🤖 Query: ${input}\n`);

  const response = await crewx.runAgent('research_agent', {
    input,
    maxSteps: 10,  // Allow multi-step tool calling
  });

  console.log(`\n📋 Response:\n${response.content}\n`);

  if (response.toolCall) {
    console.log('🔧 Tool Calls:', response.toolCall);
  }
}

main().catch(console.error);
```

### Example 5: YAML Configuration

**File**: `crewx.yaml`

```yaml
vars:
  company_name: MyCompany
  api_version: v2

agents:
  - id: research_agent
    name: Research Agent
    provider: api/openai
    model: gpt-4o
    temperature: 0.7
    tools: [weather, company_search, calculator]  # Activate injected tools
    inline:
      prompt: |
        You are a research agent for {{vars.company_name}}.

        Available tools:
        - weather: Get current weather for any city
        - company_search: Search company information
        - calculator: Perform calculations

        Use these tools to answer user queries accurately.
```

## Running Examples

### Basic Tool Call

```bash
npm start -- "What's the weather in Tokyo?"
```

### Multi-Step Tool Call

```bash
npm start -- "Get weather in Seoul and calculate the temperature in Fahrenheit"

# Agent workflow:
# 1. Calls weather(city="Seoul", units="celsius")
# 2. Calls calculator(operation="multiply", a=15, b=1.8)
# 3. Calls calculator(operation="add", a=27, b=32)
# 4. Returns: "Weather in Seoul: 59°F"
```

### Company Search

```bash
npm start -- "Tell me about OpenAI"

# Agent workflow:
# 1. Calls company_search(query="OpenAI")
# 2. Returns company information
```

### Complex Query

```bash
npm start -- "Find companies in AI industry and get weather in their locations"

# Agent workflow:
# 1. Calls company_search(query="AI")
# 2. For each company, calls weather(city=location)
# 3. Synthesizes results
```

## Advanced Features

### Context Access

Tools can access rich context:

```typescript
execute: async (args, context) => {
  // Agent info
  console.log(`Agent: ${context.agent.id}`);
  console.log(`Provider: ${context.agent.provider}`);
  console.log(`Model: ${context.agent.model}`);

  // Environment variables
  const apiKey = context.env.API_KEY;

  // Custom variables from YAML
  const companyName = context.vars?.companyName;

  // Execution mode
  if (context.mode === 'execute') {
    // Write operations allowed
  }

  // Inter-agent communication
  if (context.crewx) {
    const result = await context.crewx.runAgent('other_agent', {
      input: 'subtask',
    });
  }
}
```

### Error Handling

```typescript
execute: async (args, context) => {
  try {
    const result = await riskyOperation(args);
    return result;
  } catch (error) {
    console.error(`Tool error: ${error.message}`);

    // Return error result (agent will handle)
    return {
      error: true,
      message: error.message,
    };
  }
}
```

### Input Validation

```typescript
parameters: z.object({
  email: z.string().email(),
  age: z.number().int().positive().max(150),
  role: z.enum(['admin', 'user', 'guest']),
}),
```

### Async Operations

```typescript
execute: async (args, context) => {
  // Parallel API calls
  const [weather, company] = await Promise.all([
    fetchWeather(args.city),
    fetchCompany(args.companyName),
  ]);

  return { weather, company };
}
```

## Testing

### Unit Test Tools

```bash
npm test
```

**File**: `src/tools/__tests__/weather.tool.test.ts`

```typescript
import { weatherTool } from '../weather.tool';

describe('weatherTool', () => {
  it('should fetch weather data', async () => {
    const mockContext = {
      agent: { id: 'test_agent', provider: 'api/openai', model: 'gpt-4' },
      env: { WEATHER_API_KEY: 'test_key' },
      vars: {},
    };

    const result = await weatherTool.execute(
      { city: 'Seoul', units: 'celsius' },
      mockContext
    );

    expect(result).toHaveProperty('temperature');
    expect(result).toHaveProperty('conditions');
  });
});
```

### Integration Test

```bash
npm run test:integration
```

## Troubleshooting

### Tool Not Found

```
Error: Agent called tool 'weather' but tool not found
```

**Solution**: Ensure tool is injected and activated:

```typescript
// Inject tool
const crewx = new CrewX({
  tools: [weatherTool],  // Must inject
});
```

```yaml
# Activate tool
agents:
  - id: my_agent
    tools: [weather]  # Must activate
```

### API Key Missing

```
Error: WEATHER_API_KEY not configured
```

**Solution**: Set environment variable:

```bash
export WEATHER_API_KEY=your_key
```

### Tool Execution Timeout

Increase timeout:

```typescript
const response = await crewx.runAgent('agent', {
  input: 'query',
  timeout: 60000,  // 60 seconds
});
```

## Next Steps

- **MCP Integration**: See [../api-agent-mcp/](../api-agent-mcp/)
- **API Reference**: See [../../docs/api-provider-reference.md](../../docs/api-provider-reference.md)
- **User Guide**: See [../../docs/api-provider-guide.md](../../docs/api-provider-guide.md)

## License

MIT
