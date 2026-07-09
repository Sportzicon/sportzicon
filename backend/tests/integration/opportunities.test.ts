import { api, signupAndLogin } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

async function setupClubAndOrg() {
  const club = await signupAndLogin({ email: "club@test.dev", role: "club" });
  const org = await api()
    .post("/api/v1/organizations")
    .set(club.auth)
    .send({
      org_name: "Test FC",
      org_type: "club",
      sport_categories: ["football"],
      country: "India",
      state: "KA",
      city: "Bengaluru"
    })
    .expect(201);
  return { club, org: org.body.organization };
}

describe("opportunities + applications", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("club posts an opportunity, athlete applies, club shortlists & selects", async () => {
    const { club, org } = await setupClubAndOrg();
    const athlete = await signupAndLogin({ email: "p1@test.dev", role: "athlete" });
    // Need DOB so the eligibility check passes
    await api()
      .put("/api/v1/users/me")
      .set(athlete.auth)
      .send({ dob: "2005-01-01", country: "India", state: "KA", city: "Bengaluru" })
      .expect(200);

    const oppRes = await api()
      .post("/api/v1/opportunities")
      .set(club.auth)
      .send({
        org_id: org.id,
        title: "Trial Day",
        type: "trial",
        sport: "football",
        description: "Open trial for striker positions.",
        age_min: 16,
        age_max: 25,
        country: "India",
        state: "KA",
        city: "Bengaluru",
        start_date: "2030-01-10",
        end_date: "2030-01-12",
        application_deadline: "2030-01-05",
        vacancies: 1
      })
      .expect(201);
    const opp = oppRes.body.opportunity;

    const applyRes = await api()
      .post(`/api/v1/opportunities/${opp.id}/apply`)
      .set(athlete.auth)
      .send({ cover_note: "Pick me" })
      .expect(201);
    expect(applyRes.body.application.status).toBe("pending");
    const appId = applyRes.body.application.id;

    // Cannot apply twice
    const dup = await api().post(`/api/v1/opportunities/${opp.id}/apply`).set(athlete.auth).send({});
    expect(dup.status).toBe(409);

    // Athlete cannot transition state (only poster can)
    const athletePatch = await api()
      .patch(`/api/v1/applications/${appId}/status`)
      .set(athlete.auth)
      .send({ status: "shortlisted" });
    expect(athletePatch.status).toBe(403);

    // Club shortlists
    const sl = await api()
      .patch(`/api/v1/applications/${appId}/status`)
      .set(club.auth)
      .send({ status: "shortlisted" })
      .expect(200);
    expect(sl.body.application.status).toBe("shortlisted");

    // Cannot jump from shortlisted to shortlisted or back to pending
    const bad = await api()
      .patch(`/api/v1/applications/${appId}/status`)
      .set(club.auth)
      .send({ status: "shortlisted" });
    expect(bad.status).toBe(422);

    // Selected -> opportunity should become "filled" since vacancies=1
    await api()
      .patch(`/api/v1/applications/${appId}/status`)
      .set(club.auth)
      .send({ status: "selected" })
      .expect(200);

    const updatedOpp = await api().get(`/api/v1/opportunities/${opp.id}`).set(club.auth).expect(200);
    expect(updatedOpp.body.opportunity.status).toBe("filled");
  });

  test("non-club users cannot create an opportunity", async () => {
    const athlete = await signupAndLogin({ email: "athl@test.dev", role: "athlete" });
    const r = await api().post("/api/v1/opportunities").set(athlete.auth).send({
      org_id: "00000000-0000-0000-0000-000000000000",
      title: "Hax",
      type: "trial",
      sport: "football",
      description: "Should fail",
      age_min: 18,
      age_max: 25,
      country: "IN",
      state: "KA",
      city: "BLR",
      start_date: "2030-01-10",
      end_date: "2030-01-12",
      application_deadline: "2030-01-05"
    });
    expect(r.status).toBe(403);
  });
});
