import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "../test-utils";
import { SecondBrain, brainReducer, INITIAL_BRAIN } from "./SecondBrain";

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const JAZZ = "You love live jazz";
const ROUTINE = "Afternoons work better than evenings";
const CHAT_LINE = "The jazz was wonderful. Afternoons suit me much better than evenings.";
const FORGOTTEN = "Forgotten everywhere: memory, activity log, conversation, setup interests";

const drawer = (name: string) => screen.getByRole("region", { name });
const reveal = () =>
  fireEvent.click(screen.getByRole("button", { name: "See what Company would remember" }));
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("SecondBrain component", () => {
  it("starts with seeded memory and the neutral next step", () => {
    const { container } = render(<SecondBrain />);
    expect(container.querySelector("section#second-brain")).toBeTruthy();
    expect(within(drawer("People")).getByText("Walt is a friend who likes jazz")).toBeTruthy();
    expect(within(drawer("Likes")).getByText("You enjoy gardening")).toBeTruthy();
    expect(within(drawer("Routines")).getByText("Nothing yet")).toBeTruthy();
    expect(within(drawer("Limits")).getByText("Rides up to $25")).toBeTruthy();
    expect(screen.getByText("Company asks what time works.")).toBeTruthy();
    expect(screen.getByText(CHAT_LINE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Forget:/ })).toBeNull();
    expect(screen.getByText("Family can’t see this.")).toBeTruthy();
    expect(container.textContent?.toLowerCase()).not.toContain("demo");
  });

  it("reveal shows both suggestions and Forget buttons", () => {
    render(<SecondBrain />);
    reveal();
    expect(screen.getByRole("button", { name: `Keep: ${JAZZ}` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Keep: ${ROUTINE}` })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Forget:/ }).length).toBe(3);
    expect(screen.queryByText(CHAT_LINE)).toBeNull();
  });

  it("keeps jazz into Likes and updates next time", () => {
    render(<SecondBrain />);
    reveal();
    click(`Keep: ${JAZZ}`);
    expect(within(drawer("Likes")).getByText(JAZZ)).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Company looks for live jazz first.")).toBeTruthy();
  });

  it("keeping both gives afternoon jazz and replaces the chat with the deleted line", () => {
    render(<SecondBrain />);
    reveal();
    click(`Keep: ${JAZZ}`);
    expect(screen.queryByText(/Conversation deleted/)).toBeNull();
    click(`Keep: ${ROUTINE}`);
    expect(screen.getByText("Company starts with afternoon jazz.")).toBeTruthy();
    expect(screen.getByText("Conversation deleted — only what Joe kept is saved.")).toBeTruthy();
    expect(screen.queryByText(CHAT_LINE)).toBeNull();
  });

  it("skipping leaves memory unchanged", () => {
    render(<SecondBrain />);
    reveal();
    click(`Skip: ${JAZZ}`);
    expect(within(drawer("Likes")).queryByText(JAZZ)).toBeNull();
    expect(screen.getByText("Skipped")).toBeTruthy();
    expect(screen.getByText("Company asks what time works.")).toBeTruthy();
  });

  it("forgetting removes the fact and shows the confirmation in its drawer", () => {
    render(<SecondBrain />);
    reveal();
    click(`Keep: ${ROUTINE}`);
    expect(screen.getByText("Company starts with afternoon options.")).toBeTruthy();
    click(`Forget: ${ROUTINE}`);
    const routines = drawer("Routines");
    expect(within(routines).getByText("Nothing yet")).toBeTruthy();
    expect(within(routines).getByText(FORGOTTEN)).toBeTruthy();
    expect(screen.getByText("Company asks what time works.")).toBeTruthy();
  });

  it("clears the confirmation after a few seconds", () => {
    vi.useFakeTimers();
    render(<SecondBrain />);
    reveal();
    click("Forget: Rides up to $25");
    expect(within(drawer("Limits")).getByText(FORGOTTEN)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(screen.queryByText(FORGOTTEN)).toBeNull();
  });

  it("start over restores the starting state", () => {
    render(<SecondBrain />);
    reveal();
    click(`Keep: ${JAZZ}`);
    click("Forget: Rides up to $25");
    click("Start over");
    expect(within(drawer("Limits")).getByText("Rides up to $25")).toBeTruthy();
    expect(within(drawer("Likes")).queryByText(JAZZ)).toBeNull();
    expect(screen.queryByText(FORGOTTEN)).toBeNull();
    expect(screen.getByRole("button", { name: "See what Company would remember" })).toBeTruthy();
  });
});

describe("brainReducer", () => {
  it("reveals proposals", () => {
    expect(brainReducer(INITIAL_BRAIN, { type: "reveal" }).revealed).toBe(true);
  });

  it("keeps a proposal as a fact without mutating the old state", () => {
    const next = brainReducer(INITIAL_BRAIN, { type: "keep", id: "jazz" });
    expect(next.decisions.jazz).toBe("kept");
    expect(next.facts.some((f) => f.id === "jazz" && f.kind === "like")).toBe(true);
    expect(INITIAL_BRAIN.facts.some((f) => f.id === "jazz")).toBe(false);
  });

  it("skips a proposal without adding a fact", () => {
    const next = brainReducer(INITIAL_BRAIN, { type: "skip", id: "routine" });
    expect(next.decisions.routine).toBe("skipped");
    expect(next.facts).toEqual(INITIAL_BRAIN.facts);
  });

  it("ignores a second decision on the same proposal", () => {
    const skipped = brainReducer(INITIAL_BRAIN, { type: "skip", id: "jazz" });
    expect(brainReducer(skipped, { type: "keep", id: "jazz" })).toBe(skipped);
  });

  it("forgets a fact and records it", () => {
    const kept = brainReducer(INITIAL_BRAIN, { type: "keep", id: "jazz" });
    const next = brainReducer(kept, { type: "forget", id: "jazz" });
    expect(next.facts.some((f) => f.id === "jazz")).toBe(false);
    expect(next.decisions.jazz).toBe("forgotten");
    expect(next.lastForgotten).toMatchObject({ text: "You love live jazz", kind: "like", index: 1 });
  });

  it("resets", () => {
    const next = brainReducer(brainReducer(INITIAL_BRAIN, { type: "reveal" }), { type: "reset" });
    expect(next).toEqual(INITIAL_BRAIN);
  });

  it("clears only the matching forgotten notice", () => {
    const kept = brainReducer(INITIAL_BRAIN, { type: "keep", id: "jazz" });
    const forgot = brainReducer(kept, { type: "forget", id: "jazz" });
    const seq = forgot.lastForgotten?.seq ?? -1;
    expect(brainReducer(forgot, { type: "clearForgotten", seq: seq + 1 })).toBe(forgot);
    expect(brainReducer(forgot, { type: "clearForgotten", seq }).lastForgotten).toBeNull();
  });
});
