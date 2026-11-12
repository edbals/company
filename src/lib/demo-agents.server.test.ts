import { beforeEach, describe, expect, it, vi } from "vitest";
import { askModel } from "./ai-model.server";
import { runDemoPlan } from "./demo-agents.server";
import { DemoResult, fallbackPlan, replyFor } from "./demo-plan";
import type { DemoInput, DemoTurn } from "./demo-plan";

vi.mock("./ai-model.server", () => ({ askModel: vi.fn() }));
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) },
}));
const model = vi.mocked(askModel);

const NOW = new Date("2026-11-11T18:00:00Z");
const JOE = {
  name: "Joe",
  helper: { name: "Maya", relation: "daughter" },
  likes: ["jazz", "coffee with friends"],
};
const input = (words: string, history: DemoTurn[] = []): DemoInput => ({
  profile: JOE,
  words,
  timezone: "America/Vancouver",
  history,
});

type Agent = "Check-in" | "Outings" | "Rides" | "Family circle" | "Memory keeper" | "Coordinator";
type Answers = Partial<Record<Agent, unknown>>;
const agentOf = (instructions: string) =>
  (/^You are ([\w -]+?)[.,]/.exec(instructions)?.[1] ?? "") as Agent;
/** Answers each agent by name; an Error answer makes that call fail. */
function answer(answers: Answers) {
  model.mockImplementation(async (instructions: string) => {
    const value = answers[agentOf(instructions)];
    if (value instanceof Error || value === undefined) throw value ?? new Error("no answer");
    return value;
  });
}
const calledAgents = () => model.mock.calls.map(([instructions]) => agentOf(instructions));
const plan = (words: string, history: DemoTurn[] = []) =>
  runDemoPlan(input(words, history), "203.0.113.9", NOW).then((result) => {
    expect(() => DemoResult.parse(result)).not.toThrow();
    return result;
  });
const expectReplyMatchesOutcome = (result: DemoResult) => {
  if (result.outcome.kind !== "chat") expect(result.reply).toBe(replyFor(result.outcome, JOE));
};

