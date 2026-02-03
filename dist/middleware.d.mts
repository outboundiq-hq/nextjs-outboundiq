import { NextRequest, NextResponse } from 'next/server';
import { UserContext } from '@outbound_iq/core';

/**
 * @outboundiq/nextjs/middleware
 *
 * Middleware utilities for user context injection
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
 * import { getToken } from 'next-auth/jwt';
 *
 * export default withOutboundIQ(async (request) => {
 *   // Your middleware logic
 *   return NextResponse.next();
 * }, {
 *   // Optional: custom user resolver
 *   getUserContext: async (request) => {
 *     const token = await getToken({ req: request });
 *     return token ? { userId: token.sub, context: 'authenticated' } : null;
 *   }
 * });
 * ```
 */

/**
 * Options for the OutboundIQ middleware wrapper
 */
interface WithOutboundIQOptions {
    /**
     * Custom function to extract user context from the request
     */
    getUserContext?: (request: NextRequest) => Promise<UserContext | null> | UserContext | null;
    /**
     * Patterns to exclude from tracking
     */
    excludePatterns?: (string | RegExp)[];
}
/**
 * Header name for passing user context to API routes
 */
declare const USER_CONTEXT_HEADER = "x-outboundiq-user-context";
/**
 * Wrap your middleware with OutboundIQ user context injection
 */
declare function withOutboundIQ(middleware: (request: NextRequest) => Promise<NextResponse> | NextResponse, options?: WithOutboundIQOptions): (request: NextRequest) => Promise<NextResponse>;
/**
 * Extract user context from request headers (for API routes)
 */
declare function getUserContextFromRequest(request: Request): UserContext | null;
/**
 * Create a simple middleware that just injects user context
 * Use this if you don't have existing middleware
 */
declare function createOutboundIQMiddleware(options?: WithOutboundIQOptions): (request: NextRequest) => Promise<NextResponse>;

export { USER_CONTEXT_HEADER, type WithOutboundIQOptions, createOutboundIQMiddleware, getUserContextFromRequest, withOutboundIQ };
