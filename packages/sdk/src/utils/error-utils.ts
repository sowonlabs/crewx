/**
 * Utility functions for safe error handling in TypeScript strict mode
 */

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}