import { api, signupAndLogin } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

describe("content: posts + reels + blogs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("post -> like -> comment lifecycle", async () => {
    const a = await signupAndLogin({ email: "p@test.dev" });
    const create = await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({ content_type: "post", type: "log", text: "Speed work today. 6x200m." })
      .expect(201);
    const id = create.body.content.id;

    await api().post(`/api/v1/content/${id}/like`).set(a.auth).expect(200);
    await api().post(`/api/v1/content/${id}/comments`).set(a.auth).send({ text: "Solid." }).expect(201);

    const list = await api().get(`/api/v1/content/${id}/comments`).set(a.auth).expect(200);
    expect(list.body.data.length).toBe(1);
  });

  test("only author or admin can delete a post", async () => {
    const a = await signupAndLogin({ email: "owner@test.dev" });
    const b = await signupAndLogin({ email: "other@test.dev" });
    const r = await api().post("/api/v1/content").set(a.auth).send({ content_type: "post", text: "hi" }).expect(201);
    const id = r.body.content.id;
    const denied = await api().delete(`/api/v1/content/${id}`).set(b.auth);
    expect(denied.status).toBe(403);
    await api().delete(`/api/v1/content/${id}`).set(a.auth).expect(200);
  });

  test("blog draft is hidden from public list", async () => {
    const a = await signupAndLogin({ email: "blogger@test.dev" });
    await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({
        content_type: "blog",
        title: "Draft post",
        body_markdown: "# Hello world this is enough characters for the validator.",
        status: "draft"
      })
      .expect(201);
    const list = await api().get("/api/v1/content").set(a.auth).query({ content_type: "blog" }).expect(200);
    expect(list.body.items.length).toBe(0);
  });

  test("reel create and list", async () => {
    const a = await signupAndLogin({ email: "reeler@test.dev" });
    await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({ content_type: "reel", video_url: "https://example.com/v.mp4", title: "Free kick" })
      .expect(201);
    const list = await api().get("/api/v1/content").set(a.auth).query({ content_type: "reel" }).expect(200);
    expect(list.body.items.length).toBe(1);
  });
});
