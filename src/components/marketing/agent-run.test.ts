import { describe, expect, it } from "vitest";
import {
  EDGES,
  SCENARIOS,
  buildRun,
  coordinatorDraft,
  edgeStates,
  nodeStates,
  type ScenarioId,
} from "./agent-run";

const run = (id: ScenarioId) => buildRun(id);
const stepIds = (id: ScenarioId) => run(id).steps.map((step) => step.id);

describe("coordinatorDraft", () => {
  it("keeps options the specialists returned", () => {
    const options = { eventId: "evt_jazz_thu", ride: "family", family: "ride" } as const;
    expect(coordinatorDraft(options, options)).toEqual(options);
  });
  it("discards anything the specialists did not suggest", () => {
    const options = { eventId: null, ride: "undecided", family: "none" } as const;
    const invented = { eventId: "evt_made_up", ride: "family", family: "invite" } as const;
    expect(coordinatorDraft(options, invented)).toEqual(options);
  });
});

describe("jazz outing run", () => {
  it("runs the agents in the real order and ends with memory", () => {
    expect(stepIds("jazz")).toEqual([
      "checkin",
      "specialists",
      "coordinator",
      "checks",
      "decision",
      "lock",
      "memory",
    ]);
  });
  it("runs the three specialists together as AI calls", () => {
    const specialists = run("jazz").steps[1]!;
    expect(specialists.kind).toBe("ai");
    expect([...specialists.actors].sort()).toEqual(["family", "outings", "rides"]);
  });
  it("waits for a human decision, then offers an undo", () => {
    const jazz = run("jazz");
    expect(jazz.decisionStep).toBe(4);
    expect(jazz.undoStep).toBe(5);
    expect(jazz.steps[4]!.kind).toBe("human");
    expect(jazz.skipped).toEqual([]);
  });
  it("shows the real JSON shapes in the technical trace", () => {
    const jazz = run("jazz");
    expect(JSON.parse(jazz.steps[2]!.technical)).toEqual({
      eventId: "evt_jazz_thu",
      ride: "family",
      family: "ride",
    });
    expect(jazz.steps[3]!.technical).toContain("findClash");
  });
});

describe("milk errand run", () => {
  it("skips the specialists and the coordinator: no outing or ride was mentioned", () => {
    const milk = run("milk");
    expect(stepIds("milk")).toEqual(["checkin", "routing", "checks", "decision", "lock", "memory"]);
    expect([...milk.skipped].sort()).toEqual(["coordinator", "family", "outings", "rides"]);
    expect(milk.decisionStep).toBe(3);
  });
  it("remembers nothing from a one-off errand", () => {
    const memory = run("milk").steps.at(-1)!;
    expect(JSON.parse(memory.technical)).toEqual({ proposals: [] });
  });
});

describe("medicine request run", () => {
  it("is stopped by the safety filter with no decision to make", () => {
    const pills = run("pills");
    expect(stepIds("pills")).toEqual(["checkin", "blocked", "told"]);
    expect(pills.steps[1]!.outcome).toBe("blocked");
    expect(pills.steps[1]!.actors).toEqual(["safety"]);
    expect(pills.steps[1]!.kind).toBe("rule");
    expect(pills.decisionStep).toBeNull();
    expect(pills.undoStep).toBeNull();
    expect(pills.skipped).toContain("coordinator");
    expect(pills.steps[2]!.plain).toContain("speak to your pharmacy");
  });
});

describe("node and edge states", () => {
  it("is idle before the run starts", () => {
    const states = nodeStates(run("jazz"), -1);
    expect(new Set(Object.values(states))).toEqual(new Set(["idle"]));
  });
  it("lights the three specialists together and marks check-in done", () => {
    const states = nodeStates(run("jazz"), 1);
    expect(states.checkin).toBe("done");
    expect(states.outings).toBe("active");
    expect(states.rides).toBe("active");
    expect(states.family).toBe("active");
    expect(states.coordinator).toBe("idle");
  });
  it("marks skipped agents once the run has started", () => {
    expect(nodeStates(run("milk"), -1).outings).toBe("idle");
    expect(nodeStates(run("milk"), 0).outings).toBe("skipped");
  });
  it("keeps the safety filter blocked after it stops a request", () => {
    const pills = run("pills");
    expect(nodeStates(pills, 1).safety).toBe("blocked");
    expect(nodeStates(pills, 2).safety).toBe("blocked");
    expect(nodeStates(pills, 2).you).toBe("active");
  });
  it("derives edges from the nodes at each end", () => {
    const jazz = run("jazz");
    const at1 = edgeStates(nodeStates(jazz, 1));
    expect(at1["checkin>outings"]).toBe("active");
    expect(at1["outings>coordinator"]).toBe("idle");
    const at2 = edgeStates(nodeStates(jazz, 2));
    expect(at2["checkin>outings"]).toBe("done");
    expect(at2["outings>coordinator"]).toBe("active");
    const milk = edgeStates(nodeStates(run("milk"), 2));
    expect(milk["checkin>outings"]).toBe("skipped");
    expect(Object.keys(at1)).toHaveLength(EDGES.length);
  });
});

describe("scenarios", () => {
  it("offers three requests, each with a first line the person says", () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual(["jazz", "milk", "pills"]);
    for (const scenario of SCENARIOS) expect(scenario.said.length).toBeGreaterThan(8);
  });
});
