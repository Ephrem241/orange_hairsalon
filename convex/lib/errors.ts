import { ConvexError } from 'convex/values'

/**
 * Throw a stable UPPER_SNAKE error code (plus optional detail). The Next.js
 * server maps codes to friendly copy in src/lib/booking/errors.ts.
 */
export function fail(code: string, detail?: string): never {
  throw new ConvexError(detail === undefined ? { code } : { code, detail })
}
