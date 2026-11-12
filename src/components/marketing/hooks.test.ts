import { describe, expect, it } from "vitest";
import { STEP_PLAYER_IDLE, createStepReducer } from "./hooks";

describe("step player reducer", () => {
  it("plays from the first step and stops on the last", () => {
    const reduce = createStepReducer(3);
    const first = reduce(STEP_PLAYER_IDLE, { type: "play" });
    expect(first).toEqual({ index: 0, playing: true });
    const second = reduce(first, { type: "tick" });
    expect(second).toEqual({ index: 1, playing: true });
    expect(reduce(second, { type: "tick" })).toEqual({ index: 2, playing: false });
  });

  it("pauses on a hold step and continues when played again", () => {
    const reduce = createStepReducer(4, [1]);
    const held = reduce(reduce(STEP_PLAYER_IDLE, { type: "play" }), { type: "tick" });
    expect(held).toEqual({ index: 1, playing: false });
    expect(reduce(held, { type: "tick" })).toBe(held);
    expect(reduce(held, { type: "play" })).toEqual({ index: 2, playing: true });
  });

  it("skips straight to the next hold, then to the end", () => {
    const reduce = createStepReducer(5, [2]);
    const held = reduce(STEP_PLAYER_IDLE, { type: "skip" });
    expect(held).toEqual({ index: 2, playing: false });
    expect(reduce(held, { type: "skip" })).toEqual({ index: 4, playing: false });
  });

  it("restarts from the top when played after finishing", () => {
    const reduce = createStepReducer(2);
    const done = reduce(STEP_PLAYER_IDLE, { type: "skip" });
    expect(done.index).toBe(1);
    expect(reduce(done, { type: "play" })).toEqual({ index: 0, playing: true });
  });

  it("clamps jumps and resets to idle", () => {
    const reduce = createStepReducer(3);
    expect(reduce(STEP_PLAYER_IDLE, { type: "jump", index: 99 })).toEqual({
      index: 2,
      playing: false,
    });
    expect(reduce({ index: 2, playing: false }, { type: "reset" })).toEqual(STEP_PLAYER_IDLE);
  });
});
