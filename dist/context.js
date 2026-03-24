'use strict';

var async_hooks = require('async_hooks');

// src/context/request-context.ts
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

exports.createRequestContext = createRequestContext;
exports.getCurrentUserContext = getCurrentUserContext;
exports.getRequestContext = getRequestContext;
exports.runWithContext = runWithContext;
exports.setCurrentUserContext = setCurrentUserContext;
//# sourceMappingURL=context.js.map
//# sourceMappingURL=context.js.map