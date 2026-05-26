import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "UNPROCESSABLE",
        message: "Validation failed",
        details: err.flatten()
      }
    });
    return;
  }

  // Unknown errors — never leak stack/message to the client in prod.
  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: isProd ? "Internal server error" : String((err as Error)?.message ?? err)
    }
  });
};
