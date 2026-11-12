import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    search: _search,
    ...props
  }: {
    to: string;
    children: ReactNode;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
import { stubReducedMotion } from "../test-utils";
import { Faq } from "./Faq";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Faq", () => {
  it("renders the six questions", () => {
    render(<Faq />);
    expect(document.querySelectorAll("details")).toHaveLength(6);
    expect(screen.getByText("What can I do in Company today?")).toBeTruthy();
    expect(screen.getByText("What if I need urgent help?")).toBeTruthy();
  });

  it("includes the urgent-help answer", () => {
    render(<Faq />);
    expect(screen.getByText(/Contact your local emergency services directly/)).toBeTruthy();
  });

  it("is labelled by its heading", () => {
    render(<Faq />);
    expect(document.getElementById("faq")).toHaveAttribute("aria-labelledby", "faq-title");
    expect(screen.getByRole("heading", { level: 2, name: "Good questions." })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/demo/i);
  });
});
