import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

// Map Zod's technical messages to plain English.
function cleanZodMessage(msg: string): string {
  return msg
    .replace(/String must contain at least (\d+) character\(s\)/, "Must be at least $1 characters")
    .replace(/String must contain at most (\d+) character\(s\)/, "Must be at most $1 characters")
    .replace(/Number must be greater than or equal to (\d+)/, "Must be at least $1")
    .replace(/Number must be less than or equal to (\d+)/, "Must be at most $1")
    .replace(/Expected string, received (null|undefined)/, "This field is required")
    .replace(/Expected number, received string/, "Must be a number")
    .replace(/Expected number, received (null|undefined)/, "This field is required")
    .replace(/Invalid email/, "Must be a valid email address")
    .replace(/Invalid url/, "Must be a valid URL")
    .replace(/^Required$/, "This field is required")
    .replace(/Invalid enum value\. Expected (.+), received .+/, "Must be one of: $1");
}

function toTitleCase(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
    return;
  }

  if (err instanceof ZodError) {
    const flat = err.flatten();

    // Build cleaned field errors.
    const fieldErrors: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(flat.fieldErrors)) {
      fieldErrors[field] = (messages ?? []).map(cleanZodMessage);
    }
    const formErrors: string[] = (flat.formErrors ?? []).map(cleanZodMessage);

    // Build a single human-readable summary message.
    const fieldNames = Object.keys(fieldErrors);
    let message: string;
    if (fieldNames.length === 1) {
      const field = fieldNames[0];
      message = `${toTitleCase(field)}: ${fieldErrors[field][0]}`;
    } else if (fieldNames.length > 1) {
      message = `Please fix the following: ${fieldNames.map(toTitleCase).join(", ")}`;
    } else if (formErrors.length) {
      message = formErrors[0];
    } else {
      message = "Please check your input and try again";
    }

    res.status(422).json({
      error: { code: "VALIDATION", message, details: { fieldErrors, formErrors } }
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: isProd ? "Something went wrong. Please try again." : String((err as Error)?.message ?? err)
    }
  });
};
