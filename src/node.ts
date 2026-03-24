/**
 * Node-only APIs (http/https patching, createRequire, etc.).
 * Import from `@outbound_iq/nextjs/node` in server files only — never from client components.
 *
 * @example
 * ```ts
 * import { patchNodeHttp } from '@outbound_iq/nextjs/node';
 * ```
 */
export {
  patchNodeHttp,
  unpatchNodeHttp,
  setUserContextResolver,
} from '@outbound_iq/core/node';
