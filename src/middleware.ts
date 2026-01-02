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

import { NextRequest, NextResponse } from 'next/server';
import type { UserContext } from '@outboundiq/core';

/**
 * Options for the OutboundIQ middleware wrapper
 */
export interface WithOutboundIQOptions {
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
export const USER_CONTEXT_HEADER = 'x-outboundiq-user-context';

/**
 * Default user context resolver
 * Attempts to extract user info from common patterns
 */
async function defaultGetUserContext(request: NextRequest): Promise<UserContext | null> {
  // Try to get user ID from common header patterns
  const userId = 
    request.headers.get('x-user-id') ||
    request.headers.get('x-authenticated-user') ||
    null;

  // Check for NextAuth session cookie
  const hasNextAuthSession = request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token');

  // Check for Clerk session
  const hasClerkSession = request.cookies.has('__session') ||
    request.cookies.has('__clerk_db_jwt');

  // Check for Authorization header
  const hasAuthHeader = request.headers.has('authorization');

  // Determine context type
  let context: UserContext['context'] = 'anonymous';
  if (userId || hasNextAuthSession || hasClerkSession || hasAuthHeader) {
    context = 'authenticated';
  }

  // Check if it's an API call vs page request
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  if (isApiRoute && hasAuthHeader) {
    context = 'api';
  }

  return {
    userId: userId ? String(userId) : null,
    context,
    metadata: {
      path: request.nextUrl.pathname,
      method: request.method,
    },
  };
}

/**
 * Wrap your middleware with OutboundIQ user context injection
 */
export function withOutboundIQ(
  middleware: (request: NextRequest) => Promise<NextResponse> | NextResponse,
  options: WithOutboundIQOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  const { getUserContext = defaultGetUserContext, excludePatterns = [] } = options;

  return async function outboundIQMiddleware(request: NextRequest): Promise<NextResponse> {
    const url = request.nextUrl.pathname;

    // Check exclusions
    for (const pattern of excludePatterns) {
      if (typeof pattern === 'string' && url.includes(pattern)) {
        return middleware(request);
      }
      if (pattern instanceof RegExp && pattern.test(url)) {
        return middleware(request);
      }
    }

    // Get user context
    const userContext = await getUserContext(request);

    // Call the original middleware
    const response = await middleware(request);

    // Inject user context header for downstream API routes
    if (userContext) {
      const contextHeader = JSON.stringify(userContext);
      response.headers.set(USER_CONTEXT_HEADER, contextHeader);
    }

    return response;
  };
}

/**
 * Extract user context from request headers (for API routes)
 */
export function getUserContextFromRequest(request: Request): UserContext | null {
  const contextHeader = request.headers.get(USER_CONTEXT_HEADER);
  if (!contextHeader) return null;

  try {
    return JSON.parse(contextHeader) as UserContext;
  } catch {
    return null;
  }
}

/**
 * Create a simple middleware that just injects user context
 * Use this if you don't have existing middleware
 */
export function createOutboundIQMiddleware(
  options: WithOutboundIQOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withOutboundIQ(
    () => NextResponse.next(),
    options
  );
}

