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

import { init, getClient, setUserContext } from '@outbound_iq/core';
import { register as registerNode, setUserContextResolver } from '@outbound_iq/core/node';
import { getCurrentUserContext } from './context/request-context';
import {
  getOutboundIQFlushIntervalFromEnv,
  getOutboundIQMaxItemsFromEnv,
  isOutboundIQEnabled,
} from './env';

// Get config from environment
const apiKey = process.env.OUTBOUNDIQ_KEY;

if (!apiKey) {
  console.warn(
    '[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable. ' +
    'Tracking will be disabled.'
  );
} else if (!isOutboundIQEnabled()) {
  console.log(
    '[OutboundIQ] Tracking disabled (OUTBOUNDIQ_ENABLED is false).'
  );
} else {
  // Initialize the client
  // Note: projectId is determined from API key on the backend
  init({
    apiKey,
    endpoint: process.env.OUTBOUNDIQ_URL,
    debug: process.env.OUTBOUNDIQ_DEBUG === 'true',
    batchSize: getOutboundIQMaxItemsFromEnv(),
    flushInterval: getOutboundIQFlushIntervalFromEnv(),
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

