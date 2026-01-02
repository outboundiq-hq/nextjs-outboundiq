import { OutboundIQConfig, UserContext } from '@outboundiq/core';
export { UserContext, flush, setUserContext, track } from '@outboundiq/core';

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

/**
 * Initialize OutboundIQ for Edge runtime
 * Call this once at the start of your edge function
 */
declare function initEdge(config?: Partial<OutboundIQConfig>): void;
/**
 * Track a fetch request manually
 * Auto-initializes SDK if not already done
 */
declare function trackFetch(input: RequestInfo | URL, init?: RequestInit & {
    userContext?: UserContext;
}): Promise<Response>;
/**
 * Create a tracked fetch function with pre-configured user context
 */
declare function createTrackedFetch(userContext: UserContext): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
declare function recommend(serviceName: string, options?: SdkMethodOptions): Promise<RecommendResponse | null>;
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
declare function providerStatus(providerSlug: string, options?: SdkMethodOptions): Promise<ProviderStatusResponse | null>;
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
declare function endpointStatus(endpointSlug: string, options?: SdkMethodOptions): Promise<EndpointStatusResponse | null>;
interface AxiosInstance {
    interceptors: {
        request: {
            use: (onFulfilled?: (config: any) => any, onRejected?: (error: any) => any) => number;
        };
        response: {
            use: (onFulfilled?: (response: any) => any, onRejected?: (error: any) => any) => number;
        };
    };
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
declare function addAxiosTracking(axiosInstance: AxiosInstance, options?: {
    userContext?: UserContext;
}): void;
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
declare function createTrackedAxios(axios: {
    create: (config?: any) => AxiosInstance;
}, config?: any, options?: {
    userContext?: UserContext;
}): AxiosInstance;

export { addAxiosTracking, createTrackedAxios, createTrackedFetch, endpointStatus, initEdge, providerStatus, recommend, trackFetch };
