// Centralised error classes. The error middleware in middleware/errorHandler.ts
// inspects `statusCode` and `code` to format a consistent JSON response.

export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (msg = "Bad request", details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", msg, details);
export const Unauthorized = (msg = "Unauthorized") => new HttpError(401, "UNAUTHORIZED", msg);
export const Forbidden = (msg = "Forbidden") => new HttpError(403, "FORBIDDEN", msg);
export const NotFound = (msg = "Not found") => new HttpError(404, "NOT_FOUND", msg);
export const Conflict = (msg = "Conflict") => new HttpError(409, "CONFLICT", msg);
export const UnprocessableEntity = (msg = "Unprocessable entity", details?: unknown) =>
  new HttpError(422, "UNPROCESSABLE", msg, details);
export const TooManyRequests = (msg = "Too many requests") =>
  new HttpError(429, "RATE_LIMITED", msg);
export const Internal = (msg = "Internal server error") =>
  new HttpError(500, "INTERNAL", msg);
