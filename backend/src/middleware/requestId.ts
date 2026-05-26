import type { RequestHandler } from "express";
import { newId } from "../utils/ids";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
}

// Adds an X-Request-Id header and req.id for log correlation.
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : newId();
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
};
