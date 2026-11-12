import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
import { Hero } from "./Hero";

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (milliseconds: number) => {
  act(() => vi.advanceTimersByTime(milliseconds));
};

describe("Hero", () => {
  it("leads to the agent walkthrough and the demo page", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: /Watch the agents work/ })).toHaveAttribute(
      "href",
      "#agents",
    );
    expect(screen.getByRole("link", { name: /Try demo/ })).toHaveAttribute("href", "/demo");
  });

  it("shows the first example as a plan waiting for a yes", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("jazz afternoon");
    expect(screen.getByRole("heading", { name: "Jazz at the Lakeside Café" })).toBeTruthy();
    expect(screen.getByText("Yes, go ahead")).toBeTruthy();
    expect(screen.getByText(/Nothing here is sent or booked/)).toBeTruthy();
  });

  it("automatically cycles all goals and their plans in three dedicated headline lines", () => {
    stubReducedMotion(false);
    render(<Hero />);
    const title = screen.getByRole("heading", { level: 1 });
    const examples = [
      ["jazz afternoon.", "Jazz at the Lakeside Café"],
      ["grocery run.", "Milk and bread"],
      ["coffee with Walt.", "Coffee with Walt"],
    ] as const;

    for (const [label, planTitle] of examples) {
      expect(Array.from(title.children, (line) => line.textContent)).toEqual([
        "Company  plans the",
        label,
        "You just say yes.",
      ]);
      // Advance each phone step separately so React can schedule the next one.
      advance(1100);
      advance(1100);
      advance(1100);
      expect(screen.getByRole("heading", { name: planTitle })).toBeTruthy();
      advance(4700);
    }
    expect(title).toHaveTextContent("jazz afternoon.");
  });

  it.each([true, false])("removes example controls with reduced motion = %s", (reduced) => {
    stubReducedMotion(reduced);
    render(<Hero />);
    expect(screen.queryByText("Try:")).toBeNull();
    expect(screen.queryByRole("group", { name: "Choose an example" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /jazz afternoon|grocery run|coffee with Walt/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Pause examples|Play examples/ })).toBeNull();
  });

  it("does not rotate when reduced motion is preferred", () => {
    render(<Hero />);
    advance(24000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("jazz afternoon.");
    expect(screen.getByRole("heading", { name: "Jazz at the Lakeside Café" })).toBeTruthy();
  });

  it("pauses on hover and resumes after leaving", () => {
    stubReducedMotion(false);
    render(<Hero />);
    const title = screen.getByRole("heading", { level: 1 });
    const hero = screen.getByRole("region", { name: /Company/ });
    fireEvent.mouseEnter(hero);
    advance(16000);
    expect(title).toHaveTextContent("jazz afternoon.");
    fireEvent.mouseLeave(hero);
    advance(8000);
    expect(title).toHaveTextContent("grocery run.");
  });

  it("stays paused while focus is inside, even after the pointer leaves", () => {
    stubReducedMotion(false);
    render(<Hero />);
    const title = screen.getByRole("heading", { level: 1 });
    const hero = screen.getByRole("region", { name: /Company/ });
    const watch = screen.getByRole("link", { name: /Watch the agents work/ });
    const start = screen.getByRole("link", { name: /Try demo/ });
    fireEvent.mouseEnter(hero);
    fireEvent.focus(watch);
    fireEvent.mouseLeave(hero);
    advance(8000);
    expect(title).toHaveTextContent("jazz afternoon.");
    fireEvent.blur(watch, { relatedTarget: start });
    fireEvent.focus(start);
    advance(8000);
    expect(title).toHaveTextContent("jazz afternoon.");
    fireEvent.blur(start, { relatedTarget: null });
    advance(8000);
    expect(title).toHaveTextContent("grocery run.");
  });
});
