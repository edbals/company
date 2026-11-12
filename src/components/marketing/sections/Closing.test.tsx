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
import { Closing } from "./Closing";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Closing", () => {
  it("is only the bear, one line and the demo button", () => {
    render(<Closing />);
    expect(screen.getByRole("link", { name: /Try demo/ })).toHaveAttribute("href", "/demo");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("is labelled by its heading", () => {
    render(<Closing />);
    expect(document.getElementById("closing")).toHaveAttribute("aria-labelledby", "closing-title");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("See it for yourself.");
  });
});
