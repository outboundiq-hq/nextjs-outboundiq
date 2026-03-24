/**
 * AsyncLocalStorage-based request context (Node.js server runtime only).
 * Do not import from client components.
 *
 * @example
 * ```ts
 * import { runWithContext, getCurrentUserContext } from '@outbound_iq/nextjs/context';
 * ```
 */
export {
  runWithContext,
  getRequestContext,
  getCurrentUserContext,
  setCurrentUserContext,
  createRequestContext,
  type RequestContext,
} from './context/request-context';
