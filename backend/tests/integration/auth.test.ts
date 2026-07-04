import { api, signupAndLogin, extractCookie } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

describe("auth", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("signup rejects weak passwords", async () => {
    const r = await api().post("/api/v1/auth/signup").send({
      email: "weak@test.dev",
      password: "weak",
      full_name: "Weak Pwd",
      phone: "+911234567890",
      role: "athlete"
    });
    expect(r.status).toBe(422);
  });

  test("signup rejects admin role from public registration", async () => {
    const r = await api().post("/api/v1/auth/signup").send({
      email: "naughty@test.dev",
      password: "StrongPass1!",
      full_name: "Naughty",
      phone: "+911234567891",
      role: "admin" as any
    });
    expect(r.status).toBe(422);
  });

  test("login fails before email verification", async () => {
    await api().post("/api/v1/auth/signup").send({
      email: "unverified@test.dev",
      password: "StrongPass1!",
      full_name: "Unverified",
      phone: "+911234567892",
      role: "athlete"
    }).expect(201);
    const r = await api().post("/api/v1/auth/login").send({ email: "unverified@test.dev", password: "StrongPass1!" });
    expect(r.status).toBe(401);
  });

  test("signup -> verify -> login -> me", async () => {
    const a = await signupAndLogin({ email: "happy@test.dev" });
    expect(a.access_token).toBeTruthy();
    const me = await api().get("/api/v1/auth/me").set(a.auth).expect(200);
    expect(me.body.user.email).toBe("happy@test.dev");
  });

  test("refresh rotates the token", async () => {
    const a = await signupAndLogin({ email: "rotator@test.dev" });
    const r = await api().post("/api/v1/auth/refresh").set("Cookie", a.refresh_cookie).expect(200);
    const rotated = extractCookie(r, "refresh_token");
    expect(rotated).not.toBe(a.refresh_cookie);
    // Old refresh token should now be rejected
    const r2 = await api().post("/api/v1/auth/refresh").set("Cookie", a.refresh_cookie);
    expect(r2.status).toBe(401);
  });

  test("duplicate email is rejected", async () => {
    await signupAndLogin({ email: "dup@test.dev" });
    const r = await api().post("/api/v1/auth/signup").send({
      email: "dup@test.dev",
      password: "StrongPass1!",
      full_name: "Dup",
      phone: "+911999999990",
      role: "athlete"
    });
    expect(r.status).toBe(409);
  });
});
