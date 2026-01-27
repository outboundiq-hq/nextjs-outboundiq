/**
 * NextAuth.js integration
 * 
 * @example
 * ```typescript
 * // middleware.ts
 * import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
 * import { createNextAuthResolver } from '@outboundiq/nextjs/integrations/next-auth';
 * 
 * export default withOutboundIQ(async (request) => {
 *   return NextResponse.next();
 * }, {
 *   getUserContext: createNextAuthResolver(),
 * });
 * ```
 */

import type { NextRequest } from 'next/server';
import type { UserContext } from '@outbound_iq/core';

export interface NextAuthResolverOptions {
  /**
   * The secret used to sign the JWT (defaults to NEXTAUTH_SECRET env var)
   */
  secret?: string;

  /**
   * Cookie name for the session token
   */
  cookieName?: string;
}

/**
 * Create a user context resolver for NextAuth.js
 * 
 * Note: For full NextAuth integration in middleware, you'll need to use
 * the getToken function from next-auth/jwt. This is a lightweight version
 * that just detects if a session exists.
 */
export function createNextAuthResolver(options: NextAuthResolverOptions = {}) {
  return async (request: NextRequest): Promise<UserContext | null> => {
    // Check for session cookies
    const sessionToken = 
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!sessionToken) {
      return {
        userId: null,
        context: 'anonymous',
      };
    }

    // Session exists - we can't decode it without next-auth/jwt
    // but we know the user is authenticated
    return {
      userId: null, // Would need getToken() to get actual user ID
      context: 'authenticated',
      metadata: {
        authProvider: 'next-auth',
      },
    };
  };
}

/**
 * Get user context from NextAuth in API routes
 * Use this in your API route handlers with the actual NextAuth session
 * 
 * @example
 * ```typescript
 * import { getServerSession } from 'next-auth';
 * import { getUserContextFromSession } from '@outboundiq/nextjs/integrations/next-auth';
 * 
 * export async function GET(request: Request) {
 *   const session = await getServerSession(authOptions);
 *   const userContext = getUserContextFromSession(session);
 *   // Use userContext for tracking
 * }
 * ```
 */
export function getUserContextFromSession(
  session: { user?: { id?: string; email?: string; name?: string } } | null
): UserContext {
  if (!session?.user) {
    return {
      userId: null,
      context: 'anonymous',
    };
  }

  return {
    userId: session.user.id || session.user.email || null,
    userType: 'User',
    context: 'authenticated',
    metadata: {
      authProvider: 'next-auth',
      email: session.user.email,
      name: session.user.name,
    },
  };
}

