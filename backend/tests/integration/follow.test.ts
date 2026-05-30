import { api, signupAndLogin } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

describe("follow / unfollow", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("follow increments counts; unfollow decrements; idempotent", async () => {
    const a = await signupAndLogin({ email: "a@test.dev" });
    const b = await signupAndLogin({ email: "b@test.dev" });

    await api().post(`/api/v1/follow/${b.user.id}`).set(a.auth).expect(200);
    await api().post(`/api/v1/follow/${b.user.id}`).set(a.auth).expect(200); // idempotent

    const isFol = await api().get(`/api/v1/follow/status/${b.user.id}`).set(a.auth).expect(200);
    expect(isFol.body.following).toBe(true);

    const bProfile = await api().get(`/api/v1/users/${b.user.id}`).set(a.auth).expect(200);
    expect(bProfile.body.user.follower_count).toBe(1);

    const aProfile = await api().get(`/api/v1/users/${a.user.id}`).set(a.auth).expect(200);
    expect(aProfile.body.user.following_count).toBe(1);

    await api().delete(`/api/v1/follow/${b.user.id}`).set(a.auth).expect(200);

    const bProfile2 = await api().get(`/api/v1/users/${b.user.id}`).set(a.auth).expect(200);
    expect(bProfile2.body.user.follower_count).toBe(0);
  });

  test("cannot follow self", async () => {
    const a = await signupAndLogin({ email: "self@test.dev" });
    const r = await api().post(`/api/v1/follow/${a.user.id}`).set(a.auth);
    expect(r.status).toBe(400);
  });
});
