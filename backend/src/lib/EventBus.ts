import { logger } from "../config/logger";

type AsyncHandler<T> = (payload: T) => Promise<void>;

/**
 * Lightweight synchronous-subscription, asynchronous-execution event bus.
 *
 * Handlers are fired in registration order and awaited sequentially.
 * A failing handler logs a warning but does NOT abort the remaining handlers
 * or the calling service — side-effects must never break core domain logic.
 *
 * Usage:
 *   eventBus.on("application.transitioned", myHandler);
 *   eventBus.emit("application.transitioned", payload);
 */
class EventBus {
  private readonly handlers = new Map<string, AsyncHandler<unknown>[]>();

  on<T>(event: string, handler: AsyncHandler<T>): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler as AsyncHandler<unknown>);
  }

  /**
   * Fire all registered handlers for the event.
   * Deliberately fire-and-forget at the call site — do not await this.
   * Errors in handlers are caught and logged, never re-thrown.
   */
  emit<T>(event: string, payload: T): void {
    const fns = this.handlers.get(event);
    if (!fns?.length) return;

    Promise.all(
      fns.map((fn) =>
        fn(payload as unknown).catch((err) =>
          logger.warn({ err, event }, "event handler failed")
        )
      )
    ).catch(() => {
      /* outer safety net — Promise.all itself never rejects here */
    });
  }
}

export const eventBus = new EventBus();