beforeEach(() => {
  model.mockReset();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const bowlingCheckin = {
  kind: "plan",
  reply: "Sounds like fun, have a great game!",
  eventIds: [],
  title: "Go bowling with grandkids",
  place: null,
  needs: [],
  wantsBooking: false,
};
const echoCoordinator = {
  eventId: null,
  ride: "undecided",
  family: "ride",
  memory: "Joe enjoys bowling with his grandkids.",
};

describe("runDemoPlan with real agents", () => {
  it("turns any wish into a personal plan whose reply matches the card", async () => {
    answer({
      "Check-in": bowlingCheckin,
      Rides: { ride: "undecided" },
      "Family circle": { family: "ride" },
      "Memory keeper": { fact: "Joe enjoys bowling with his grandkids." },
      Coordinator: echoCoordinator,
    });
    const result = await plan("I want to go bowling with my grandkids on Sunday");
    expect(result.source).toBe("ai");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      title: "Go bowling with grandkids",
      when: "Sunday, Nov 15, time not set",
      cost: "not checked",
      memory: "Joe enjoys bowling with his grandkids.",
    });
    expect(result.reply).not.toContain("great game");
    expectReplyMatchesOutcome(result);
  });

  it("runs Memory keeper alongside the specialists, within three round-trips", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const answers: Answers = {
      "Check-in": bowlingCheckin,
      Rides: { ride: "undecided" },
      "Family circle": { family: "ride" },
      "Memory keeper": { fact: null },
      Coordinator: { ...echoCoordinator, memory: null },
    };
    model.mockImplementation(async (instructions: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return answers[agentOf(instructions)];
    });
    const result = await plan("I want to go bowling with my grandkids on Sunday");
    const agents = calledAgents();
    expect(agents[0]).toBe("Check-in");
    expect(agents.at(-1)).toBe("Coordinator");
    expect(agents).toContain("Memory keeper");
    expect(agents).not.toContain("Outings");
    expect(maxInFlight).toBe(3);
    expect(result.steps.find((step) => step.agent === "memory")).toMatchObject({ status: "done" });
    expect(result.steps.find((step) => step.agent === "outings")).toMatchObject({
      status: "skipped",
    });
  });

  it("never mixes an errand reply with another outcome", async () => {
    answer({
      "Check-in": {
        kind: "errand",
        reply: "I noted down reading glasses",
        needs: ["new reading glasses"],
      },
      "Family circle": { family: "ride" },
    });
    const result = await plan("I need new reading glasses");
    expect(result.outcome).toMatchObject({
      kind: "reminder",
      title: "Pick up new reading glasses",
    });
    expect(result.outcome.kind === "reminder" && result.outcome.helperRequest).toMatch(
      /^Joe asks:/,
    );
    expect(result.reply).toBe("Got it, Joe. Want a reminder to pick up new reading glasses?");
    expect(calledAgents()).toEqual(["Check-in", "Family circle"]);
  });

  it("keeps Coordinator from adding anything the specialists didn't suggest", async () => {
    answer({
      "Check-in": { ...bowlingCheckin, eventIds: ["jazz"] },
      Outings: { eventId: null },
      Rides: { ride: "own_way" },
      "Family circle": { family: "none" },
      "Memory keeper": { fact: null },
      Coordinator: { eventId: "jazz", ride: "family", family: "ride", memory: "Joe enjoys jazz." },
    });
    const result = await plan("I want to go bowling with my grandkids on Sunday");
    expect(result.outcome).toMatchObject({
      kind: "plan",
      origin: "personal",
      ride: "undecided",
      helperRequest: null,
      memory: null,
    });
    expect(result.steps.find((step) => step.agent === "coordinator")?.line).toMatch(
      /added nothing/,
    );
  });

  it("returns ready-made options for open-ended wishes", async () => {
    answer({
      "Check-in": { kind: "options", reply: "How about jazz?", eventIds: ["jazz"] },
      Outings: { eventIds: ["jazz", "cards", "made-up"] },
    });
    const result = await plan("I am bored");
    const options = result.outcome.kind === "options" ? result.outcome.options : [];
    expect(options.map((option) => option.title)).toEqual([
      "Live jazz afternoon",
      "Cards and coffee afternoon",
    ]);
    expect(options.every((option) => option.kind === "plan" && option.origin === "sample")).toBe(
      true,
    );
    expectReplyMatchesOutcome(result);
  });

  it("offers family or own way when asked to book a taxi", async () => {
    answer({
      "Check-in": {
        ...bowlingCheckin,
        title: "Trip to the airport",
        place: "The airport",
        wantsBooking: true,
      },
      Rides: { ride: "undecided" },
      "Family circle": { family: "ride" },
      "Memory keeper": { fact: null },
      Coordinator: { ...echoCoordinator, memory: null },
    });
    const result = await plan("Book me a taxi to the airport");
    const outcome = result.outcome.kind === "plan" ? result.outcome : null;
    expect(outcome?.notice).toMatch(/not connected/);
    expect(outcome?.helperRequest).toMatch(/^Joe asks:/);
    expectReplyMatchesOutcome(result);
  });

  it("passes the recent conversation to Check-in and uses only safe chat replies", async () => {
    const history: DemoTurn[] = [
      { who: "person", text: "Can you help me visit my sister Ruth in the hospital?" },
      { who: "company", text: "Of course, Joe. Which day works?" },
    ];
    answer({ "Check-in": { kind: "chat", reply: "Lovely, Joe. What time on Saturday?" } });
    const result = await plan("Saturday", history);
    expect(result).toMatchObject({
      source: "ai",
      outcome: { kind: "chat" },
      reply: "Lovely, Joe. What time on Saturday?",
    });
    expect(model.mock.calls[0]?.[1]).toMatchObject({ history, words: "Saturday" });
  });
});

describe("runDemoPlan falls back to rules", () => {
  it("uses the complete ready result when Check-in fails", async () => {
    answer({ "Check-in": new Error("timeout") });
    const words = "I want to go bowling with my grandkids on Sunday";
    const result = await plan(words);
    expect(result).toEqual(fallbackPlan(input(words), NOW));
    expect(result.source).toBe("ready");
  });

  it("uses the ready result when a specialist fails or output is invalid", async () => {
    answer({
      "Check-in": bowlingCheckin,
      Rides: new Error("timeout"),
      "Family circle": { family: "ride" },
      "Memory keeper": { fact: null },
    });
    expect((await plan("I want to go bowling on Sunday")).source).toBe("ready");
    answer({ "Check-in": { kind: "sing a song" } });
    expect((await plan("hello")).source).toBe("ready");
  });

  it("rejects chat replies that claim a booking", async () => {
    answer({ "Check-in": { kind: "chat", reply: "Done, Joe, I booked your taxi." } });
    expect((await plan("Book me a taxi to the airport")).source).toBe("ready");
  });

  it("skips the model when the quota is used up", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await plan("live jazz");
    expect(result.source).toBe("ready");
    expect(model).not.toHaveBeenCalled();
  });

  it("blocks medicine before any quota or model call, but not hospital visits", async () => {
    const result = await plan("Order my blood pressure pills");
    expect(result).toMatchObject({ source: "rules", outcome: { kind: "blocked" } });
    expect(rpc).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
    answer({ "Check-in": new Error("offline") });
    expect((await plan("Visit Ruth in the hospital tomorrow")).outcome.kind).toBe("plan");
  });
});
