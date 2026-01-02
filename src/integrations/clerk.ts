/**
 * Clerk integration
 * 
 * @example
 * ```typescript
 * // middleware.ts
 * import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
 * import { createClerkResolver } from '@outboundiq/nextjs/integrations/clerk';
 * 
 * export default withOutboundIQ(async (request) => {
 *   return NextResponse.next();
 * }, {
 *   getUserContext: createClerkResolver(),
 * });
 * ```
 */

import type { NextRequest } from 'next/server';
import type { UserContext } from '@outboundiq/core';

/**
 * Create a user context resolver for Clerk
 * 
 * Note: For full Clerk integration, use their clerkMiddleware and access
 * the auth object. This is a lightweight version that detects sessions.
 */
export function createClerkResolver() {
  return async (request: NextRequest): Promise<UserContext | null> => {
    // Check for Clerk session cookies
    const hasSession = 
      request.cookies.has('__session') ||
      request.cookies.has('__clerk_db_jwt');

    if (!hasSession) {
      return {
        userId: null,
        context: 'anonymous',
      };
    }

    // Check for user ID in header (set by Clerk middleware)
    const userId = request.headers.get('x-clerk-user-id');

    return {
      userId: userId || null,
      context: 'authenticated',
      metadata: {
        authProvider: 'clerk',
      },
    };
  };
}

/**
 * Get user context from Clerk auth object
 * Use this in your API route handlers with Clerk's auth()
 * 
 * @example
 * ```typescript
 * import { auth } from '@clerk/nextjs';
 * import { getUserContextFromClerk } from '@outboundiq/nextjs/integrations/clerk';
 * 
 * export async function GET(request: Request) {
 *   const { userId, orgId } = auth();
 *   const userContext = getUserContextFromClerk({ userId, orgId });
 *   // Use userContext for tracking
 * }
 * ```
 */
export function getUserContextFromClerk(
  clerkAuth: { userId: string | null; orgId?: string | null; sessionId?: string | null }
): UserContext {
  if (!clerkAuth.userId) {
    return {
      userId: null,
      context: 'anonymous',
    };
  }

  return {
    userId: clerkAuth.userId,
    userType: 'User',
    context: 'authenticated',
    metadata: {
      authProvider: 'clerk',
      orgId: clerkAuth.orgId,
      sessionId: clerkAuth.sessionId,
    },
  };
}

