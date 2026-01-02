'use strict';

var server = require('next/server');

// src/middleware.ts
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

exports.USER_CONTEXT_HEADER = USER_CONTEXT_HEADER;
exports.createOutboundIQMiddleware = createOutboundIQMiddleware;
exports.getUserContextFromRequest = getUserContextFromRequest;
exports.withOutboundIQ = withOutboundIQ;
//# sourceMappingURL=middleware.js.map
//# sourceMappingURL=middleware.js.map