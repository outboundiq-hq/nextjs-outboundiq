/**
 * @outboundiq/nextjs
 * 
 * OutboundIQ SDK for Next.js - Automatic tracking of all outbound API calls
 * 
 * ## Quick Start
 * 
 * 1. Install the package:
 * ```bash
 * npm install @outboundiq/nextjs
 * ```
 * 
 * 2. Add environment variables:
 * ```env
 * OUTBOUNDIQ_KEY=your-api-key
 * OUTBOUNDIQ_PROJECT_ID=your-project-id
 * ```
 * 
 * 3. Create instrumentation.ts in your project root:
 * ```typescript
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME === 'nodejs') {
 *     await import('@outboundiq/nextjs/register');
 *   }
 * }
 * ```
 * 
 * 4. (Optional) Add middleware for user context:
 * ```typescript
 * // middleware.ts
 * import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
 * 
 * export default withOutboundIQ(async (request) => {
 *   return NextResponse.next();
 * });
 * ```
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

// Re-export node patching (for manual patching if needed)
export {
  patchNodeHttp,
  unpatchNodeHttp,
  setUserContextResolver,
} from '@outbound_iq/core/node';

// Export context utilities
export {
  runWithContext,
  getRequestContext,
  getCurrentUserContext,
  setCurrentUserContext,
  createRequestContext,
  type RequestContext,
} from './context/request-context';

// Export middleware utilities
export {
  withOutboundIQ,
  getUserContextFromRequest,
  createOutboundIQMiddleware,
  USER_CONTEXT_HEADER,
  type WithOutboundIQOptions,
} from './middleware';

// Export edge utilities (also work in Node.js runtime)
export {
  initEdge,
  trackFetch,
  createTrackedFetch,
  addAxiosTracking,
  createTrackedAxios,
  // SDK methods
  recommend,
  providerStatus,
  endpointStatus,
} from './edge';

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

