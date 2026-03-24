# @outbound_iq/nextjs

Next.js integration for OutboundIQ - Third-party API monitoring and analytics.

## Installation

```bash
npm install @outbound_iq/nextjs
```

## Quick Start

### 1. Add Environment Variables

```env
OUTBOUNDIQ_KEY=your-api-key
```

See **Configuration** if you need to tune batching, point at a custom ingest URL, or enable verbose logging.

### 2. Create instrumentation.ts

Add `instrumentation.ts` at the **project root**, or inside **`src/`** if that is where your app lives (same rule as Next.js). Import our register hook only in the **Node** runtime (this package patches `http`/`https` and uses AsyncLocalStorage — it does not run on the Edge runtime):

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@outbound_iq/nextjs/register');
  }
}
```

### 3. Enable instrumentation (depends on Next.js version)

- **Next.js 15+** — Instrumentation is **stable**; you usually **do not** need `experimental.instrumentationHook`. If `register` never runs, ensure you are on a recent 15.x patch and that the file path matches [the instrumentation convention](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
- **Next.js 13.2 – 14.x** — Turn the hook on in config:

```javascript
// next.config.js
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

**Done!** Outbound `fetch` / Node HTTP traffic on the **server** is tracked. (Browser `fetch` from Client Components is not instrumented by this package — by design.)

### Requirements

- **Node.js** 18+
- **Next.js** 13.2+ (App Router instrumentation). Peer range is `next >= 13`; use **13.2+** if you rely on `instrumentation.ts`.

## Imports (important for Next.js)

The **root** package (`import { init, track } from '@outbound_iq/nextjs'`) only re-exports **browser-safe** APIs from `@outbound_iq/core`. It must **not** pull in Node builtins such as `module` or `async_hooks`, so your Client Components and shared `apiClient` can import it safely.

**Server-only** features use explicit subpaths (do **not** rely on the root barrel for these):

| Subpath | Use |
|---------|-----|
| `@outbound_iq/nextjs/register` | `instrumentation.ts` (Node runtime tracking) |
| `@outbound_iq/nextjs/middleware` | `middleware.ts` (user context headers) |
| `@outbound_iq/nextjs/edge` | Edge runtime / manual `trackFetch`, etc. |
| `@outbound_iq/nextjs/node` | Advanced: `patchNodeHttp`, `setUserContextResolver` |
| `@outbound_iq/nextjs/context` | Advanced: `runWithContext`, AsyncLocalStorage helpers |

If you previously imported `withOutboundIQ`, `trackFetch`, or Node patch helpers from `@outbound_iq/nextjs` directly, switch to the subpath in the table above.

## Configuration

For a normal setup you only need **`OUTBOUNDIQ_KEY`**. The SDK already defaults the ingest URL to `https://agent.outboundiq.dev/api/metric`, keeps debug logging **off**, and treats monitoring as **enabled** unless you set `OUTBOUNDIQ_ENABLED=false`.

Set the variables below only when you need to override those defaults (custom agent URL, troubleshooting, or batch tuning).

```bash
# Required in production
OUTBOUNDIQ_KEY=your-api-key

# Optional — only if your metrics must go somewhere other than the default URL above
OUTBOUNDIQ_URL=https://your-agent.example.com/api/metric

# Optional — default true; set false to disable without removing the key
OUTBOUNDIQ_ENABLED=true

# Optional — verbose SDK logging (default: off). Use when debugging delivery or batching.
OUTBOUNDIQ_DEBUG=true

# Optional — max calls to buffer before sending (default: 100)
OUTBOUNDIQ_MAX_ITEMS=100

# Optional — milliseconds between flushes (default: 5000). Used by the Node `register` hook.
OUTBOUNDIQ_FLUSH_INTERVAL=5000

# Optional — alias for OUTBOUNDIQ_MAX_ITEMS when unset. If both are set, MAX_ITEMS wins.
OUTBOUNDIQ_BATCH_SIZE=100
```

On the **Edge** runtime you still only *require* `OUTBOUNDIQ_KEY` for typical use; URL and debug behave the same (defaults apply). Batching there stays small for short-lived workers unless you pass `batchSize` / `flushInterval` to `initEdge()`.

## User Context (Optional)

Track which user made each API call:

```typescript
// middleware.ts
import { withOutboundIQ } from '@outbound_iq/nextjs/middleware';
import { NextResponse } from 'next/server';

export default withOutboundIQ(async (request) => {
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### With NextAuth

```typescript
import { withOutboundIQ } from '@outbound_iq/nextjs/middleware';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export default withOutboundIQ(async (request) => {
  return NextResponse.next();
}, {
  getUserContext: async (request) => {
    const token = await getToken({ req: request });
    return token ? {
      userId: token.sub,
      context: 'authenticated',
    } : null;
  },
});
```

## What Gets Tracked

All outbound HTTP requests from:
- ✅ Server Components
- ✅ API Routes
- ✅ Server Actions
- ✅ Route Handlers

**Not tracked:**
- ❌ Client-side browser requests (intentional)
- ❌ Requests to OutboundIQ itself

## License

MIT
