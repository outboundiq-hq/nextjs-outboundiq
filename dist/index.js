'use strict';

var core = require('@outbound_iq/core');

// src/index.ts
function withUserContext(handler, userContext) {
  return (async (...args) => {
    const { setUserContext: setUserContext2 } = await import('@outbound_iq/core');
    setUserContext2(userContext);
    try {
      return await handler(...args);
    } finally {
      setUserContext2(null);
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
exports.withUserContext = withUserContext;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map