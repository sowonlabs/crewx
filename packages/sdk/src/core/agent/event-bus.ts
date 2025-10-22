/**
 * Event bus for CrewX agent runtime events.
 * Supports call stack updates, tool calls, and other agent lifecycle events.
 */

export type EventListener<T = any> = (payload: T) => void | Promise<void>;

export interface CallStackFrame {
  depth: number;
  agentId: string;
  provider: string;
  mode: 'query' | 'execute';
  taskId?: string;
  enteredAt: string;
}

export type AgentEvent =
  | { type: 'callStackUpdated'; payload: CallStackFrame[] }
  | { type: 'agentStarted'; payload: { agentId: string; mode: 'query' | 'execute' } }
  | { type: 'agentCompleted'; payload: { agentId: string; success: boolean } }
  | { type: 'toolCallStarted'; payload: { toolName: string; args: any } }
  | { type: 'toolCallCompleted'; payload: { toolName: string; result: any } };

export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * Subscribe to an event.
   * @param eventName - Name of the event to listen to
   * @param listener - Callback function to invoke when event fires
   * @returns Unsubscribe function
   */
  on<T = any>(eventName: string, listener: EventListener<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener as EventListener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventName);
      if (listeners) {
        listeners.delete(listener as EventListener);
        if (listeners.size === 0) {
          this.listeners.delete(eventName);
        }
      }
    };
  }

  /**
   * Emit an event to all registered listeners.
   * @param eventName - Name of the event to emit
   * @param payload - Data to pass to listeners
   */
  async emit<T = any>(eventName: string, payload: T): Promise<void> {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;

    const promises = Array.from(listeners).map((listener) =>
      Promise.resolve(listener(payload)),
    );
    await Promise.all(promises);
  }

  /**
   * Remove all listeners for a specific event or all events.
   * @param eventName - Optional event name to clear (if omitted, clears all)
   */
  clear(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }
}
