import { BadRequest } from "../utils/errors";

export interface Transition<S extends string> {
  from: S | S[];
  to: S;
  guard?: (context: unknown) => boolean | Promise<boolean>;
}

type TransitionListener<S extends string> = (
  from: S,
  to: S,
  context: unknown
) => void | Promise<void>;

/**
 * Generic finite-state machine.
 *
 * Usage:
 *   const fsm = new StateMachine("pending", APPLICATION_TRANSITIONS);
 *   fsm.on("shortlisted", async (from, to, ctx) => { ... });
 *   await fsm.transition("shortlisted", context);
 */
export class StateMachine<S extends string> {
  private readonly listeners = new Map<S, TransitionListener<S>[]>();

  constructor(
    private current: S,
    private readonly transitions: Transition<S>[]
  ) {}

  get state(): S {
    return this.current;
  }

  can(next: S): boolean {
    return this.transitions.some((t) => {
      const fromMatch = Array.isArray(t.from)
        ? t.from.includes(this.current)
        : t.from === this.current;
      return fromMatch && t.to === next;
    });
  }

  on(state: S, listener: TransitionListener<S>): this {
    if (!this.listeners.has(state)) this.listeners.set(state, []);
    this.listeners.get(state)!.push(listener);
    return this;
  }

  async transition(next: S, context?: unknown): Promise<void> {
    const matched = this.transitions.find((t) => {
      const fromMatch = Array.isArray(t.from)
        ? t.from.includes(this.current)
        : t.from === this.current;
      return fromMatch && t.to === next;
    });

    if (!matched) {
      throw BadRequest(`Illegal transition: ${this.current} → ${next}`);
    }

    if (matched.guard) {
      const allowed = await matched.guard(context);
      if (!allowed) throw BadRequest(`Transition guard failed: ${this.current} → ${next}`);
    }

    const prev = this.current;
    this.current = next;

    const handlers = this.listeners.get(next) ?? [];
    for (const handler of handlers) {
      await handler(prev, next, context);
    }
  }
}
