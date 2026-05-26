import { api } from "../helpers/agent";

describe("health probes", () => {
  test("healthz returns 200", async () => {
    const r = await api().get("/healthz").expect(200);
    expect(r.body.ok).toBe(true);
  });
});
