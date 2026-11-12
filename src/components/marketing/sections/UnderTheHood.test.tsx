import { cleanup, render, screen, within } from "@testing-library/react";
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
import { UnderTheHood } from "./UnderTheHood";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UnderTheHood", () => {
  it("lists the five engineering choices in order", () => {
    render(<UnderTheHood />);
    const choices = screen.getByRole("list", { name: "Five engineering choices" });
    const items = within(choices).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.querySelector("strong")?.textContent)).toEqual([
      "Specialists",
      "The Coordinator",
      "Rules",
      "Consent",
      "Private by default",
    ]);
    expect(items[0]!.textContent).toContain("work at the same time");
    expect(items[1]!.textContent).toContain("discards anything the specialists didn’t suggest");
    expect(items[2]!.textContent).toContain("hourly limit on AI use");
    expect(items[3]!.textContent).toContain("the cost checked again and 10 seconds to undo");
    expect(items[4]!.textContent).toContain("family never sees chats or memory");
  });

  it("shows the stack as one quiet line, with no architecture rows", () => {
    render(<UnderTheHood />);
    expect(
      screen.getByText(
        "TypeScript · React 19 · TanStack Start · Supabase Postgres · Zod · Vitest · ElevenLabs",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/architecture summary/)).toBeNull();
    expect(screen.queryByText("Browser · React")).toBeNull();
    expect(screen.queryByText(/Select a box/)).toBeNull();
  });

  it("states what is not connected yet", () => {
    render(<UnderTheHood />);
    expect(screen.getByText(/Not connected yet/)).toBeTruthy();
    expect(document.getElementById("tech")).toHaveAttribute("aria-labelledby", "tech-title");
    expect(document.body.textContent).not.toMatch(/demo/i);
  });
});
