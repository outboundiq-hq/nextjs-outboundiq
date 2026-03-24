/**
 * @outboundiq/nextjs
 * 
 * OutboundIQ SDK for Next.js - Automatic tracking of all outbound API calls
 * 
 * ## Quick Start
 * 
 * 1. Install the package:
 * ```bash
 * npm install @outbound_iq/nextjs
 * ```
 *
 * 2. Add environment variables:
 * ```env
 * OUTBOUNDIQ_KEY=your-api-key
 * ```
 *
 * 3. Create instrumentation.ts in your project root:
 * ```typescript
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME === 'nodejs') {
 *     await import('@outbound_iq/nextjs/register');
 *   }
 * }
 * ```
 *
 * 4. (Optional) Add middleware for user context:
 * ```typescript
 * // middleware.ts
 * import { withOutboundIQ } from '@outbound_iq/nextjs/middleware';
 *
 * export default withOutboundIQ(async (request) => {
 *   return NextResponse.next();
 * });
 * ```
 *
 * **Important:** The root entry only exports browser-safe / isomorphic helpers from `@outbound_iq/core`.
 * Server-only APIs live in subpaths: `@outbound_iq/nextjs/middleware`, `@outbound_iq/nextjs/edge`,
 * `@outbound_iq/nextjs/register`, `@outbound_iq/nextjs/node`, `@outbound_iq/nextjs/context`.
 * Do not import the root package from Client Components if you only need tracking — use
 * `instrumentation.ts` + optional `middleware.ts` instead.
 *
 * That's it! All outbound API calls are now automatically tracked.
 *
 * @packageDocumentation
 */

// Re-export core client functionality
export {
  init,
  getClient,
  track,
  setUserContext,
  flush,
  shutdown,
  type OutboundIQConfig,
  type UserContext,
  type ApiCall,
} from '@outbound_iq/core';

/**
 * Helper to wrap API route handlers with user context
 */
export function withUserContext<T extends (...args: any[]) => any>(
  handler: T,
  userContext: import('@outbound_iq/core').UserContext
): T {
  return (async (...args: Parameters<T>) => {
    const { setUserContext } = await import('@outbound_iq/core');
    setUserContext(userContext);
    try {
      return await handler(...args);
    } finally {
      setUserContext(null);
    }
  }) as T;
}

