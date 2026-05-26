import request from "supertest";
import { createApp } from "../../src/app";

export const app = createApp();
export const api = () => request(app);

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

  // Auto-verify the account via Firestore so we can log in directly.
  const { db, Collections } = await import("../../src/config/firestore");
  const snap = await db.collection(Collections.users).where("email_lower", "==", opts.email.toLowerCase()).get();
  await snap.docs[0].ref.update({ email_verified: true, status: "active" });

  const login = await api().post("/api/v1/auth/login").send({ email: opts.email, password }).expect(200);
  return {
    user: login.body.user,
    access_token: login.body.access_token as string,
    refresh_token: login.body.refresh_token as string,
    auth: { Authorization: `Bearer ${login.body.access_token}` }
  };
}
