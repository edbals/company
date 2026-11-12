import { describe, expect, it } from "vitest";
import {
  DemoResult,
  blockedResult,
  fallbackPlan,
  onRequestedDay,
  requestedDayOffset,
  sampleEvents,
} from "./demo-plan";
import type { DemoInput } from "./demo-plan";

const NOW = new Date("2026-11-11T18:00:00Z");
const input = (words: string, overrides: Partial<DemoInput> = {}): DemoInput => ({
  profile: { name: "Joe", helper: { name: "Maya", relation: "daughter" }, likes: ["Gardening"] },
  words,
  timezone: "America/Vancouver",
  ...overrides,
});

describe("sampleEvents", () => {
  it("dates every sample event within the next two weeks", () => {
    const events = sampleEvents(NOW);
    expect(events.length).toBeGreaterThanOrEqual(8);
    for (const event of events) {
      const start = new Date(event.starts_at).getTime();
      expect(start).toBeGreaterThan(NOW.getTime());
      expect(start - NOW.getTime()).toBeLessThan(14 * 864e5);
      expect(new Date(event.ends_at).getTime()).toBeGreaterThan(start);
    }
  });
});

describe("fallbackPlan", () => {
  it("plans a matching outing and asks about the ride when it isn't clear", () => {
    const result = fallbackPlan(input("I'd love some live jazz"), NOW);
    expect(result.source).toBe("ready");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      title: "Live jazz afternoon",
      ride: "undecided",
    });
    expect(result.outcome.kind === "plan" && result.outcome.helperRequest).toMatch(
      /^Joe asks: “Can you drive me on /,
    );
    expect(() => DemoResult.parse(result)).not.toThrow();
  });

  it("uses the helper when the person asks for a lift", () => {
    const result = fallbackPlan(input("Jazz on Thursday, could Maya drive me?"), NOW);
    expect(result.outcome).toMatchObject({ kind: "plan", ride: "family" });
  });

  it("falls back to the person's likes for open-ended wishes", () => {
    const result = fallbackPlan(input("Something fun this week"), NOW);
    expect(result.outcome).toMatchObject({ kind: "plan", title: "Garden club meet-up" });
  });

  it("never offers a family request without a helper", () => {
    const result = fallbackPlan(
      input("live jazz", { profile: { name: "Ann", helper: null, likes: [] } }),
      NOW,
    );
    expect(result.outcome).toMatchObject({ kind: "plan", helperRequest: null });
    expect(result.steps.find((step) => step.agent === "family")?.status).toBe("skipped");
  });

  it("turns an errand into a reminder", () => {
    const result = fallbackPlan(input("I'm out of milk"), NOW);
    expect(result.outcome).toEqual({
      kind: "reminder",
      title: "Pick up milk",
      when: "On your next shopping trip",
    });
  });

  it("blocks medicine requests with rules, not AI", () => {
    const result = fallbackPlan(input("Order my blood pressure pills"), NOW);
    expect(result.source).toBe("rules");
    expect(result.outcome.kind).toBe("blocked");
    expect(result.steps.find((step) => step.agent === "safety")?.status).toBe("blocked");
  });

  it("blocks money requests", () => {
    expect(blockedResult("send a wire transfer to my grandson")?.outcome.kind).toBe("blocked");
    expect(blockedResult("coffee with Walt")).toBeNull();
  });

  it("asks one question for greetings and gibberish", () => {
    expect(fallbackPlan(input("hello"), NOW).outcome.kind).toBe("chat");
    expect(fallbackPlan(input("qwzx plorp"), NOW)).toMatchObject({
      outcome: { kind: "chat" },
      reply: expect.stringContaining("Joe"),
    });
  });
});

describe("requested days", () => {
  // NOW is Wednesday 11 Nov 2026, 10:00 in Vancouver.
  const tz = "America/Vancouver";

  it("reads weekdays, tomorrow and the weekend", () => {
    expect(requestedDayOffset("jazz on Thursday", NOW, tz)).toBe(1);
    expect(requestedDayOffset("jazz next Wednesday", NOW, tz)).toBe(7);
    expect(requestedDayOffset("a walk tomorrow", NOW, tz)).toBe(1);
    expect(requestedDayOffset("something this weekend", NOW, tz)).toBe(3);
    expect(requestedDayOffset("live jazz", NOW, tz)).toBeNull();
  });

  it("moves the planned event to the day the person asked for", () => {
    const result = fallbackPlan(input("Live jazz with Walt on Thursday"), NOW);
    expect(result.outcome).toMatchObject({ kind: "plan", when: "Thursday, Nov 12, 2:00 pm" });
  });

  it("keeps the sample date when no day is named", () => {
    const [jazz] = sampleEvents(NOW);
    expect(onRequestedDay(jazz!, "live jazz", NOW, tz)).toBe(jazz);
  });
});
