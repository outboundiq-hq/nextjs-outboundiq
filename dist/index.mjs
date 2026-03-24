export { flush, getClient, init, setUserContext, shutdown, track } from '@outbound_iq/core';

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

export { withUserContext };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map