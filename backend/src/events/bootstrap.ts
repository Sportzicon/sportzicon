import { registerNotificationHandlers } from "./handlers/notificationHandler";

/**
 * Bootstrap all domain event handlers.
 * Called once during application startup, before the HTTP server opens.
 * Add new handler registrations here as new cross-cutting concerns are introduced.
 */
export function bootstrapEventHandlers(): void {
  registerNotificationHandlers();
}
