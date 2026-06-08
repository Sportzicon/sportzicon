import axios from "axios";

export interface RetryOptions {
  /** Maximum number of retry attempts after the initial call. Default: 2 */
  retries?: number;
  /** Base delay in ms between retries (exponential back-off). Default: 300 */
  baseDelayMs?: number;
  /** HTTP status codes that should NOT be retried. Default: [400,401,403,404,409,422] */
  noRetryStatuses?: number[];
}

const NON_RETRIABLE = [400, 401, 403, 404, 409, 422];

function shouldRetry(err: unknown, noRetryStatuses: number[]): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (!err.response) return true; // network error — always retry
  return !noRetryStatuses.includes(err.response.status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a service instance so that any async method returning a rejected Promise
 * will be retried up to `retries` times with exponential back-off.
 *
 * Client errors (4xx) and non-Axios errors are not retried.
 *
 * Usage:
 *   export const postService = withRetry(new PostService(api), { retries: 2 });
 */
export function withRetry<T extends object>(service: T, options: RetryOptions = {}): T {
  const {
    retries        = 2,
    baseDelayMs    = 300,
    noRetryStatuses = NON_RETRIABLE,
  } = options;

  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      return async function (...args: unknown[]) {
        let attempt = 0;
        while (true) {
          try {
            return await value.apply(target, args);
          } catch (err) {
            if (attempt >= retries || !shouldRetry(err, noRetryStatuses)) throw err;
            const backoff = baseDelayMs * Math.pow(2, attempt);
            await delay(backoff);
            attempt++;
          }
        }
      };
    },
  });
}
