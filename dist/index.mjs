import { init, track, flush, getClient } from '@outboundiq/core';
export { flush, getClient, init, setUserContext, shutdown, track } from '@outboundiq/core';
export { patchNodeHttp, setUserContextResolver, unpatchNodeHttp } from '@outboundiq/core/node';
import { AsyncLocalStorage } from 'async_hooks';
import { NextResponse } from 'next/server';

// src/index.ts
var requestContextStorage = new AsyncLocalStorage();
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
    () => NextResponse.next(),
    options
  );
}
var isInitialized = false;
function ensureInitialized() {
  if (isInitialized || getClient()) {
    return true;
  }
  const apiKey = process.env.OUTBOUNDIQ_KEY;
  const endpoint = process.env.OUTBOUNDIQ_URL;
  if (!apiKey) {
    console.warn("[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable");
    return false;
  }
  init({
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
  init({
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
async function trackFetch(input, init3) {
  const initialized = ensureInitialized();
  const startTime = performance.now();
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init3?.method || "GET";
  const userContext = init3?.userContext;
  const fetchInit = init3 ? { ...init3 } : void 0;
  if (fetchInit) {
    delete fetchInit.userContext;
  }
  try {
    const response = await fetch(input, fetchInit);
    const duration = performance.now() - startTime;
    if (initialized) {
      track({
        method: method.toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: userContext || null
      });
      await flush();
    }
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    if (initialized) {
      track({
        method: method.toUpperCase(),
        url,
        statusCode: 0,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        userContext: userContext || null
      });
      await flush();
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
      track({
        method: (response.config.method || "GET").toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: options?.userContext || null
      });
      await flush();
      return response;
    },
    async (error) => {
      const duration = error.config?.metadata?.startTime ? performance.now() - error.config.metadata.startTime : 0;
      const url = error.config ? buildAxiosUrl(error.config) : "unknown";
      track({
        method: (error.config?.method || "GET").toUpperCase(),
        url,
        statusCode: error.response?.status || 0,
        duration,
        error: error.message,
        userContext: options?.userContext || null
      });
      await flush();
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

// src/index.ts
function withUserContext(handler, userContext) {
  return (async (...args) => {
    const { setUserContext: setUserContext3 } = await import('@outboundiq/core');
    setUserContext3(userContext);
    try {
      return await handler(...args);
    } finally {
      setUserContext3(null);
    }
  });
}

export { USER_CONTEXT_HEADER, addAxiosTracking, createOutboundIQMiddleware, createRequestContext, createTrackedAxios, createTrackedFetch, endpointStatus, getCurrentUserContext, getRequestContext, getUserContextFromRequest, initEdge, providerStatus, recommend, runWithContext, setCurrentUserContext, trackFetch, withOutboundIQ, withUserContext };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map