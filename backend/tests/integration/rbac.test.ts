import { api, signupAndLogin } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

describe("RBAC enforcement", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("unauthenticated cannot hit protected endpoints", async () => {
    const r = await api().get("/api/v1/auth/me");
    expect(r.status).toBe(401);
  });

  test("non-admin cannot access admin endpoints", async () => {
    const a = await signupAndLogin({ email: "ah@test.dev" });
    const r = await api().get("/api/v1/admin/users").set(a.auth);
    expect(r.status).toBe(403);
  });

  test("athlete cannot create org or opportunity", async () => {
    const a = await signupAndLogin({ email: "athonly@test.dev" });
    const org = await api().post("/api/v1/organizations").set(a.auth).send({
      org_name: "Should be denied",
      org_type: "club"
    });
    expect(org.status).toBe(403);
  });

  test("non-athlete cannot apply for an opportunity", async () => {
    const club = await signupAndLogin({ email: "klub@test.dev", role: "club" });
    const orgRes = await api()
      .post("/api/v1/organizations")
      .set(club.auth)
      .send({ org_name: "Klub", org_type: "club" })
      .expect(201);
    const oppRes = await api()
      .post("/api/v1/opportunities")
      .set(club.auth)
      .send({
        org_id: orgRes.body.organization.id,
        title: "Trial opening",
        type: "trial",
        sport: "football",
        description: "Lorem ipsum dolor sit",
        age_min: 16,
        age_max: 26,
        country: "IN",
        state: "KA",
        city: "BLR",
        start_date: "2030-01-10",
        end_date: "2030-01-12",
        application_deadline: "2030-01-05"
      })
      .expect(201);

    const scout = await signupAndLogin({ email: "scoutapply@test.dev", role: "scout" });
    const r = await api()
      .post(`/api/v1/opportunities/${oppRes.body.opportunity.id}/apply`)
      .set(scout.auth)
      .send({});
    expect(r.status).toBe(403);
  });
});
