import { describe, expect, it, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("../main", () => ({ queryClient: { clear: vi.fn() } }));

import { refreshAcrossTabs } from "./client";
import { useAuthStore } from "../store/auth";

// Regression test for the intermittent-logout bug: refresh tokens are
// single-use server-side, so two tabs refreshing around the same time used to
// race — the loser wiped its session. refreshAcrossTabs must serialize the
// network call across tabs and let a losing tab reuse the winner's token
// (picked up via persist.rehydrate) instead of hitting the network again.
describe("refreshAcrossTabs", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: "old-token" });
    vi.restoreAllMocks();
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      locks: { request: (_name: string, cb: () => Promise<any>) => cb() }
    });
  });

  it("reuses the token a sibling tab already rotated, without calling the network", async () => {
    vi.spyOn(useAuthStore.persist, "rehydrate").mockImplementation(async () => {
      // Simulates another tab having won the race and persisted its new session.
      useAuthStore.setState({ accessToken: "token-from-winning-tab" });
    });
    const postSpy = vi.spyOn(axios, "post");

    const result = await refreshAcrossTabs("old-token");

    expect(result).toBe("token-from-winning-tab");
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("calls /auth/refresh when no other tab has refreshed yet", async () => {
    vi.spyOn(useAuthStore.persist, "rehydrate").mockImplementation(async () => {});
    const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: { access_token: "brand-new-token", user: { id: "u1" } }
    });

    const result = await refreshAcrossTabs("old-token");

    expect(result).toBe("brand-new-token");
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe("brand-new-token");
  });
});
