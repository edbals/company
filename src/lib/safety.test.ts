import { describe, expect, it } from "vitest";
import { MEMORY_EXCLUDE, UNSAFE_PATTERN } from "./safety";

describe("UNSAFE_PATTERN", () => {
  it.each(["Take your pills at noon", "A dose of 20 mg", "Buy a gift card", "Check your blood pressure"])("flags %s", (t) => {
    expect(UNSAFE_PATTERN.test(t)).toBe(true);
  });
  it("allows ordinary phrases", () => {
    expect(UNSAFE_PATTERN.test("Pick up some milk")).toBe(false);
  });
});

describe("MEMORY_EXCLUDE", () => {
  it.each(["I slept badly", "Had toast for breakfast", "feeling tired"])("excludes %s", (t) => {
    expect(MEMORY_EXCLUDE.test(t)).toBe(true);
  });
  it("keeps outing memories", () => {
    expect(MEMORY_EXCLUDE.test("Enjoyed the garden market")).toBe(false);
  });
});
