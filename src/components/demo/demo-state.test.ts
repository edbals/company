import { describe, expect, it } from "vitest";
import { JOE, STAGES, UNDO_SECONDS, demoReducer, initialState, stageOf } from "./demo-state";
import type { DemoAction, DemoState } from "./demo-state";
import {
  PERSONAL_PLAN,
  SAMPLE_PLAN,
  blockedResult,
  chatResult,
  optionsResult,
  planResult,
  reminderResult,
} from "./demo-fixtures";

const run = (state: DemoState, ...actions: DemoAction[]) => actions.reduce(demoReducer, state);
const asked = (words: string) => run(initialState(JOE), { type: "submit", words });
const settle = (state: DemoState) => {
  let next = state;
  for (let i = 0; i < UNDO_SECONDS; i += 1) next = demoReducer(next, { type: "tick" });
  return next;
};

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
    let state = run(asked("jazz"), { type: "resolved", result: planResult(SAMPLE_PLAN) });
    expect(state).toMatchObject({ screen: "question", plan: SAMPLE_PLAN });
    state = run(state, { type: "ride", ride: "family" }, { type: "confirm" });
    expect(state).toMatchObject({ screen: "undo", seconds: UNDO_SECONDS });
    expect(run(state, { type: "undo" }).screen).toBe("plan");
    state = run(settle(state), { type: "next" });
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
    const state = run(
      asked("jazz"),
      { type: "resolved", result: planResult(SAMPLE_PLAN) },
      { type: "ride", ride: "own_way" },
      { type: "confirm" },
    );
    expect(run(settle(state), { type: "next" }).screen).toBe("memory");
  });

  it("goes straight to the plan when there is nobody to ask", () => {
    const state = run(asked("walk"), { type: "resolved", result: planResult(PERSONAL_PLAN) });
    expect(state).toMatchObject({ screen: "plan", ride: "own_way" });
    expect(run(settle(run(state, { type: "confirm" })), { type: "next" }).screen).toBe("finish");
  });

  it("opens options in the Decide stage and chooses one without a new call", () => {
    const options = run(asked("something fun"), { type: "resolved", result: optionsResult });
    expect(options).toMatchObject({ screen: "options", plan: null });
    expect(stageOf("options")).toBe(3);
    expect(run(options, { type: "choose", index: 5 })).toBe(options);
    const chosen = run(options, { type: "choose", index: 1 });
    expect(chosen).toMatchObject({ screen: "question", plan: { title: "Garden concert" } });
    expect(options.plan).toBeNull();
    expect(run(options, { type: "again" }).screen).toBe("ask");
  });

  it("lets the person decline reminders and blocked alternatives", () => {
    const milk = run(asked("milk"), { type: "resolved", result: reminderResult });
    expect(milk.screen).toBe("reminder");
    expect(run(milk, { type: "reminder", yes: false })).toMatchObject({
      screen: "finish",
      reminder: false,
    });
    expect(run(asked("pills"), { type: "resolved", result: blockedResult }).screen).toBe("blocked");
  });

  it("can also ask the helper from a reminder", () => {
    const milk = run(asked("milk"), { type: "resolved", result: reminderResult });
    const family = run(milk, { type: "askHelper" });
    expect(family.screen).toBe("family");
    const done = run(family, { type: "accept" }, { type: "next" });
    expect(done).toMatchObject({ screen: "finish", reminder: true });
    const noHelper = run(initialState({ ...JOE, helper: null }), { type: "submit", words: "milk" });
    const solo = run(noHelper, { type: "resolved", result: reminderResult }, { type: "askHelper" });
    expect(solo.screen).toBe("reminder");
  });

  it("keeps the box open after a chat reply and remembers the exchange", () => {
    const state = run(asked("hello"), { type: "resolved", result: chatResult });
    expect(state.screen).toBe("ask");
    expect(state.history).toEqual([
      { who: "person", text: "hello" },
      { who: "company", text: chatResult.reply },
    ]);
    const next = run(state, { type: "submit", words: "jazz" });
    expect(next).toMatchObject({ screen: "working", words: "jazz" });
    expect(next.history).toHaveLength(2);
  });

  it("keeps only the last six turns and clears them on start over", () => {
    let state = initialState(JOE);
    for (let i = 0; i < 4; i += 1)
      state = run(
        state,
        { type: "submit", words: `ask ${i}` },
        { type: "resolved", result: chatResult },
      );
    expect(state.history).toHaveLength(6);
    expect(state.history[0]).toEqual({ who: "person", text: "ask 1" });
    expect(state.history.at(-2)).toEqual({ who: "person", text: "ask 3" });
    expect(run(state, { type: "again" }).history).toEqual([]);
    expect(run(state, { type: "reset" }).history).toEqual([]);
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
