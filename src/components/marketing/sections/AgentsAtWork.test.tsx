import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRun } from "../agent-run";
import { stubReducedMotion } from "../test-utils";
import { AgentsAtWork, stopStates } from "./AgentsAtWork";

beforeEach(() => {
  stubReducedMotion(true);
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const start = () => fireEvent.click(screen.getByRole("button", { name: "Start Joe’s example" }));
const sayYes = () =>
  fireEvent.click(screen.getByRole("button", { name: "Joe says yes (example)" }));
const stop = (i: number) => screen.getByTestId(`stop-${i}`);
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
function details() {
  const element = screen.getByText("See how it works").closest("details")!;
  element.open = true;
  return within(element);
}

describe("stopStates", () => {
  it("shows four idle stages before starting", () => {
    expect(stopStates(buildRun("jazz"), -1)).toEqual(["idle", "idle", "idle", "idle"]);
  });
  it("groups the simultaneous helpers and coordinator in one stage", () => {
    const jazz = buildRun("jazz");
    expect(stopStates(jazz, 1)).toEqual(["done", "active", "idle", "idle"]);
    expect(stopStates(jazz, 2)).toEqual(["done", "active", "idle", "idle"]);
  });
  it("never marks unused helpers as having worked", () => {
    expect(stopStates(buildRun("milk"), 0)).toEqual(["active", "skipped", "idle", "idle"]);
    expect(stopStates(buildRun("pills"), 2)).toEqual(["done", "skipped", "blocked", "done"]);
  });
  it("shows the final states when the example finishes", () => {
    expect(stopStates(buildRun("jazz"), 6)).toEqual(["done", "done", "done", "done"]);
  });
});

describe("Agents at work", () => {
  it("shows Joe’s sentence and all six jobs in a four-step story before any click", () => {
    render(<AgentsAtWork />);
    const story = screen.getByRole("list", { name: "From Joe’s request to his decision" });
    expect(within(story).getAllByRole("listitem")).toHaveLength(4);
    expect(within(story).getByText(`“${buildRun("jazz").scenario.said}”`)).toBeTruthy();
    for (const [name, job] of [
      ["Check-in", "Listens to Joe"],
      ["Outings", "Finds the show"],
      ["Rides", "Finds a way there"],
      ["Family circle", "Prepares a family request"],
      ["Coordinator", "Puts the plan together"],
      ["Memory keeper", "Asks what to remember"],
    ]) {
      expect(within(story).getByText(name!)).toBeTruthy();
      expect(within(story).getByText(job!)).toBeTruthy();
    }
    expect(screen.getByText("These three work at the same time:")).toBeTruthy();
    expect(screen.getByText("Rules in code, not AI.")).toBeTruthy();
    expect(
      screen.getByText("Nothing booked or sent without Joe’s yes. Then 10 seconds to undo."),
    ).toBeTruthy();
    expect(screen.getByText("Example only. Nothing here is sent, booked or saved.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Joe’s example" })).toBeTruthy();
    expect(screen.getByText("See how it works").closest("details")).not.toHaveAttribute("open");
  });

  it("waits for a click instead of autoplaying", () => {
    stubReducedMotion(false);
    render(<AgentsAtWork />);
    advance(30_000);
    expect(stop(0)).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("button", { name: "Start Joe’s example" })).toBeTruthy();
  });

  it("shows the checked plan immediately with reduced motion, but never approves it", () => {
    render(<AgentsAtWork />);
    start();
    expect(screen.getByRole("heading", { name: "The plan is ready. Joe decides." })).toBeTruthy();
    const plan = screen.getByLabelText("Joe’s example plan");
    expect(within(plan).getByRole("heading", { name: "Jazz at the Lakeside Café" })).toBeTruthy();
    expect(within(plan).getByText("Ask Maya for a lift · $0")).toBeTruthy();
    expect(stop(3)).toHaveAttribute("aria-current", "step");
    expect(stop(2)).toHaveAttribute("data-state", "done");
    advance(60_000);
    expect(screen.getByRole("button", { name: "Joe says yes (example)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo Joe’s yes" })).toBeNull();
  });

  it("keeps keyboard focus on the action through start, yes and undo", () => {
    render(<AgentsAtWork />);
    const action = screen.getByRole("button", { name: "Start Joe’s example" });
    action.focus();
    start();
    expect(action).toHaveFocus();
    sayYes();
    expect(action).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Undo Joe’s yes" }));
    expect(action).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Joe’s yes was undone." })).toBeTruthy();
    advance(10_000);
    expect(screen.getByRole("button", { name: "Joe says yes (example)" })).toBeTruthy();
  });

  it.each([true, false])("offers the full ten-second undo with reduced motion = %s", (reduced) => {
    stubReducedMotion(reduced);
    render(<AgentsAtWork />);
    start();
    if (!reduced) fireEvent.click(screen.getByRole("button", { name: "Show the result" }));
    sayYes();
    expect(screen.getByRole("heading", { name: "Joe said yes. 10 seconds to undo." })).toBeTruthy();
    advance(9_999);
    expect(screen.getByRole("button", { name: "Undo Joe’s yes" })).toBeTruthy();
    advance(1);
    expect(
      screen.getByRole("heading", { name: "Example complete. Joe stays in control." }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replay example" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo Joe’s yes" })).toBeNull();
    expect(screen.getByText(/Memory keeper would ask:/)).toBeTruthy();
    expect(stop(3)).toHaveAttribute("data-state", "done");
    fireEvent.click(screen.getByRole("button", { name: "Replay example" }));
    expect(stop(reduced ? 3 : 0)).toHaveAttribute("data-state", "active");
  });

  it("plays the helper stage together and stops at Joe’s decision", () => {
    stubReducedMotion(false);
    render(<AgentsAtWork />);
    start();
    expect(stop(0)).toHaveAttribute("aria-current", "step");
    advance(1500);
    expect(screen.getByRole("heading", { name: "Three helpers work at once." })).toBeTruthy();
    expect(stop(1)).toHaveAttribute("aria-current", "step");
    advance(1500);
    advance(1500);
    expect(stop(2)).toHaveAttribute("aria-current", "step");
    advance(1500);
    advance(30_000);
    expect(screen.getByRole("button", { name: "Joe says yes (example)" })).toBeTruthy();
  });

  it("stops a medicine request without offering approval", () => {
    render(<AgentsAtWork />);
    fireEvent.click(details().getByRole("button", { name: "A medicine request" }));
    start();
    expect(screen.getByRole("heading", { name: "Stopped. Nothing ordered or sent." })).toBeTruthy();
    expect(stop(2)).toHaveAttribute("data-state", "blocked");
    expect(stop(1)).toHaveAttribute("data-state", "skipped");
    expect(screen.queryByRole("button", { name: "Joe says yes (example)" })).toBeNull();
  });

  it("keeps alternate requests and code behind Details", () => {
    render(<AgentsAtWork />);
    start();
    const detail = details();
    const trace = detail.getByRole("list", { name: "Steps so far" });
    expect(trace.textContent).not.toContain('"ride": "family"');
    fireEvent.click(detail.getByRole("button", { name: "In code" }));
    expect(trace.textContent).toContain('"ride": "family"');
    expect(detail.getByRole("group", { name: "Choose a request" })).toBeTruthy();
  });

  it("cancels the old undo timer when another request is chosen", () => {
    render(<AgentsAtWork />);
    start();
    sayYes();
    fireEvent.click(details().getByRole("button", { name: "Out of milk" }));
    advance(10_000);
    expect(screen.getByRole("button", { name: "Start Joe’s example" })).toBeTruthy();
    expect(screen.getByText("“I’m out of milk.”")).toBeTruthy();
    start();
    expect(stop(1)).toHaveAttribute("data-state", "skipped");
    sayYes();
    advance(10_000);
    expect(
      screen.getByText("Memory keeper has nothing to remember from this errand."),
    ).toBeTruthy();
  });
});
