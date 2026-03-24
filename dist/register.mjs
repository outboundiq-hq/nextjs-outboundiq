import { init, getClient } from '@outbound_iq/core';
import { setUserContextResolver, register } from '@outbound_iq/core/node';
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

// src/env.ts
function parseEnabled(raw) {
  if (raw === void 0 || raw === "") {
    return true;
  }
  const v = raw.toLowerCase().trim();
  return !["false", "0", "no", "off"].includes(v);
}
function isOutboundIQEnabled() {
  return parseEnabled(process.env.OUTBOUNDIQ_ENABLED);
}
function getOutboundIQMaxItemsFromEnv() {
  const fromMax = process.env.OUTBOUNDIQ_MAX_ITEMS;
  const fromBatch = process.env.OUTBOUNDIQ_BATCH_SIZE;
  const raw = fromMax !== void 0 && fromMax !== "" ? fromMax : fromBatch;
  if (raw === void 0 || raw === "") {
    return 100;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}
function getOutboundIQFlushIntervalFromEnv() {
  const raw = process.env.OUTBOUNDIQ_FLUSH_INTERVAL;
  if (raw === void 0 || raw === "") {
    return 5e3;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 5e3;
}

// src/register.ts
var apiKey = process.env.OUTBOUNDIQ_KEY;
if (!apiKey) {
  console.warn(
    "[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable. Tracking will be disabled."
  );
} else if (!isOutboundIQEnabled()) {
  console.log(
    "[OutboundIQ] Tracking disabled (OUTBOUNDIQ_ENABLED is false)."
  );
} else {
  init({
    apiKey,
    endpoint: process.env.OUTBOUNDIQ_URL,
    debug: process.env.OUTBOUNDIQ_DEBUG === "true",
    batchSize: getOutboundIQMaxItemsFromEnv(),
    flushInterval: getOutboundIQFlushIntervalFromEnv()
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