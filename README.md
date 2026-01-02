# @outboundiq/nextjs

OutboundIQ SDK for Next.js - Automatic tracking of all outbound API calls with zero effort.

## Features

- 🔌 **Plug and Play** - Just install, add env vars, and forget
- 🚀 **Non-blocking** - Never slows down your app
- 📡 **Universal** - Tracks fetch, axios, got, and any HTTP client
- 👤 **User Context** - Know who made each API call
- 🌐 **Full Coverage** - Works in Server Components, API Routes, Server Actions, Middleware

## Installation

```bash
npm install @outboundiq/nextjs
# or
yarn add @outboundiq/nextjs
# or
pnpm add @outboundiq/nextjs
```

## Quick Start

### 1. Add Environment Variables

```env
OUTBOUNDIQ_API_KEY=your-api-key
OUTBOUNDIQ_PROJECT_ID=your-project-id
```

### 2. Create instrumentation.ts

Create `instrumentation.ts` in your project root (next to `package.json`):

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@outboundiq/nextjs/register');
  }
}
```

### 3. Enable Instrumentation in next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

**Done!** All outbound API calls are now automatically tracked.

## User Context (Optional)

To track which user made each API call, add middleware:

```typescript
// middleware.ts
import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
import { NextResponse } from 'next/server';

export default withOutboundIQ(async (request) => {
  // Your existing middleware logic
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### With NextAuth

```typescript
import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
import { getToken } from 'next-auth/jwt';

export default withOutboundIQ(async (request) => {
  return NextResponse.next();
}, {
  getUserContext: async (request) => {
    const token = await getToken({ req: request });
    return token ? {
      userId: token.sub,
      userType: 'User',
      context: 'authenticated',
    } : null;
  },
});
```

### With Clerk

```typescript
import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
import { clerkMiddleware, getAuth } from '@clerk/nextjs/server';

export default withOutboundIQ(async (request) => {
  return clerkMiddleware()(request);
}, {
  getUserContext: async (request) => {
    const { userId } = getAuth(request);
    return userId ? {
      userId,
      context: 'authenticated',
    } : null;
  },
});
```

## Edge Runtime

For Edge API routes and middleware, use the edge-specific imports:

```typescript
// app/api/edge-route/route.ts
import { initEdge, trackFetch } from '@outboundiq/nextjs/edge';

export const runtime = 'edge';

export async function GET(request: Request) {
  initEdge(); // Initialize once

  // Use trackFetch for manual tracking in edge
  const response = await trackFetch('https://api.example.com/data');
  
  return Response.json(await response.json());
}
```

## Configuration

All configuration is via environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `OUTBOUNDIQ_API_KEY` | Yes | Your OutboundIQ API key |
| `OUTBOUNDIQ_PROJECT_ID` | Yes | Your OutboundIQ project ID |
| `OUTBOUNDIQ_ENDPOINT` | No | Custom ingest endpoint |
| `OUTBOUNDIQ_DEBUG` | No | Enable debug logging (`true`/`false`) |
| `OUTBOUNDIQ_BATCH_SIZE` | No | Batch size before flush (default: 10) |
| `OUTBOUNDIQ_FLUSH_INTERVAL` | No | Flush interval in ms (default: 5000) |

## What Gets Tracked

All outbound HTTP requests from:

- ✅ Server Components (`fetch()`)
- ✅ API Routes (`fetch()`, axios, got, etc.)
- ✅ Server Actions (`fetch()`)
- ✅ Route Handlers (`fetch()`)
- ✅ Any library using Node.js http/https

**Not tracked:**
- ❌ Client-side browser requests (intentional)
- ❌ Requests to OutboundIQ itself (intentional)

## API Reference

### `withOutboundIQ(middleware, options?)`

Wrap your middleware to inject user context.

```typescript
withOutboundIQ(
  middleware: (request: NextRequest) => Promise<NextResponse>,
  options?: {
    getUserContext?: (request: NextRequest) => Promise<UserContext | null>;
    excludePatterns?: (string | RegExp)[];
  }
)
```

### `track(call)`

Manually track an API call (rarely needed).

```typescript
import { track } from '@outboundiq/nextjs';

track({
  method: 'POST',
  url: 'https://api.example.com/data',
  statusCode: 200,
  duration: 150,
  userContext: { userId: '123', context: 'authenticated' },
});
```

### `setUserContext(context)`

Set user context for subsequent calls in the current request.

```typescript
import { setUserContext } from '@outboundiq/nextjs';

setUserContext({
  userId: '123',
  userType: 'Admin',
  context: 'authenticated',
});
```

## License

MIT

