import * as _outboundiq_core from '@outboundiq/core';
export { ApiCall, OutboundIQConfig, UserContext, flush, getClient, init, setUserContext, shutdown, track } from '@outboundiq/core';
export { patchNodeHttp, setUserContextResolver, unpatchNodeHttp } from '@outboundiq/core/node';
export { R as RequestContext, c as createRequestContext, a as getCurrentUserContext, g as getRequestContext, r as runWithContext, s as setCurrentUserContext } from './register-D-6-L9tm.mjs';
export { USER_CONTEXT_HEADER, WithOutboundIQOptions, createOutboundIQMiddleware, getUserContextFromRequest, withOutboundIQ } from './middleware.mjs';
export { addAxiosTracking, createTrackedAxios, createTrackedFetch, endpointStatus, initEdge, providerStatus, recommend, trackFetch } from './edge.mjs';
import 'next/server';

/**
 * Helper to wrap API route handlers with user context
 */
declare function withUserContext<T extends (...args: any[]) => any>(handler: T, userContext: _outboundiq_core.UserContext): T;

export { withUserContext };
