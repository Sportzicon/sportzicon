import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";

export const app = createApp();
export const api = () => request(app);

export function extractCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`))?.split(";")[0];
}

export async function signupAndLogin(opts: {
  email: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: "athlete" | "club" | "scout" | "organizer";
}) {
  const password = opts.password ?? "TestPass123!";
  const body = {
    email: opts.email,
    password,
    full_name: opts.full_name ?? opts.email.split("@")[0],
    phone: opts.phone ?? "+91" + Math.floor(Math.random() * 10_000_000_000).toString().padStart(10, "0"),
    role: opts.role ?? "athlete"
  };
  await api().post("/api/v1/auth/signup").send(body).expect(201);

  // Bypass email verification for tests — mark the account directly in the DB.
  await prisma.user.update({
    where: { email_lower: opts.email.toLowerCase() },
    data: { email_verified: true, status: "active" }
  });

  const login = await api().post("/api/v1/auth/login").send({ email: opts.email, password }).expect(200);
  return {
    user: login.body.user,
    access_token: login.body.access_token as string,
    refresh_cookie: extractCookie(login, "refresh_token") as string,
    auth: { Authorization: `Bearer ${login.body.access_token}` }
  };
}
