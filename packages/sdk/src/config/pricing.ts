/**
 * AI Model Pricing Configuration
 *
 * Prices are per 1M tokens (input/output)
 * All values in USD
 */

export interface ModelPricing {
  /** Price per 1M input tokens in USD */
  input: number;
  /** Price per 1M output tokens in USD */
  output: number;
}

export interface PricingTable {
  [modelKey: string]: ModelPricing;
}

/**
 * Model pricing table
 *
 * Format: model-name -> { input: $X per 1M tokens, output: $Y per 1M tokens }
 */
export const MODEL_PRICING: PricingTable = {
  // Claude models
  'claude-opus': { input: 15, output: 75 },
  'opus': { input: 15, output: 75 },
  'claude-sonnet': { input: 3, output: 15 },
  'sonnet': { input: 3, output: 15 },
  'claude-haiku': { input: 0.25, output: 1.25 },
  'haiku': { input: 0.25, output: 1.25 },

  // Gemini models
  'gemini-3-pro-preview': { input: 1.25, output: 5 },
  'gemini-2-flash': { input: 0.075, output: 0.30 },
  'gemini-flash': { input: 0.075, output: 0.30 },

  // Default fallback
  'default': { input: 1, output: 1 },
};

/**
 * Get pricing for a model
 *
 * @param model Model name (e.g., "claude-sonnet-4-5", "gemini-2-flash")
 * @returns Pricing information for the model, or default pricing if not found
 */
export function getPricing(model: string | null | undefined): ModelPricing {
  const defaultPricing = MODEL_PRICING['default'] as ModelPricing;

  if (!model) {
    return defaultPricing;
  }

  // Normalize model name to lowercase for case-insensitive matching
  const normalizedModel = model.toLowerCase();

  // Try exact match first
  const exactMatch = MODEL_PRICING[normalizedModel];
  if (exactMatch) {
    return exactMatch;
  }

  // Try partial matches (e.g., "claude-sonnet-4-5" -> "sonnet")
  for (const key of Object.keys(MODEL_PRICING)) {
    if (normalizedModel.includes(key)) {
      const partialMatch = MODEL_PRICING[key];
      if (partialMatch) {
        return partialMatch;
      }
    }
  }

  // Fallback to default
  return defaultPricing;
}

/**
 * Calculate cost in USD based on token usage
 *
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @param model Model name
 * @returns Cost in USD
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string | null | undefined
): number {
  const pricing = getPricing(model);

  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;

  return inputCost + outputCost;
}
