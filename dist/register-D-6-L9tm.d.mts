import { UserContext } from '@outboundiq/core';

/**
 * Request context using AsyncLocalStorage
 *
 * This allows us to track user context across the entire request lifecycle,
 * similar to how Laravel uses request context for Auth::user().
 */

/**
 * Request context stored for each request
 */
interface RequestContext {
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
/**
 * Run a function with request context
 */
declare function runWithContext<T>(context: RequestContext, fn: () => T): T;
/**
 * Get the current request context
 */
declare function getRequestContext(): RequestContext | undefined;
/**
 * Get the current user context
 */
declare function getCurrentUserContext(): UserContext | null;
/**
 * Set user context for the current request
 */
declare function setCurrentUserContext(userContext: UserContext | null): void;
/**
 * Create a new request context
 */
declare function createRequestContext(userContext?: UserContext | null, metadata?: Record<string, unknown>): RequestContext;

export { type RequestContext as R, getCurrentUserContext as a, createRequestContext as c, getRequestContext as g, runWithContext as r, setCurrentUserContext as s };
