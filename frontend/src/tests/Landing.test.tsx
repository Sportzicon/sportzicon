import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect } from "vitest";
import Landing from "../modules/landing/pages/Landing";

describe("Landing", () => {
  test("renders hero copy and CTA", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );
    expect(screen.getByText(/Get discovered. Get recruited./i)).toBeInTheDocument();
    expect(screen.getByText(/Create your profile/i)).toBeInTheDocument();
  });
});
