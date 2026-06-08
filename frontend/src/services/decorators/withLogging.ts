/**
 * Wraps a service instance with method-level logging.
 * Every public method call logs its name + args on entry and outcome on exit.
 *
 * Only active in non-production builds — in production this returns the
 * original service instance unchanged to avoid console pollution.
 *
 * Usage:
 *   export const postService = withLogging(new PostService(api), "PostService");
 */
export function withLogging<T extends object>(service: T, name: string): T {
  if (import.meta.env.PROD) return service;

  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      return function (...args: unknown[]) {
        const label = `[${name}].${String(prop)}`;
        console.groupCollapsed(`%c${label}`, "color:#FA4D14;font-weight:600", ...args);
        console.trace("call stack");
        console.groupEnd();

        const result = value.apply(target, args);

        if (result instanceof Promise) {
          return result
            .then((res) => {
              console.log(`%c${label} ✓`, "color:#2E7D52;font-weight:600", res);
              return res;
            })
            .catch((err) => {
              console.error(`%c${label} ✗`, "color:#C0392B;font-weight:600", err);
              throw err;
            });
        }

        return result;
      };
    },
  });
}
