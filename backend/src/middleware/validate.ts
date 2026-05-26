import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema, target: "body" | "query" | "params" = "body"): RequestHandler =>
  (req, _res, next) => {
    const data = (req as any)[target];
    const result = schema.safeParse(data);
    if (!result.success) {
      return next(result.error);
    }
    // Replace the original value with the parsed/coerced one so downstream code sees clean data.
    (req as any)[target] = result.data;
    next();
  };
