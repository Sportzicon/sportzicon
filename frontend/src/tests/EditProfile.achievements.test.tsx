import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, test, expect, vi, beforeEach } from "vitest";
import EditProfile from "../modules/profile/pages/EditProfile";
import { useAuthStore } from "../store/auth";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: { put: vi.fn().mockResolvedValue({ data: { user: {} } }) },
  getApiError: (e: any) => ({ code: "unknown", message: String(e), details: undefined }),
  humanizeError: (e: any) => String(e),
}));

describe("EditProfile achievements", () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      accessToken: "t",
      user: {
        id: "u1",
        role: "athlete",
        full_name: "Test Athlete",
        athlete: { achievements: [] },
      } as any,
    });
  });

  test("typing + pressing Enter adds an achievement to the list", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EditProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Press Enter or click \+ to add\. 0\/20 items\./i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Add an achievement/i);
    fireEvent.change(input, { target: { value: "Man of the Match" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText(/Press Enter or click \+ to add\. 1\/20 items\./i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Man of the Match")).toBeInTheDocument();
  });

  test("typing + clicking + adds an achievement to the list", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EditProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/Add an achievement/i);
    fireEvent.change(input, { target: { value: "Regional Champion" } });
    fireEvent.click(screen.getByTitle("Add"));

    expect(screen.getByText(/Press Enter or click \+ to add\. 1\/20 items\./i)).toBeInTheDocument();
  });

  test("typed-but-not-added achievement is still included on Save", async () => {
    (api.put as any).mockClear();
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EditProfile />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Type text but never press Enter or click "+".
    const input = screen.getByPlaceholderText(/Add an achievement/i);
    fireEvent.change(input, { target: { value: "Untriggered Achievement" } });
    expect(screen.getByText(/Press Enter or click \+ to add\. 0\/20 items\./i)).toBeInTheDocument();

    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/users/me/athlete",
        expect.objectContaining({ achievements: ["Untriggered Achievement"] })
      );
    });
  });
});
