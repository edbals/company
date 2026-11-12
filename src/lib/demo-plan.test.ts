import { describe, expect, it } from "vitest";
import {
  DemoInput,
  DemoResult,
  blockedResult,
  fallbackPlan,
  onRequestedDay,
  planReply,
  replyFor,
  requestedDayOffset,
  requestedTime,
  sampleEvents,
} from "./demo-plan";
import type { DemoTurn } from "./demo-plan";
import { placeFrom, titleFrom } from "./demo-words";

// NOW is Wednesday 11 Nov 2026, 10:00 in Vancouver.
const NOW = new Date("2026-11-11T18:00:00Z");
const JOE = {
  name: "Joe",
  helper: { name: "Maya", relation: "daughter" },
  likes: ["jazz", "coffee with friends"],
};
const input = (words: string, overrides: Partial<DemoInput> = {}): DemoInput => ({
  profile: JOE,
  words,
  timezone: "America/Vancouver",
  history: [],
  ...overrides,
});
const plan = (words: string, overrides: Partial<DemoInput> = {}) => {
  const result = fallbackPlan(input(words, overrides), NOW);
  expect(() => DemoResult.parse(result)).not.toThrow();
  return result;
};
/** The bubble text always matches what is on screen. */
const expectMatchingReply = (result: DemoResult) => {
  if (result.outcome.kind !== "chat") expect(result.reply).toBe(replyFor(result.outcome, JOE));
};

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

describe("DemoInput", () => {
  it("defaults history and caps it at six short turns", () => {
    expect(DemoInput.parse({ profile: JOE, words: "hi", timezone: "UTC" }).history).toEqual([]);
    const turn: DemoTurn = { who: "person", text: "hello" };
    expect(() =>
      DemoInput.parse({ profile: JOE, words: "hi", timezone: "UTC", history: Array(7).fill(turn) }),
    ).toThrow();
    expect(() =>
      DemoInput.parse({
        profile: JOE,
        words: "hi",
        timezone: "UTC",
        history: [{ who: "person", text: "x".repeat(401) }],
      }),
    ).toThrow();
  });
});

describe("fallbackPlan: sample events", () => {
  it("plans a matching sample outing and asks about the ride when it isn't clear", () => {
    const result = plan("I'd love some live jazz");
    expect(result.source).toBe("ready");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "sample",
      title: "Live jazz afternoon",
      ride: "undecided",
    });
    expect(result.outcome.kind === "plan" && result.outcome.helperRequest).toMatch(
      /^Joe asks: “Can you drive me on /,
    );
    expectMatchingReply(result);
  });

  it("uses the helper when the person asks for a lift", () => {
    expect(plan("Jazz on Thursday, could Maya drive me?").outcome).toMatchObject({
      kind: "plan",
      ride: "family",
    });
  });

  it("never offers a family request without a helper", () => {
    const result = plan("live jazz", { profile: { name: "Ann", helper: null, likes: [] } });
    expect(result.outcome).toMatchObject({ kind: "plan", helperRequest: null });
    expect(result.steps.find((step) => step.agent === "family")?.status).toBe("skipped");
  });
});

describe("fallbackPlan: personal plans", () => {
  it("makes bowling on Sunday the person's own plan, with no invented time", () => {
    const result = plan("I want to go bowling with my grandkids on Sunday");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      title: "Go bowling with grandkids",
      when: "Sunday, Nov 15, time not set",
      place: null,
      cost: "not checked",
      ride: "undecided",
      notice: null,
    });
    expect(result.outcome.kind === "plan" && result.outcome.helperRequest).toContain(
      "Sunday, Nov 15",
    );
    expect(result.reply).toBe(
      "Joe, I wrote down your own plan: Go bowling with grandkids. The time isn’t set yet.",
    );
    expect(result.steps.find((step) => step.agent === "outings")?.status).toBe("skipped");
    expectMatchingReply(result);
  });

  it("plans a hospital visit tomorrow without blocking it or remembering it", () => {
    const result = plan("Can you help me visit my sister Ruth in the hospital tomorrow?");
    expect(result.source).toBe("ready");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      title: "Visit sister Ruth in the hospital",
      place: "The hospital",
      when: "Thursday, Nov 12, time not set",
      memory: null,
    });
    expectMatchingReply(result);
  });

  it("keeps a stated time and works out the pick-up", () => {
    const result = plan("Lunch with Walt at Blue Cup on Friday at 12:30");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      when: "Friday, Nov 13, 12:30 pm",
      place: "Blue Cup",
    });
    expect(result.outcome.kind === "plan" && result.outcome.helperRequest).toContain(
      "Pick-up 12:00 pm",
    );
  });

  it("offers a lift from the helper or the person's own way instead of a taxi", () => {
    const result = plan("Book me a taxi to the airport");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      title: "Trip to the airport",
      place: "The airport",
      ride: "undecided",
      cost: "not checked",
    });
    const outcome = result.outcome.kind === "plan" ? result.outcome : null;
    expect(outcome?.notice).toMatch(
      /not connected.*Maya could drive you or you can go your own way/,
    );
    expect(outcome?.helperRequest).toMatch(/^Joe asks:/);
    expect(result.reply).not.toMatch(/booked/i);
    expectMatchingReply(result);
  });
});

