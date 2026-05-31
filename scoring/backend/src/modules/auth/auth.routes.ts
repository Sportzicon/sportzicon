import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/errors";
import * as svc from "./auth.service";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(2),
  role: z.enum(["admin", "organizer", "scorer", "viewer"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/signup", asyncHandler(async (req: any, res: any) => {
  const body = signupSchema.parse(req.body);
  const r = await svc.signup(body);
  res.status(201).json(r);
}));

router.post("/login", asyncHandler(async (req: any, res: any) => {
  const { email, password } = loginSchema.parse(req.body);
  const r = await svc.login(email, password);
  res.json(r);
}));

router.post("/refresh", asyncHandler(async (req: any, res: any) => {
  const { refresh_token } = z.object({ refresh_token: z.string() }).parse(req.body);
  const r = await svc.refresh(refresh_token);
  res.json(r);
}));

router.post("/logout", asyncHandler(async (req: any, res: any) => {
  const { refresh_token } = z.object({ refresh_token: z.string() }).parse(req.body);
  const r = await svc.logout(refresh_token);
  res.json(r);
}));

export default router;
