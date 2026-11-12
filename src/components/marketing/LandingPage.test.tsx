import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { LandingPage } from "./LandingPage";
import { stubReducedMotion } from "./test-utils";

const SECTION_ORDER = ["why", "agents", "second-brain", "family", "tech", "faq", "closing"];

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("Company landing page", () => {
  it("keeps the page underneath the intro and the hero avatar idle after it", () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    window.sessionStorage.clear();
    const { container } = render(<LandingPage />);
    expect(screen.getByTestId("company-intro")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    const avatar = container.querySelector("#hero-title .m-avatar")!;
    expect(avatar).toHaveAttribute("src", "/avatar/company-idle.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId("company-intro")).not.toBeInTheDocument();
    expect(container.querySelector("#hero-title .m-avatar")).toBe(avatar);
  });

  it("renders every section once, in the planned order", () => {
    const { container } = render(<LandingPage />);
    const ids = Array.from(container.querySelectorAll("main > section[id]")).map((s) => s.id);
    expect(ids).toEqual(SECTION_ORDER);
  });

  it("keeps the header to the logo, page links and demo CTA only", () => {
    render(<LandingPage />);
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav.querySelectorAll('a[href^="#"]')).toHaveLength(0);
    expect(within(nav).getByRole("link", { name: /Try demo/ })).toHaveAttribute("href", "/demo");
  });

  it("points its demo buttons at the demo page and embeds no media", () => {
    const { container } = render(<LandingPage />);
    const demoLinks = Array.from(container.querySelectorAll('a[href*="demo"]'));
    expect(demoLinks.length).toBeGreaterThanOrEqual(2);
    for (const a of demoLinks) expect(a.getAttribute("href")).toBe("/demo");
    expect(container.querySelectorAll("audio,video,iframe")).toHaveLength(0);
  });

  it("names every section with a heading", () => {
    const { container } = render(<LandingPage />);
    for (const section of container.querySelectorAll("main > section")) {
      const labelId = section.getAttribute("aria-labelledby");
      expect(labelId).toBeTruthy();
      expect(container.querySelector(`#${labelId}`)).not.toBeNull();
    }
  });
});
