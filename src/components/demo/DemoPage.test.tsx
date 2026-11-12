import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "../marketing/test-utils";
import {
  PERSONAL_PLAN,
  SAMPLE_PLAN,
  blockedResult,
  chatResult,
  optionsResult,
  planResult,
  reminderResult,
} from "./demo-fixtures";

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

beforeEach(() => {
  stubReducedMotion(true);
  window.sessionStorage.clear();
  planDemo.mockReset();
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
    name: /One question|Your plan|A little reminder|safe|Tell Company|Pick one/,
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

  it("offers options, then choose, yes, undo and the helper's side", async () => {
    planDemo.mockResolvedValue(optionsResult);
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("something fun");
    expect(screen.getByRole("heading", { name: "Pick one" })).toBeTruthy();
    expect(screen.getByText("Two ideas for you.")).toBeTruthy();
    expect(screen.getAllByText("Sample event")).toHaveLength(2);
    click("Choose this: Garden concert");
    expect(planDemo).toHaveBeenCalledTimes(1);
    click("Yes, ask Maya");
    expect(screen.getByRole("heading", { name: "Garden concert" })).toBeTruthy();
    expect(screen.getByText("Rose Park (sample event)")).toBeTruthy();
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

  it("goes back to the box from options with None of these", async () => {
    planDemo.mockResolvedValue(optionsResult);
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("something fun");
    click("None of these");
    expect(screen.getByRole("heading", { name: "Tell Company" })).toBeTruthy();
  });

  it("labels a personal plan as Your plan with no sample note and shows the notice", async () => {
    planDemo.mockResolvedValue(planResult(PERSONAL_PLAN));
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("walk with Walt");
    expect(screen.getByText("Your plan", { selector: ".m-chip, .m-chip *" })).toBeTruthy();
    expect(screen.queryByText(/sample event/i)).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("Taxi booking is not connected.");
    expect(screen.getByText("Cost: Free")).toBeTruthy();
  });

  it("shows the resting-AI note for quick plans", async () => {
    planDemo.mockResolvedValue(planResult(PERSONAL_PLAN, "ready"));
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("walk");
    expect(screen.getByText(/Quick plan \(AI resting\)/)).toBeTruthy();
  });

  it("lets the person say no to the plan", async () => {
    planDemo.mockResolvedValue(planResult({ ...SAMPLE_PLAN, ride: "own_way" }));
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("jazz");
    click("No, try something else");
    expect(screen.getByRole("heading", { name: "Tell Company" })).toBeTruthy();
  });

  it("reminds, and can also ask the helper", async () => {
    planDemo.mockResolvedValue(reminderResult);
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("I'm out of milk");
    expect(screen.getByRole("button", { name: "No, thanks" })).toBeTruthy();
    click("Also ask Maya");
    expect(screen.getByRole("group", { name: "Maya’s phone" })).toBeTruthy();
    expect(screen.getByText("Hi Maya, Dad is out of milk.")).toBeTruthy();
    click("Accept");
    click("Next");
    expect(screen.getByRole("heading", { name: "That’s Company." })).toBeTruthy();
  });

  it("stops medicine requests with rules and offers an alternative", async () => {
    planDemo.mockResolvedValue(blockedResult);
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    await ask("Order my blood pressure pills");
    expect(screen.getByText("Rules, not AI", { selector: ".m-chip span, .m-chip" })).toBeTruthy();
    click("No, thanks");
    expect(screen.getByRole("heading", { name: "That’s Company." })).toBeTruthy();
  });

  it("shows the last exchange after a chat reply and sends history on the next request", async () => {
    planDemo.mockResolvedValueOnce(chatResult).mockResolvedValueOnce(planResult(SAMPLE_PLAN));
    render(<DemoPage />);
    click("Skip, I’ll be Joe");
    type(/what would you like to do this week/i, "hello");
    click("Plan it");
    expect(await screen.findByText(chatResult.reply)).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
    type("Your answer", "live jazz");
    click("Plan it");
    await screen.findByRole("heading", { name: "One question" });
    expect(planDemo).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        words: "live jazz",
        history: [
          { who: "person", text: "hello" },
          { who: "company", text: chatResult.reply },
        ],
      }),
    });
  });

  it("shows a friendly error and retries", async () => {
    planDemo
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(planResult(SAMPLE_PLAN));
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
