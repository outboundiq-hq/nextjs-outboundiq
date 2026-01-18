/**
 * @outboundiq/nextjs/edge
 * 
 * Edge runtime support for Next.js middleware and edge API routes
 * 
 * @example
 * ```typescript
 * // In Edge API route or middleware
 * import { trackFetch } from '@outboundiq/nextjs/edge';
 * 
 * export const runtime = 'edge';
 * 
 * export async function GET(request: Request) {
 *   // Manually track a fetch in edge runtime
 *   const response = await trackFetch('https://api.example.com/data', {
 *     method: 'GET',
 *   });
 *   
 *   return Response.json(await response.json());
 * }
 * ```
 */

import { init, track, getClient, flush as coreFlush, type OutboundIQConfig, type UserContext } from '@outboundiq/core';

let isInitialized = false;

/**
 * Ensure SDK is initialized
 */
function ensureInitialized(): boolean {
  if (isInitialized || getClient()) {
    return true;
  }

  const apiKey = process.env.OUTBOUNDIQ_KEY;
  const endpoint = process.env.OUTBOUNDIQ_ENDPOINT;

  if (!apiKey) {
    console.warn('[OutboundIQ] Missing OUTBOUNDIQ_KEY environment variable');
    return false;
  }

  init({
    apiKey,
    endpoint,
    debug: process.env.OUTBOUNDIQ_DEBUG === 'true',
    batchSize: 1, // Send immediately for serverless
    flushInterval: 1000,
  });

  isInitialized = true;
  console.log('[OutboundIQ] Auto-initialized for trackFetch');
  return true;
}

/**
 * Initialize OutboundIQ for Edge runtime
 * Call this once at the start of your edge function
 */
export function initEdge(config?: Partial<OutboundIQConfig>): void {
  if (isInitialized) return;

  const apiKey = config?.apiKey || process.env.OUTBOUNDIQ_KEY;

  if (!apiKey) {
    console.warn('[OutboundIQ] Missing API key for edge runtime');
    return;
  }

  init({
    apiKey,
    endpoint: config?.endpoint || process.env.OUTBOUNDIQ_ENDPOINT,
    debug: config?.debug || process.env.OUTBOUNDIQ_DEBUG === 'true',
    // Smaller batches for edge (short-lived)
    batchSize: config?.batchSize || 5,
    flushInterval: config?.flushInterval || 1000,
    ...config,
  });

  isInitialized = true;
}

/**
 * Track a fetch request manually
 * Auto-initializes SDK if not already done
 */
export async function trackFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { userContext?: UserContext }
): Promise<Response> {
  // Auto-initialize if needed
  const initialized = ensureInitialized();
  
  const startTime = performance.now();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';
  const userContext = init?.userContext;

  // Remove our custom property before passing to fetch
  const fetchInit = init ? { ...init } : undefined;
  if (fetchInit) {
    delete (fetchInit as any).userContext;
  }

  try {
    const response = await fetch(input, fetchInit);
    const duration = performance.now() - startTime;

    // Track the call if initialized
    if (initialized) {
      track({
        method: method.toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: userContext || null,
      });
      
      // Flush immediately for serverless (request may end soon)
      await coreFlush();
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
        error: error instanceof Error ? error.message : 'Unknown error',
        userContext: userContext || null,
      });
      
      await coreFlush();
    }

    throw error;
  }
}

/**
 * Create a tracked fetch function with pre-configured user context
 */
export function createTrackedFetch(userContext: UserContext) {
  return async function trackedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return trackFetch(input, { ...init, userContext });
  };
}

// Re-export useful functions
export { track, flush, setUserContext } from '@outboundiq/core';
export type { UserContext } from '@outboundiq/core';

// ============================================
// SDK Methods: recommend, providerStatus, endpointStatus
// ============================================

/**
 * Common options for SDK methods
 */
interface SdkMethodOptions {
  userContext?: UserContext;
  requestId?: string;
}

/**
 * Recommendation response from the API
 */
interface RecommendResponse {
  success: boolean;
  service?: {
    name: string;
    description: string;
    strategy: string;
  };
  recommendation?: {
    provider: string;
    endpoint: string;
    confidence: number;
    reason: string;
  };
  alternatives?: Array<{
    provider: string;
    endpoint: string;
    confidence: number;
  }>;
  error?: string;
}

