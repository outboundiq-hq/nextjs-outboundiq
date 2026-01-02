/**
 * @outboundiq/nextjs/register
 * 
 * Auto-registration for Next.js instrumentation.ts
 * 
 * This is the main entry point for Next.js applications.
 * Import this in your instrumentation.ts file:
 * 
 * @example
 * ```typescript
 * // instrumentation.ts
 * export async function register() {
 *   if (process.env.NEXT_RUNTIME === 'nodejs') {
 *     await import('@outboundiq/nextjs/register');
 *   }
 * }
 * ```
 */

import { init, getClient, setUserContext } from '@outboundiq/core';
import { register as registerNode, setUserContextResolver } from '@outboundiq/core/node';
import { getCurrentUserContext } from './context/request-context';

// Get config from environment
const apiKey = process.env.OUTBOUNDIQ_API_KEY;

if (!apiKey) {
  console.warn(
    '[OutboundIQ] Missing OUTBOUNDIQ_API_KEY environment variable. ' +
    'Tracking will be disabled.'
  );
} else {
  // Initialize the client
  // Note: projectId is determined from API key on the backend
  init({
    apiKey,
    endpoint: process.env.OUTBOUNDIQ_ENDPOINT,
    debug: process.env.OUTBOUNDIQ_DEBUG === 'true',
    batchSize: parseInt(process.env.OUTBOUNDIQ_BATCH_SIZE || '10', 10),
    flushInterval: parseInt(process.env.OUTBOUNDIQ_FLUSH_INTERVAL || '5000', 10),
  });

  // Set up user context resolver to use AsyncLocalStorage
  setUserContextResolver(() => getCurrentUserContext());

  // Patch http/https and fetch
  registerNode();

  console.log('[OutboundIQ] Next.js tracking enabled');

  // Handle graceful shutdown
  const shutdown = async () => {
    const client = getClient();
    if (client) {
      console.log('[OutboundIQ] Shutting down...');
      await client.shutdown();
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { getCurrentUserContext, setCurrentUserContext } from './context/request-context';

