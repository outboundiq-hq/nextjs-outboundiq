/**
 * Request context using AsyncLocalStorage
 * 
 * This allows us to track user context across the entire request lifecycle,
 * similar to how Laravel uses request context for Auth::user().
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { UserContext } from '@outboundiq/core';

/**
 * Request context stored for each request
 */
export interface RequestContext {
  /**
   * User context for this request
   */
  userContext: UserContext | null;

  /**
   * Request ID for tracing
   */
  requestId: string;

  /**
   * Request start time
   */
  startTime: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

// Create the AsyncLocalStorage instance
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get the current user context
 */
export function getCurrentUserContext(): UserContext | null {
  const context = getRequestContext();
  return context?.userContext ?? null;
}

/**
 * Set user context for the current request
 */
export function setCurrentUserContext(userContext: UserContext | null): void {
  const context = getRequestContext();
  if (context) {
    context.userContext = userContext;
  }
}

/**
 * Generate a request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new request context
 */
export function createRequestContext(
  userContext: UserContext | null = null,
  metadata?: Record<string, unknown>
): RequestContext {
  return {
    userContext,
    requestId: generateRequestId(),
    startTime: Date.now(),
    metadata,
  };
}

