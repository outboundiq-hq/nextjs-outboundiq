'use strict';

var core = require('@outboundiq/core');

// src/edge.ts
var isInitialized = false;
function ensureInitialized() {
  if (isInitialized || core.getClient()) {
    return true;
  }
  const apiKey = process.env.OUTBOUNDIQ_API_KEY;
  const endpoint = process.env.OUTBOUNDIQ_ENDPOINT;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing OUTBOUNDIQ_API_KEY environment variable");
    return false;
  }
  core.init({
    apiKey,
    endpoint,
    debug: process.env.OUTBOUNDIQ_DEBUG === "true",
    batchSize: 1,
    // Send immediately for serverless
    flushInterval: 1e3
  });
  isInitialized = true;
  console.log("[OutboundIQ] Auto-initialized for trackFetch");
  return true;
}
function initEdge(config) {
  if (isInitialized) return;
  const apiKey = config?.apiKey || process.env.OUTBOUNDIQ_API_KEY;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing API key for edge runtime");
    return;
  }
  core.init({
    apiKey,
    endpoint: config?.endpoint || process.env.OUTBOUNDIQ_ENDPOINT,
    debug: config?.debug || process.env.OUTBOUNDIQ_DEBUG === "true",
    // Smaller batches for edge (short-lived)
    batchSize: config?.batchSize || 5,
    flushInterval: config?.flushInterval || 1e3,
    ...config
  });
  isInitialized = true;
}
async function trackFetch(input, init2) {
  const initialized = ensureInitialized();
  const startTime = performance.now();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init2?.method || "GET";
  const userContext = init2?.userContext;
  const fetchInit = init2 ? { ...init2 } : void 0;
  if (fetchInit) {
    delete fetchInit.userContext;
  }
  try {
    const response = await fetch(input, fetchInit);
    const duration = performance.now() - startTime;
    if (initialized) {
      core.track({
        method: method.toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: userContext || null
      });
      await core.flush();
    }
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    if (initialized) {
      core.track({
        method: method.toUpperCase(),
        url,
        statusCode: 0,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        userContext: userContext || null
      });
      await core.flush();
    }
    throw error;
  }
}
function createTrackedFetch(userContext) {
  return async function trackedFetch(input, init2) {
    return trackFetch(input, { ...init2, userContext });
  };
}
function getBaseUrl() {
  const endpoint = process.env.OUTBOUNDIQ_ENDPOINT || "https://agent.outboundiq.dev/api/metric";
  return endpoint.replace("/metric", "");
}
async function recommend(serviceName, options = {}) {
  const apiKey = process.env.OUTBOUNDIQ_API_KEY;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing API key for recommend()");
    return null;
  }
  try {
    const url = `${getBaseUrl()}/v1/recommend/${encodeURIComponent(serviceName)}`;
    const requestId = options.requestId || crypto.randomUUID();
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "X-Request-Id": requestId
    };
    if (options.userContext) {
      headers["X-User-Context"] = JSON.stringify(options.userContext);
    }
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    return await response.json();
  } catch (error) {
    console.error("[OutboundIQ] recommend() failed:", error);
    return null;
  }
}
async function providerStatus(providerSlug, options = {}) {
  const apiKey = process.env.OUTBOUNDIQ_API_KEY;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing API key for providerStatus()");
    return null;
  }
  try {
    const url = `${getBaseUrl()}/v1/provider/${encodeURIComponent(providerSlug)}/status`;
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json"
    };
    if (options.userContext) {
      headers["X-User-Context"] = JSON.stringify(options.userContext);
    }
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    return await response.json();
  } catch (error) {
    console.error("[OutboundIQ] providerStatus() failed:", error);
    return null;
  }
}
async function endpointStatus(endpointSlug, options = {}) {
  const apiKey = process.env.OUTBOUNDIQ_API_KEY;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing API key for endpointStatus()");
    return null;
  }
  try {
    const url = `${getBaseUrl()}/v1/endpoint/${encodeURIComponent(endpointSlug)}/status`;
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json"
    };
    if (options.userContext) {
      headers["X-User-Context"] = JSON.stringify(options.userContext);
    }
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    return await response.json();
  } catch (error) {
    console.error("[OutboundIQ] endpointStatus() failed:", error);
    return null;
  }
}
function addAxiosTracking(axiosInstance, options) {
  ensureInitialized();
  axiosInstance.interceptors.request.use(
    (config) => {
      config.metadata = { startTime: performance.now() };
      return config;
    },
    (error) => Promise.reject(error)
  );
  axiosInstance.interceptors.response.use(
    async (response) => {
      const duration = response.config.metadata?.startTime ? performance.now() - response.config.metadata.startTime : 0;
      const url = buildAxiosUrl(response.config);
      core.track({
        method: (response.config.method || "GET").toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: options?.userContext || null
      });
      await core.flush();
      return response;
    },
    async (error) => {
      const duration = error.config?.metadata?.startTime ? performance.now() - error.config.metadata.startTime : 0;
      const url = error.config ? buildAxiosUrl(error.config) : "unknown";
      core.track({
        method: (error.config?.method || "GET").toUpperCase(),
        url,
        statusCode: error.response?.status || 0,
        duration,
        error: error.message,
        userContext: options?.userContext || null
      });
      await core.flush();
      return Promise.reject(error);
    }
  );
}
function buildAxiosUrl(config) {
  const baseURL = config.baseURL || "";
  const url = config.url || "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return baseURL + url;
}
function createTrackedAxios(axios, config, options) {
  const instance = axios.create(config);
  addAxiosTracking(instance, options);
  return instance;
}

Object.defineProperty(exports, "flush", {
  enumerable: true,
  get: function () { return core.flush; }
});
Object.defineProperty(exports, "setUserContext", {
  enumerable: true,
  get: function () { return core.setUserContext; }
});
Object.defineProperty(exports, "track", {
  enumerable: true,
  get: function () { return core.track; }
});
exports.addAxiosTracking = addAxiosTracking;
exports.createTrackedAxios = createTrackedAxios;
exports.createTrackedFetch = createTrackedFetch;
exports.endpointStatus = endpointStatus;
exports.initEdge = initEdge;
exports.providerStatus = providerStatus;
exports.recommend = recommend;
exports.trackFetch = trackFetch;
//# sourceMappingURL=edge.js.map
//# sourceMappingURL=edge.js.map