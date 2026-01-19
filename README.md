# @outboundiq/nextjs

Next.js integration for OutboundIQ - Third-party API monitoring and analytics.

## Installation

```bash
npm install @outboundiq/nextjs
```

## Quick Start

### 1. Add Environment Variables

```env
OUTBOUNDIQ_KEY=your-api-key
```

### 2. Create instrumentation.ts

Create `instrumentation.ts` in your project root:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@outboundiq/nextjs/register');
  }
}
```

### 3. Enable Instrumentation

```javascript
// next.config.js
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
```

**Done!** All outbound API calls are now automatically tracked.

## Configuration

```bash
# Required - your API key from OutboundIQ dashboard
OUTBOUNDIQ_KEY=your-api-key

# Custom endpoint URL (optional)
OUTBOUNDIQ_URL=https://agent.outboundiq.dev/api/metric

# Enable debug logging (optional)
OUTBOUNDIQ_DEBUG=true
```

## User Context (Optional)

Track which user made each API call:

```typescript
// middleware.ts
import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
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
import { withOutboundIQ } from '@outboundiq/nextjs/middleware';
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