describe("fallbackPlan: options, reminders, blocks and chat", () => {
  it("offers up to three sample options, guided by likes, for open-ended wishes", () => {
    const result = plan("I am bored");
    expect(result.outcome.kind).toBe("options");
    const options = result.outcome.kind === "options" ? result.outcome.options : [];
    expect(options).toHaveLength(3);
    expect(options.slice(0, 2).map((option) => option.title)).toEqual([
      "Live jazz afternoon",
      "Cards and coffee afternoon",
    ]);
    expect(options.every((option) => option.origin === "sample")).toBe(true);
    expect(result.reply).toBe(
      "Joe, here are 3 ideas from the sample events. Pick the one you like.",
    );
    expect(planReply(options[0]!, JOE)).toMatch(/^Joe, I found live jazz afternoon/);
  });

  it("turns reading glasses into a reminder, not a ride question or a talk", () => {
    const result = plan("I need new reading glasses");
    expect(result.outcome).toEqual({
      kind: "reminder",
      title: "Pick up new reading glasses",
      when: "On your next shopping trip",
      helperRequest: "Joe asks: “Could you help me get new reading glasses?”",
    });
    expect(result.reply).toBe("Got it, Joe. Want a reminder to pick up new reading glasses?");
  });

  it("blocks medicine and money requests with rules, not AI", () => {
    const pills = plan("Order my blood pressure pills");
    expect(pills.source).toBe("rules");
    expect(pills.outcome.kind).toBe("blocked");
    expect(pills.steps.find((step) => step.agent === "safety")?.status).toBe("blocked");
    expect(blockedResult("send a wire transfer to my grandson")?.outcome.kind).toBe("blocked");
    expect(blockedResult("coffee with Walt")).toBeNull();
    expect(blockedResult("visit Ruth in the hospital")).toBeNull();
  });

  it("asks one question for greetings and gibberish", () => {
    expect(plan("hello").outcome.kind).toBe("chat");
    expect(plan("qwzx plorp")).toMatchObject({
      outcome: { kind: "chat" },
      reply: expect.stringContaining("Joe"),
    });
  });
});

describe("fallbackPlan: follow-ups with history", () => {
  const visit: DemoTurn[] = [
    { who: "person", text: "Can you help me visit my sister Ruth in the hospital?" },
    { who: "company", text: "Of course, Joe. Which day, and should I ask Maya to drive you?" },
  ];

  it("continues the same request when the answer is only a day and time", () => {
    const result = plan("Saturday at 2", { history: visit });
    expect(result.outcome).toMatchObject({
      kind: "plan",
      title: "Visit sister Ruth in the hospital",
      when: "Saturday, Nov 14, 2:00 pm",
    });
  });

  it("reads 'yes please' as yes to a lift from the helper", () => {
    expect(plan("yes please", { history: visit }).outcome).toMatchObject({
      kind: "plan",
      title: "Visit sister Ruth in the hospital",
      ride: "family",
    });
  });

  it("ignores earlier turns about medicine", () => {
    const history: DemoTurn[] = [{ who: "person", text: "order my pills" }];
    expect(plan("yes please", { history }).outcome.kind).toBe("chat");
  });
});

describe("words", () => {
  it("reads titles, places and times without guessing", () => {
    expect(titleFrom("Saturday at 2")).toBeNull();
    expect(placeFrom("go bowling with my grandkids on Sunday")).toBeNull();
    expect(requestedTime("Saturday at 2")).toBe(14 * 60);
    expect(requestedTime("at 9:30 am")).toBe(9 * 60 + 30);
    expect(requestedTime("2 grandkids")).toBeNull();
    expect(requestedTime("at noon")).toBe(12 * 60);
  });
});

describe("requested days", () => {
  const tz = "America/Vancouver";

  it("reads weekdays, tomorrow and the weekend", () => {
    expect(requestedDayOffset("jazz on Thursday", NOW, tz)).toBe(1);
    expect(requestedDayOffset("jazz next Wednesday", NOW, tz)).toBe(7);
    expect(requestedDayOffset("a walk tomorrow", NOW, tz)).toBe(1);
    expect(requestedDayOffset("something this weekend", NOW, tz)).toBe(3);
    expect(requestedDayOffset("live jazz", NOW, tz)).toBeNull();
  });

  it("moves the planned event to the day the person asked for", () => {
    expect(plan("Live jazz with Walt on Thursday").outcome).toMatchObject({
      kind: "plan",
      when: "Thursday, Nov 12, 2:00 pm",
    });
  });

  it("keeps the sample date when no day is named", () => {
    const [jazz] = sampleEvents(NOW);
    expect(onRequestedDay(jazz!, "live jazz", NOW, tz)).toBe(jazz);
  });
});
