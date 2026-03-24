import { AsyncLocalStorage } from 'async_hooks';

// src/context/request-context.ts
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

export { createRequestContext, getCurrentUserContext, getRequestContext, runWithContext, setCurrentUserContext };
//# sourceMappingURL=context.mjs.map
//# sourceMappingURL=context.mjs.map