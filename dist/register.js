'use strict';

var core = require('@outbound_iq/core');
var node = require('@outbound_iq/core/node');
var async_hooks = require('async_hooks');

// src/register.ts
var requestContextStorage = new async_hooks.AsyncLocalStorage();
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
  core.init({
    apiKey,
    endpoint: process.env.OUTBOUNDIQ_URL,
    debug: process.env.OUTBOUNDIQ_DEBUG === "true",
    batchSize: getOutboundIQMaxItemsFromEnv(),
    flushInterval: getOutboundIQFlushIntervalFromEnv()
  });
  node.setUserContextResolver(() => getCurrentUserContext());
  node.register();
  console.log("[OutboundIQ] Next.js tracking enabled");
  const shutdown = async () => {
    const client = core.getClient();
    if (client) {
      console.log("[OutboundIQ] Shutting down...");
      await client.shutdown();
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

exports.getCurrentUserContext = getCurrentUserContext;
exports.setCurrentUserContext = setCurrentUserContext;
//# sourceMappingURL=register.js.map
//# sourceMappingURL=register.js.map