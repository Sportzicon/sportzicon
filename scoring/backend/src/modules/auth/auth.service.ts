import jwt from "jsonwebtoken";
import { Unauthorized } from "../../utils/errors";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";
const ACCESS_TTL = "15m";

if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

function signAccess(user: { id: string; role: string; email: string; name: string }) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

// Exchanges a valid main Sportivox access token for a scoring-scoped JWT.
// Stateless: no DB row is created or read. `sub` on the returned token is
// the same main User.id — every scoring table FKs straight to it.
export function ssoFromMainToken(mainToken: string) {
  if (!MAIN_JWT_SECRET) throw Unauthorized("SSO not configured");

  let claims: any;
  try {
    claims = jwt.verify(mainToken, MAIN_JWT_SECRET);
  } catch {
    throw Unauthorized("Invalid or expired Sportivox token");
  }

  if (claims.type !== "access") throw Unauthorized("Invalid token type");
  if (!claims.email || !claims.sub) throw Unauthorized("Token missing required claims");

  const user = {
    id: claims.sub as string,
    email: (claims.email as string).toLowerCase(),
    full_name: (claims.name as string) ?? claims.email,
    role: (claims.role as string) ?? "athlete",
  };

  const access_token = signAccess({ id: user.id, role: user.role, email: user.email, name: user.full_name });

  return { user, access_token };
}
