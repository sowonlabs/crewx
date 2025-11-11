import { z } from 'zod';

export const MCPServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional(),
});

export const APIProviderConfigSchema = z.object({
  provider: z.enum([
    'api/openai',
    'api/anthropic',
    'api/google',
    'api/bedrock',
    'api/litellm',
    'api/ollama',
    'api/sowonai',
  ]),
  url: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(z.string()).optional(),
  mcp: z.array(z.string()).optional(),
});