/**
 * Provider status response from the API
 */
interface ProviderStatusResponse {
  success: boolean;
  provider?: {
    name: string;
    slug: string;
    status: string;
    description: string;
  };
  metrics?: {
    success_rate: number;
    average_latency: number;
    total_requests: number;
  };
  incidents?: Array<{
    title: string;
    status: string;
    created_at: string;
  }>;
  error?: string;
}

/**
 * Endpoint status response from the API
 */
interface EndpointStatusResponse {
  success: boolean;
  endpoint?: {
    name: string;
    slug: string;
    method: string;
    url_pattern: string;
  };
  metrics?: {
    success_rate: number;
    average_latency: number;
    total_requests: number;
  };
  provider?: {
    name: string;
    status: string;
  };
  error?: string;
}

/**
 * Get the base API URL from environment
 */
function getBaseUrl(): string {
  // Use the main API, not the metric endpoint
  const endpoint = process.env.OUTBOUNDIQ_ENDPOINT || 'https://agent.outboundiq.dev/api/metric';
  // Convert metric endpoint to base API URL
  // https://agent.outboundiq.dev/api/metric → https://agent.outboundiq.dev/api
  return endpoint.replace('/metric', '');
}

/**
 * Get recommendation for a service
 * 
 * Returns the best provider/endpoint to use based on:
 * - Your actual API usage data (success rate, latency, stability)
 * - Provider status page health
 * - Recent incidents
 * 
 * @example
 * ```typescript
 * const result = await recommend('payment-processing');
 * if (result?.success && result.recommendation) {
 *   console.log(`Use ${result.recommendation.provider} (${result.recommendation.confidence}% confidence)`);
 * }
 * ```
 */
export async function recommend(
  serviceName: string,
  options: SdkMethodOptions = {}
): Promise<RecommendResponse | null> {
  const apiKey = process.env.OUTBOUNDIQ_KEY;
  if (!apiKey) {
    console.warn('[OutboundIQ] Missing API key for recommend()');
    return null;
  }

  try {
    const url = `${getBaseUrl()}/v1/recommend/${encodeURIComponent(serviceName)}`;
    const requestId = options.requestId || crypto.randomUUID();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'X-Request-Id': requestId,
    };

    if (options.userContext) {
      headers['X-User-Context'] = JSON.stringify(options.userContext);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    return await response.json();
  } catch (error) {
    console.error('[OutboundIQ] recommend() failed:', error);
    return null;
  }
}

/**
 * Get status and metrics for a provider
 * 
 * Returns real-time actionable data for decision-making:
 * - Provider status (from status page)
 * - Aggregate metrics (success rate, latency)
 * - Active incidents
 * 
 * @example
 * ```typescript
 * const status = await providerStatus('stripe');
 * if (status?.provider?.status === 'operational') {
 *   // Safe to use Stripe
 * }
 * ```
 */
export async function providerStatus(
  providerSlug: string,
  options: SdkMethodOptions = {}
): Promise<ProviderStatusResponse | null> {
  const apiKey = process.env.OUTBOUNDIQ_KEY;
  if (!apiKey) {
    console.warn('[OutboundIQ] Missing API key for providerStatus()');
    return null;
  }

  try {
    const url = `${getBaseUrl()}/v1/provider/${encodeURIComponent(providerSlug)}/status`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    };

    if (options.userContext) {
      headers['X-User-Context'] = JSON.stringify(options.userContext);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    return await response.json();
  } catch (error) {
    console.error('[OutboundIQ] providerStatus() failed:', error);
    return null;
  }
}

/**
 * Get status and metrics for a specific endpoint
 * 
 * Returns real-time actionable data for decision-making:
 * - Endpoint-specific metrics (success rate, latency)
 * - Provider status
 * - Active incidents
 * 
 * @example
 * ```typescript
 * const status = await endpointStatus('stripe-post-charges');
 * if (status?.metrics?.success_rate > 99) {
 *   // Endpoint is healthy
 * }
 * ```
 */
export async function endpointStatus(
  endpointSlug: string,
  options: SdkMethodOptions = {}
): Promise<EndpointStatusResponse | null> {
  const apiKey = process.env.OUTBOUNDIQ_KEY;
  if (!apiKey) {
    console.warn('[OutboundIQ] Missing API key for endpointStatus()');
    return null;
  }

  try {
    const url = `${getBaseUrl()}/v1/endpoint/${encodeURIComponent(endpointSlug)}/status`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    };

    if (options.userContext) {
      headers['X-User-Context'] = JSON.stringify(options.userContext);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    return await response.json();
  } catch (error) {
    console.error('[OutboundIQ] endpointStatus() failed:', error);
    return null;
  }
}

