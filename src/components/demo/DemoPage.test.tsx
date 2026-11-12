import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackPlan } from "@/lib/demo-plan";
import type { DemoInput } from "@/lib/demo-plan";
import { stubReducedMotion } from "../marketing/test-utils";

interface MockLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  search?: unknown;
  children: ReactNode;
}
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search: _search, children, ...props }: MockLinkProps) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
const planDemo = vi.fn();
vi.mock("@/lib/demo.functions", () => ({ planDemo: (args: unknown) => planDemo(args) }));
import { DemoPage } from "./DemoPage";
import { SiteHeader } from "../marketing/SiteHeader";

const NOW = new Date("2026-11-11T18:00:00Z");
const answerWithFallback = ({ data }: { data: DemoInput }) =>
  Promise.resolve(fallbackPlan(data, NOW));

beforeEach(() => {
  stubReducedMotion(true);
  window.sessionStorage.clear();
  planDemo.mockReset();
  planDemo.mockImplementation(answerWithFallback);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function ask(words: string) {
  type(/what would you like to do this week/i, words);
  click("Plan it");
  await screen.findByRole("heading", {
    name: /One question|Your plan|A little reminder|safe|Tell Company/,
  });
}

describe("DemoPage", () => {
  it("onboards in three short questions and greets by name", () => {
    render(<DemoPage />);
    expect(screen.getByText(/Nothing is booked, sent or saved/)).toBeTruthy();
    type("Hello! What should I call you?", "Ann");
    click("Next");
    expect(screen.getByLabelText("Their name")).toHaveFocus();
    click("No one for now");
    click("Walks");
    expect(screen.getByRole("button", { name: "Walks" })).toHaveAttribute("aria-pressed", "true");
    click("Done");
    expect(screen.getByLabelText("Ann, what would you like to do this week?")).toBeTruthy();
  });

  it("does not move focus on first load", () => {
    render(<DemoPage />);
    expect(screen.getByRole("heading", { name: "Nice to meet you" })).not.toHaveFocus();
  });

  it("plans anything typed, then yes, undo and the helper's side", async () => {
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("I'd love live jazz");
    expect(planDemo).toHaveBeenCalledWith({
      data: expect.objectContaining({
        words: "I'd love live jazz",
        profile: expect.objectContaining({ name: "Joe" }),
      }),
    });
    expect(screen.getByText(/Quick plan \(AI resting\)/)).toBeTruthy();
    click("Yes, ask Maya");
    expect(screen.getByRole("heading", { name: "Live jazz afternoon" })).toBeTruthy();
    vi.useFakeTimers();
    click("Yes, go ahead");
    click("Undo");
    expect(screen.getByRole("heading", { name: "Your plan" })).toBeTruthy();
    click("Yes, go ahead");
    for (let second = 0; second < 10; second += 1) act(() => vi.advanceTimersByTime(1000));
    click("Next");
    expect(screen.getByRole("group", { name: "Maya’s phone" })).toBeTruthy();
    click("Accept");
    expect(screen.getByText(/Maya said yes/)).toBeTruthy();
    click("Next");
    click("Keep");
    expect(screen.getByText(/Kept: Joe enjoys live jazz afternoon/)).toBeTruthy();
  });

  it("lets the person say no to the plan", async () => {
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("jazz, I'll get there myself");
    click("No, try something else");
    expect(screen.getByRole("heading", { name: "Tell Company" })).toBeTruthy();
  });

  it("stops medicine requests with rules and offers an alternative", async () => {
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("Order my blood pressure pills");
    expect(screen.getByText("Rules, not AI", { selector: ".m-chip span, .m-chip" })).toBeTruthy();
    click("No, thanks");
    expect(screen.getByRole("heading", { name: "That’s Company." })).toBeTruthy();
  });

  it("keeps the box open with a question when it can't plan yet", async () => {
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    type(/what would you like to do this week/i, "hello");
    click("Plan it");
    expect(await screen.findByText("Hi Joe. What would you like to do this week?")).toBeTruthy();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });

  it("shows a friendly error and retries", async () => {
    planDemo.mockRejectedValueOnce(new Error("offline"));
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    type(/what would you like to do this week/i, "live jazz");
    click("Plan it");
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn’t reach the planner/);
    click("Try again");
    await waitFor(() => expect(screen.getByRole("heading", { name: "One question" })).toBeTruthy());
    expect(planDemo).toHaveBeenCalledTimes(2);
  });

  it("remembers the profile for this visit and starts over with it", async () => {
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    cleanup();
    render(<DemoPage />);
    await screen.findByLabelText("Joe, what would you like to do this week?");
    click("Start over");
    expect(screen.getByRole("heading", { name: "Tell Company" })).toBeTruthy();
  });

  it("marks no navbar link as current on the demo page", () => {
    render(<SiteHeader current="demo" />);
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });
});
