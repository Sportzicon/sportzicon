export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export const NotFound = (msg = "Not found") => new AppError(404, "NOT_FOUND", msg);
export const BadRequest = (msg = "Bad request") => new AppError(400, "BAD_REQUEST", msg);
export const Forbidden = (msg = "Forbidden") => new AppError(403, "FORBIDDEN", msg);
export const Unauthorized = (msg = "Unauthorized") => new AppError(401, "UNAUTHORIZED", msg);

export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