/**
 * Axios interceptor types
 */
interface AxiosResponse {
  status: number;
  config: {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    data?: unknown;
    metadata?: { startTime: number };
  };
  headers?: Record<string, string>;
  data?: unknown;
}

interface AxiosError {
  config?: AxiosResponse['config'];
  response?: AxiosResponse;
  message: string;
}

interface AxiosInstance {
  interceptors: {
    request: {
      use: (
        onFulfilled?: (config: any) => any,
        onRejected?: (error: any) => any
      ) => number;
    };
    response: {
      use: (
        onFulfilled?: (response: any) => any,
        onRejected?: (error: any) => any
      ) => number;
    };
  };
  
  get: <T = any>(url: string, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  post: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  put: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  patch: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  delete: <T = any>(url: string, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  head: <T = any>(url: string, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  options: <T = any>(url: string, config?: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  request: <T = any>(config: any) => Promise<{ data: T; status: number; headers: any; config: any }>;
  // Instance properties
  defaults: any;
}

/**
 * Add OutboundIQ tracking to an existing axios instance
 * 
 * This adds interceptors without removing existing ones.
 * Works with any axios instance that already has interceptors.
 * 
 * @example
 * ```typescript
 * import axios from 'axios';
 * import { addAxiosTracking } from '@outboundiq/nextjs/edge';
 * 
 * // Your existing axios instance with interceptors
 * const api = axios.create({ baseURL: 'https://api.example.com' });
 * api.interceptors.request.use(config => {
 *   config.headers.Authorization = `Bearer ${token}`;
 *   return config;
 * });
 * 
 * // Add OutboundIQ tracking (doesn't remove existing interceptors)
 * addAxiosTracking(api);
 * 
 * // Now all calls are tracked!
 * await api.get('/users');
 * ```
 */
export function addAxiosTracking(
  axiosInstance: AxiosInstance,
  options?: { userContext?: UserContext }
): void {
  // Ensure SDK is initialized
  ensureInitialized();

  // Request interceptor - record start time
  axiosInstance.interceptors.request.use(
    (config: any) => {
      config.metadata = { startTime: performance.now() };
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // Response interceptor - track successful calls
  axiosInstance.interceptors.response.use(
    async (response: AxiosResponse) => {
      const duration = response.config.metadata?.startTime
        ? performance.now() - response.config.metadata.startTime
        : 0;

      const url = buildAxiosUrl(response.config);

      track({
        method: (response.config.method || 'GET').toUpperCase(),
        url,
        statusCode: response.status,
        duration,
        userContext: options?.userContext || null,
      });

      // Flush for serverless
      await coreFlush();

      return response;
    },
    async (error: AxiosError) => {
      const duration = error.config?.metadata?.startTime
        ? performance.now() - error.config.metadata.startTime
        : 0;

      const url = error.config ? buildAxiosUrl(error.config) : 'unknown';

      track({
        method: (error.config?.method || 'GET').toUpperCase(),
        url,
        statusCode: error.response?.status || 0,
        duration,
        error: error.message,
        userContext: options?.userContext || null,
      });

      await coreFlush();

      return Promise.reject(error);
    }
  );
}

/**
 * Build full URL from axios config
 */
function buildAxiosUrl(config: AxiosResponse['config']): string {
  const baseURL = config.baseURL || '';
  const url = config.url || '';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  return baseURL + url;
}

/**
 * Create a tracked axios instance
 * 
 * @example
 * ```typescript
 * import axios from 'axios';
 * import { createTrackedAxios } from '@outboundiq/nextjs/edge';
 * 
 * const api = createTrackedAxios(axios, {
 *   baseURL: 'https://api.example.com',
 * });
 * 
 * await api.get('/users'); // Automatically tracked!
 * ```
 */
export function createTrackedAxios(
  axios: { create: (config?: any) => AxiosInstance },
  config?: any,
  options?: { userContext?: UserContext }
): AxiosInstance {
  const instance = axios.create(config);
  addAxiosTracking(instance, options);
  return instance;
}

