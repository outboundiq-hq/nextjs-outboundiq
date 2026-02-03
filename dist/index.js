'use strict';

var core = require('@outbound_iq/core');
var node = require('@outbound_iq/core/node');
var async_hooks = require('async_hooks');
var server = require('next/server');

// src/index.ts
var requestContextStorage = new async_hooks.AsyncLocalStorage();
function runWithContext(context, fn) {
  return requestContextStorage.run(context, fn);
}
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
function generateRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}
function createRequestContext(userContext = null, metadata) {
  return {
    userContext,
    requestId: generateRequestId(),
    startTime: Date.now(),
    metadata
  };
}
var USER_CONTEXT_HEADER = "x-outboundiq-user-context";
async function defaultGetUserContext(request) {
  const userId = request.headers.get("x-user-id") || request.headers.get("x-authenticated-user") || null;
  const hasNextAuthSession = request.cookies.has("next-auth.session-token") || request.cookies.has("__Secure-next-auth.session-token");
  const hasClerkSession = request.cookies.has("__session") || request.cookies.has("__clerk_db_jwt");
  const hasAuthHeader = request.headers.has("authorization");
  let context = "anonymous";
  if (userId || hasNextAuthSession || hasClerkSession || hasAuthHeader) {
    context = "authenticated";
  }
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  if (isApiRoute && hasAuthHeader) {
    context = "api";
  }
  return {
    userId: userId ? String(userId) : null,
    context,
    metadata: {
      path: request.nextUrl.pathname,
      method: request.method
    }
  };
}
function withOutboundIQ(middleware, options = {}) {
  const { getUserContext = defaultGetUserContext, excludePatterns = [] } = options;
  return async function outboundIQMiddleware(request) {
    const url = request.nextUrl.pathname;
    for (const pattern of excludePatterns) {
      if (typeof pattern === "string" && url.includes(pattern)) {
        return middleware(request);
      }
      if (pattern instanceof RegExp && pattern.test(url)) {
        return middleware(request);
      }
    }
    const userContext = await getUserContext(request);
    const response = await middleware(request);
    if (userContext) {
      const contextHeader = JSON.stringify(userContext);
      response.headers.set(USER_CONTEXT_HEADER, contextHeader);
    }
    return response;
  };
}
function getUserContextFromRequest(request) {
  const contextHeader = request.headers.get(USER_CONTEXT_HEADER);
  if (!contextHeader) return null;
  try {
    return JSON.parse(contextHeader);
  } catch {
    return null;
  }
}
function createOutboundIQMiddleware(options = {}) {
  return withOutboundIQ(
    () => server.NextResponse.next(),
    options
  );
}
var isInitialized = false;
function ensureInitialized() {
  if (isInitialized || core.getClient()) {
    return true;
  }
  const apiKey = process.env.OUTBOUNDIQ_KEY;
  const endpoint = process.env.OUTBOUNDIQ_URL;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable");
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
  const apiKey = config?.apiKey || process.env.OUTBOUNDIQ_KEY;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing API key for edge runtime");
    return;
  }
  core.init({
    apiKey,
    endpoint: config?.endpoint || process.env.OUTBOUNDIQ_URL,
    debug: config?.debug || process.env.OUTBOUNDIQ_DEBUG === "true",
    // Smaller batches for edge (short-lived)
    batchSize: config?.batchSize || 5,
    flushInterval: config?.flushInterval || 1e3,
    ...config
  });
  isInitialized = true;
}
var BODY_MAX_LENGTH = 6e4;
function extractRequestHeaders(input, init3) {
  const headers = {};
  if (init3?.headers) {
    if (init3.headers instanceof Headers) {
      init3.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init3.headers)) {
      init3.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init3.headers);
    }
  }
  if (input instanceof Request) {
    input.headers.forEach((value, key) => {
      if (!headers[key]) headers[key] = value;
    });
  }
  return headers;
}
function getRequestBodyFromInit(init3) {
  if (!init3?.body) return null;
  try {
    if (typeof init3.body === "string") {
      return init3.body.length > BODY_MAX_LENGTH ? init3.body.substring(0, BODY_MAX_LENGTH) + "...[truncated]" : init3.body;
    }
    if (init3.body instanceof FormData) return "[FormData]";
    if (init3.body instanceof URLSearchParams) {
      const s = init3.body.toString();
      return s.length > BODY_MAX_LENGTH ? s.substring(0, BODY_MAX_LENGTH) + "...[truncated]" : s;
    }
    if (init3.body instanceof ArrayBuffer || init3.body instanceof Uint8Array) {
      return `[Binary: ${init3.body.byteLength} bytes]`;
    }
    return "[Body]";
  } catch {
    return null;
  }
}
async function getResponseBodyForTracking(response) {
  try {
    const clone = response.clone();
    const text = await clone.text();
    return text.length > BODY_MAX_LENGTH ? text.substring(0, BODY_MAX_LENGTH) + "...[truncated]" : text;
  } catch {
    return null;
  }
}
function getResponseHeadersMap(response) {
  const out = {};
  response.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
async function trackFetch(input, init3) {
  const initialized = ensureInitialized();
  const startTime = performance.now();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init3?.method || "GET";
  const userContext = init3?.userContext;
  const requestHeaders = extractRequestHeaders(input, init3);
  const requestBody = getRequestBodyFromInit(init3);
  const fetchInit = init3 ? { ...init3 } : void 0;
  if (fetchInit) {
    delete fetchInit.userContext;
  }
  try {
    const response = await fetch(input, fetchInit);
    const duration = performance.now() - startTime;
    if (initialized) {
      const responseBody = await getResponseBodyForTracking(response);
      core.track({
        method: method.toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        requestHeaders: core.sanitizeHeaders(requestHeaders),
        responseHeaders: core.sanitizeHeaders(getResponseHeadersMap(response)),
        requestBody: core.safeStringify(requestBody, BODY_MAX_LENGTH),
        responseBody: core.safeStringify(responseBody, BODY_MAX_LENGTH),
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
        requestHeaders: core.sanitizeHeaders(requestHeaders),
        requestBody: core.safeStringify(requestBody, BODY_MAX_LENGTH),
        error: error instanceof Error ? error.message : "Unknown error",
        userContext: userContext || null
      });
      await core.flush();
    }
    throw error;
  }
}
function createTrackedFetch(userContext) {
  return async function trackedFetch(input, init3) {
    return trackFetch(input, { ...init3, userContext });
  };
}
function getBaseUrl() {
  const endpoint = process.env.OUTBOUNDIQ_URL || "https://agent.outboundiq.dev/api/metric";
  return endpoint.replace("/metric", "");
}
async function recommend(serviceName, options = {}) {
  const apiKey = process.env.OUTBOUNDIQ_KEY;
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
  const apiKey = process.env.OUTBOUNDIQ_KEY;
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
  const apiKey = process.env.OUTBOUNDIQ_KEY;
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
      const requestHeaders = normalizeAxiosHeaders(response.config.headers);
      const responseHeaders = normalizeAxiosHeaders(response.headers);
      core.track({
        method: (response.config.method || "GET").toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        requestHeaders: core.sanitizeHeaders(requestHeaders),
        responseHeaders: core.sanitizeHeaders(responseHeaders),
        requestBody: core.safeStringify(response.config.data, BODY_MAX_LENGTH),
        responseBody: core.safeStringify(response.data, BODY_MAX_LENGTH),
        userContext: options?.userContext || null
      });
      await core.flush();
      return response;
    },
    async (error) => {
      const duration = error.config?.metadata?.startTime ? performance.now() - error.config.metadata.startTime : 0;
      const url = error.config ? buildAxiosUrl(error.config) : "unknown";
      const requestHeaders = normalizeAxiosHeaders(error.config?.headers);
      const responseHeaders = normalizeAxiosHeaders(error.response?.headers);
      core.track({
        method: (error.config?.method || "GET").toUpperCase(),
        url,
        statusCode: error.response?.status || 0,
        duration,
        requestHeaders: core.sanitizeHeaders(requestHeaders),
        responseHeaders: core.sanitizeHeaders(responseHeaders),
        requestBody: core.safeStringify(error.config?.data, BODY_MAX_LENGTH),
        responseBody: core.safeStringify(error.response?.data, BODY_MAX_LENGTH),
        error: error.message,
        userContext: options?.userContext || null
      });
      await core.flush();
      return Promise.reject(error);
    }
  );
}
function normalizeAxiosHeaders(headers) {
  if (!headers) return {};
  const h = headers;
  if (typeof h.toJSON === "function") {
    const obj = h.toJSON(true);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v != null && typeof v === "string") out[k] = v;
        else if (v != null) out[k] = String(v);
      }
      return out;
    }
  }
  if (headers instanceof Headers) {
    const out = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (typeof headers === "object" && !Array.isArray(headers)) {
    return headers;
  }
  return {};
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

// src/index.ts
function withUserContext(handler, userContext) {
  return (async (...args) => {
    const { setUserContext: setUserContext3 } = await import('@outbound_iq/core');
    setUserContext3(userContext);
    try {
      return await handler(...args);
    } finally {
      setUserContext3(null);
    }
  });
}

Object.defineProperty(exports, "flush", {
  enumerable: true,
  get: function () { return core.flush; }
});
Object.defineProperty(exports, "getClient", {
  enumerable: true,
  get: function () { return core.getClient; }
});
Object.defineProperty(exports, "init", {
  enumerable: true,
  get: function () { return core.init; }
});
Object.defineProperty(exports, "setUserContext", {
  enumerable: true,
  get: function () { return core.setUserContext; }
});
Object.defineProperty(exports, "shutdown", {
  enumerable: true,
  get: function () { return core.shutdown; }
});
Object.defineProperty(exports, "track", {
  enumerable: true,
  get: function () { return core.track; }
});
Object.defineProperty(exports, "patchNodeHttp", {
  enumerable: true,
  get: function () { return node.patchNodeHttp; }
});
Object.defineProperty(exports, "setUserContextResolver", {
  enumerable: true,
  get: function () { return node.setUserContextResolver; }
});
Object.defineProperty(exports, "unpatchNodeHttp", {
  enumerable: true,
  get: function () { return node.unpatchNodeHttp; }
});
exports.USER_CONTEXT_HEADER = USER_CONTEXT_HEADER;
exports.addAxiosTracking = addAxiosTracking;
exports.createOutboundIQMiddleware = createOutboundIQMiddleware;
exports.createRequestContext = createRequestContext;
exports.createTrackedAxios = createTrackedAxios;
exports.createTrackedFetch = createTrackedFetch;
exports.endpointStatus = endpointStatus;
exports.getCurrentUserContext = getCurrentUserContext;
exports.getRequestContext = getRequestContext;
exports.getUserContextFromRequest = getUserContextFromRequest;
exports.initEdge = initEdge;
exports.providerStatus = providerStatus;
exports.recommend = recommend;
exports.runWithContext = runWithContext;
exports.setCurrentUserContext = setCurrentUserContext;
exports.trackFetch = trackFetch;
exports.withOutboundIQ = withOutboundIQ;
exports.withUserContext = withUserContext;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map