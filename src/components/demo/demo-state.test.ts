import { describe, expect, it } from "vitest";
import { fallbackPlan } from "@/lib/demo-plan";
import { JOE, STAGES, UNDO_SECONDS, demoReducer, initialState, stageOf } from "./demo-state";
import type { DemoAction, DemoState } from "./demo-state";

const NOW = new Date("2026-11-11T18:00:00Z");
const run = (state: DemoState, ...actions: DemoAction[]) => actions.reduce(demoReducer, state);
const resultFor = (words: string, profile = JOE) =>
  fallbackPlan({ profile, words, timezone: "America/Vancouver" }, NOW);
const asked = (words: string) => run(initialState(JOE), { type: "submit", words });

describe("demoReducer", () => {
  it("walks the short onboarding", () => {
    const state = run(
      initialState(),
      { type: "name", name: " Ann " },
      { type: "helper", helper: null },
      { type: "likes", likes: ["Walks"] },
    );
    expect(state.screen).toBe("ask");
    expect(state.profile).toEqual({ name: "Ann", helper: null, likes: ["Walks"] });
  });

  it("skips straight to Joe", () => {
    expect(run(initialState(), { type: "skip" })).toMatchObject({ screen: "ask", profile: JOE });
  });

  it("asks the ride question, then plan, undo window and family request", () => {
    let state = run(asked("live jazz"), { type: "resolved", result: resultFor("live jazz") });
    expect(state.screen).toBe("question");
    state = run(state, { type: "ride", ride: "family" }, { type: "confirm" });
    expect(state).toMatchObject({ screen: "undo", seconds: UNDO_SECONDS });
    expect(run(state, { type: "undo" }).screen).toBe("plan");
    for (let i = 0; i < UNDO_SECONDS; i += 1) state = demoReducer(state, { type: "tick" });
    state = run(state, { type: "next" });
    expect(state.screen).toBe("family");
    expect(run(state, { type: "next" }).screen).toBe("family");
    state = run(state, { type: "accept" }, { type: "next" });
    expect(state.screen).toBe("memory");
    expect(run(state, { type: "memory", choice: "skipped" })).toMatchObject({
      screen: "finish",
      memory: "skipped",
    });
  });

  it("skips the family step when the person gets there themselves", () => {
    let state = run(
      asked("live jazz"),
      { type: "resolved", result: resultFor("live jazz") },
      { type: "ride", ride: "own_way" },
      { type: "confirm" },
    );
    for (let i = 0; i < UNDO_SECONDS; i += 1) state = demoReducer(state, { type: "tick" });
    expect(run(state, { type: "next" }).screen).toBe("memory");
  });

  it("lets the person decline reminders and blocked alternatives", () => {
    const milk = run(asked("out of milk"), {
      type: "resolved",
      result: resultFor("I'm out of milk"),
    });
    expect(milk.screen).toBe("reminder");
    expect(run(milk, { type: "reminder", yes: false })).toMatchObject({
      screen: "finish",
      reminder: false,
    });
    const pills = run(asked("pills"), { type: "resolved", result: resultFor("order my pills") });
    expect(pills.screen).toBe("blocked");
  });

  it("keeps the box open after a chat reply", () => {
    expect(run(asked("hello"), { type: "resolved", result: resultFor("hello") }).screen).toBe(
      "ask",
    );
  });

  it("recovers from errors and starts over with the same profile", () => {
    const failed = run(asked("jazz"), { type: "failed", message: "Oops" });
    expect(failed).toMatchObject({ screen: "error", error: "Oops" });
    expect(run(failed, { type: "retry" }).screen).toBe("working");
    expect(run(failed, { type: "again" })).toMatchObject({
      screen: "ask",
      profile: JOE,
      words: "",
    });
    expect(run(failed, { type: "reset" }).screen).toBe("name");
  });

  it("keeps a fixed number of stages", () => {
    expect(stageOf("name")).toBe(0);
    expect(stageOf("finish")).toBe(STAGES.length - 1);
  });
});
