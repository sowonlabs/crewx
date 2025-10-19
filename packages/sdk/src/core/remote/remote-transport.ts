/**
 * Remote Transport Implementation
 *
 * HTTP transport for communicating with remote MCP servers.
 * Pure TypeScript implementation without NestJS dependencies.
 */

import { RemoteTransport, RemoteTransportRequestOptions } from './types';

/**
 * Default HTTP transport using native fetch API
 */
export class FetchRemoteTransport implements RemoteTransport {
  async request<T = any>(
    url: string,
    options: RemoteTransportRequestOptions,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}${text ? ` - ${text}` : ''}`,
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }

      throw error;
    }
  }
}

/**
 * Mock transport for testing
 */
export class MockRemoteTransport implements RemoteTransport {
  private mockResponses = new Map<string, any>();
  private requestLog: Array<{ url: string; options: RemoteTransportRequestOptions }> = [];

  setMockResponse(pattern: string | RegExp, response: any): void {
    const key = pattern instanceof RegExp ? pattern.source : pattern;
    this.mockResponses.set(key, response);
  }

  getRequestLog(): Array<{ url: string; options: RemoteTransportRequestOptions }> {
    return [...this.requestLog];
  }

  clearRequestLog(): void {
    this.requestLog = [];
  }

  async request<T = any>(
    url: string,
    options: RemoteTransportRequestOptions,
  ): Promise<T> {
    this.requestLog.push({ url, options });

    // Find matching mock response
    for (const [pattern, response] of this.mockResponses) {
      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        if (typeof response === 'function') {
          return response(url, options);
        }
        return response as T;
      }
    }

    throw new Error(`No mock response configured for URL: ${url}`);
  }
}
