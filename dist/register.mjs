import { init, getClient } from '@outboundiq/core';
import { setUserContextResolver, register } from '@outboundiq/core/node';
import { AsyncLocalStorage } from 'async_hooks';

// src/register.ts
var requestContextStorage = new AsyncLocalStorage();
function getRequestContext() {
  return requestContextStorage.getStore();
}
function getCurrentUserContext() {
  const context = getRequestContext();
  return context?.userContext ?? null;
}
function setCurrentUserContext(userContext) {
  const context = getRequestContext();
  if (context) {
    context.userContext = userContext;
  }
}

// src/register.ts
var apiKey = process.env.OUTBOUNDIQ_KEY;
if (!apiKey) {
  console.warn(
    "[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable. Tracking will be disabled."
  );
} else {
  init({
    apiKey,
    endpoint: process.env.OUTBOUNDIQ_URL,
    debug: process.env.OUTBOUNDIQ_DEBUG === "true",
    batchSize: parseInt(process.env.OUTBOUNDIQ_BATCH_SIZE || "10", 10),
    flushInterval: parseInt(process.env.OUTBOUNDIQ_FLUSH_INTERVAL || "5000", 10)
  });
  setUserContextResolver(() => getCurrentUserContext());
  register();
  console.log("[OutboundIQ] Next.js tracking enabled");
  const shutdown = async () => {
    const client = getClient();
    if (client) {
      console.log("[OutboundIQ] Shutting down...");
      await client.shutdown();
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export { getCurrentUserContext, setCurrentUserContext };
//# sourceMappingURL=register.mjs.map
//# sourceMappingURL=register.mjs.map