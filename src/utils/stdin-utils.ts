/**
 * Utility for reading stdin input in CLI handlers
 */

import { getTimeoutConfig } from '../config/timeout.config';

/**
 * Read content from stdin if available (for pipe operations)
 * @returns Promise<string | null> - Returns piped content or null if no pipe
 */
export async function readStdin(): Promise<string | null> {
  const timeoutConfig = getTimeoutConfig();
  // Check if stdin is from a pipe (not a TTY)
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let data = '';
    let chunks = 0;
    let dataTimeout: NodeJS.Timeout | null = null;

    // Set encoding to handle text properly
    process.stdin.setEncoding('utf8');

    // Debug log
    const debug = process.env.DEBUG_STDIN === '1';
    if (debug) {
      console.error('[STDIN] Waiting for piped input...');
    }

    // Read data chunks
    const dataHandler = (chunk: string) => {
      chunks++;
      data += chunk;
      if (debug) {
        console.error(`[STDIN] Received chunk ${chunks}: "${chunk.substring(0, 50)}..."`);
      }

      // Reset timeout after each chunk - this allows for slow data arrival
      if (dataTimeout) {
        clearTimeout(dataTimeout);
      }

      // Check if this looks like the end of crewx output
      // (ends with "✅ Query completed successfully" or similar)
      const looksComplete = /✅.*completed successfully\s*$/.test(data);

      // Set a timeout for next chunk (if no more data comes, we're done)
      // Shorter timeout if output looks complete, longer otherwise
      const timeout = looksComplete ? timeoutConfig.stdinComplete : timeoutConfig.stdinChunk;
      dataTimeout = setTimeout(() => {
        cleanup();
        resolve(data.trim() || null);
      }, timeout);
    };

    // Handle end of input
    const endHandler = () => {
      cleanup();
      resolve(data.trim() || null);
    };

    // Handle errors
    const errorHandler = (error: Error) => {
      cleanup();
      reject(error);
    };

    // Cleanup function to remove listeners
    const cleanup = () => {
      if (dataTimeout) {
        clearTimeout(dataTimeout);
        dataTimeout = null;
      }
      process.stdin.removeListener('data', dataHandler);
      process.stdin.removeListener('end', endHandler);
      process.stdin.removeListener('error', errorHandler);
    };

    process.stdin.on('data', dataHandler);
    process.stdin.on('end', endHandler);
    process.stdin.on('error', errorHandler);

    // Initial timeout: if no data arrives in configured time, assume no input
    // This is longer to accommodate slow AI response times in piped crewx processes
    const initialTimeout = setTimeout(() => {
      if (chunks === 0) {
        if (debug) {
          console.error('[STDIN] Timeout - no data received');
        }
        cleanup();
        resolve(null);
      }
    }, timeoutConfig.stdinInitial);

    // Clear initial timeout when we get data or end
    process.stdin.once('data', () => clearTimeout(initialTimeout));
    process.stdin.once('end', () => clearTimeout(initialTimeout));
  });
}

/**
 * Extract actual AI response from formatted output
 * @param content - Raw piped content that may include formatting
 * @returns Clean AI response
 */
function extractAIResponse(content: string): string {
  const debug = process.env.DEBUG_STDIN === '1';

  // Try to extract content between "📄 Response:" and next section marker
  const responseMatch = content.match(/📄 Response:\s*\n[-─]+\s*\n([\s\S]*?)(?:\n\n📁|$)/);

  if (debug) {
    console.error(`[STDIN] Extract: input length=${content.length}, hasMatch=${!!responseMatch}`);
    if (responseMatch && responseMatch[1]) {
      console.error(`[STDIN] Extracted: "${responseMatch[1].substring(0, 100)}..."`);
    }
  }

  if (responseMatch && responseMatch[1]) {
    return responseMatch[1].trim();
  }

  // If no formatting found, return as-is (might be from --raw mode)
  return content.trim();
}

/**
 * Format piped content as context for agents
 * @param pipedContent - Content received from stdin
 * @returns Formatted context string
 */
export function formatPipedContext(pipedContent: string): string {
  // Extract the actual AI response if it's formatted output
  const cleanContent = extractAIResponse(pipedContent);

  return `Previous step result:\n${cleanContent}\n\nPlease use this information as context for the current task.`;
}

export interface StructuredContextPayload {
  version?: string;
  agent?: {
    id?: string | null;
    provider?: string;
    mode?: string;
    model?: string | null;
  };
  prompt?: string;
  context?: string;
  messages?: Array<{ text: string; isAssistant: boolean; metadata?: Record<string, any> }>;
  metadata?: {
    platform?: string;
    formattedHistory?: string;
    originalContext?: string;
    messageCount?: number;
    generatedAt?: string;
  };
}

export function parseStructuredPayload(input: string | null | undefined): StructuredContextPayload | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'prompt' in parsed && 'messages' in parsed) {
      const payload = parsed as StructuredContextPayload;
      if (!Array.isArray(payload.messages)) {
        payload.messages = [];
      }
      return payload;
    }
  } catch (error) {
    // Ignore JSON parse errors - fall back to legacy behavior
  }

  return null;
}

export function buildContextFromStructuredPayload(payload: StructuredContextPayload | null): string | undefined {
  if (!payload) {
    return undefined;
  }

  const hasMessages = Array.isArray(payload.messages) && payload.messages.length > 0;

  if (hasMessages) {
    const candidateWithMessages = payload.context && payload.context.trim();
    return candidateWithMessages || undefined;
  }

  const candidate = payload.context && payload.context.trim();
  if (candidate) {
    return candidate;
  }

  const formatted = payload.metadata?.formattedHistory && payload.metadata.formattedHistory.trim();
  if (formatted) {
    return formatted;
  }

  return undefined;
}
