import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/errors";
import * as svc from "./auth.service";

const router = Router();

// SSO — exchange a valid Sportivox main-app JWT for a scoring JWT (no password, no local account)
router.post("/sso", asyncHandler(async (req: any, res: any) => {
  const { main_token } = z.object({ main_token: z.string() }).parse(req.body);
  const r = svc.ssoFromMainToken(main_token);
  res.json(r);
}));

export default router;
