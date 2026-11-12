// Pure model of one request moving through Company's agents and guardrails.
// It mirrors the real flow in src/lib/agents.functions.ts, src/lib/planning-agents.server.ts,
// src/lib/plan-logic.ts and the server-owned decisions in the database. Example data only.
import type { AgentId, GuardrailId } from "./content";

export type NodeId = AgentId | GuardrailId | "you";
export type StepKind = "ai" | "rule" | "human";
export type NodeState = "idle" | "active" | "done" | "skipped" | "blocked";
export type EdgeState = "idle" | "active" | "done" | "skipped";
export type ScenarioId = "jazz" | "milk" | "pills";

/** What the person would see on their own screen at a step. */
export type ScreenView =
  | { type: "said"; text: string }
  | { type: "working"; text: string }
  | { type: "plan"; title: string; when: string; rows: readonly string[]; yes: string }
  | { type: "undo"; text: string }
  | { type: "memory"; proposal: string | null }
  | { type: "message"; text: string };

export interface RunStep {
  id: string;
  /** Nodes that light up during this step. */
  actors: readonly NodeId[];
  kind: StepKind;
  title: string;
  plain: string;
  /** The real shapes that move between agents, as formatted text. */
  technical: string;
  outcome?: "blocked";
  screen: ScreenView;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  said: string;
}

export interface Run {
  scenario: Scenario;
  steps: readonly RunStep[];
  /** Index of the step that waits for the person's yes, if any. */
  decisionStep: number | null;
  /** Index of the step where the yes can still be undone, if any. */
  undoStep: number | null;
  /** Nodes that never act in this run. */
  skipped: readonly NodeId[];
}

export interface SpecialistOptions {
  eventId: string | null;
  ride: "own_way" | "family" | "undecided";
  family: "ride" | "invite" | "update" | "none";
}

/** Same rule as the real Coordinator: keep a specialist's option or fall back, never add one. */
export function coordinatorDraft(
  options: SpecialistOptions,
  proposed: SpecialistOptions,
): SpecialistOptions {
  return {
    eventId: proposed.eventId === options.eventId ? proposed.eventId : null,
    ride: proposed.ride === options.ride ? proposed.ride : "undecided",
    family: proposed.family === options.family ? proposed.family : "none",
  };
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "jazz",
    label: "A jazz outing",
    said: "I’d love to hear live jazz with Walt on Thursday. Could my daughter Maya drive me?",
  },
  { id: "milk", label: "Out of milk", said: "I’m out of milk." },
  { id: "pills", label: "A medicine request", said: "Can you order my blood pressure pills?" },
] as const;

const json = (value: unknown): string => JSON.stringify(value, null, 2);

const LOCK_STEP: Omit<RunStep, "screen" | "plain"> = {
  id: "lock",
  actors: ["decision", "scheduler"],
  kind: "rule",
  title: "The yes is locked in, with time to undo",
  technical:
    "create_decision(...)  → status: pending, undo_until: now + 10s\ncommit_decision(id)   → re-checks the cost shown, row-locked, runs once\nrun_scheduled()       → every 5 min: commits expired choices, follows up on no reply",
};

function jazzSteps(said: string): RunStep[] {
  const options: SpecialistOptions = { eventId: "evt_jazz_thu", ride: "family", family: "ride" };
  const plan: ScreenView = {
    type: "plan",
    title: "Jazz at the Lakeside Café",
    when: "Thursday · 2:00 pm",
    rows: ["Ask Maya for a lift · $0", "Pick-up 1:30 pm", "Your 2:00 reminder moves to 1:15"],
    yes: "Yes, ask Maya",
  };
  return [
    {
      id: "checkin",
      actors: ["checkin"],
      kind: "ai",
      title: "Check-in understands the wish",
      plain: "Hears a wish for live music on Thursday, with a lift from family.",
      technical: json({
        reply: "Lovely. I’ll show you a jazz option.",
        eventIds: [options.eventId],
        needs: [],
      }),
      screen: { type: "said", text: said },
    },
    {
      id: "specialists",
      actors: ["outings", "rides", "family"],
      kind: "ai",
      title: "Three specialists work at the same time",
      plain:
        "Outings picks Jazz at the Lakeside Café. Rides notes he asked for a family lift. Family circle suggests a ride request to Maya.",
      technical: `Outings        → ${JSON.stringify({ eventId: options.eventId })}\nRides          → ${JSON.stringify({ ride: options.ride })}\nFamily circle  → ${JSON.stringify({ family: options.family })}\n// one Promise.all, three narrow model calls`,
      screen: { type: "working", text: "Putting a plan together…" },
    },
    {
      id: "coordinator",
      actors: ["coordinator"],
      kind: "ai",
      title: "Coordinator merges them into one draft",
      plain:
        "Combines the three suggestions. Anything the specialists didn’t suggest is thrown away, so it can’t invent an option.",
      technical: json(coordinatorDraft(options, options)),
      screen: { type: "working", text: "Checking the details…" },
    },
    {
      id: "checks",
      actors: ["safety", "rules"],
      kind: "rule",
      title: "Ordinary code checks the draft",
      plain:
        "Nothing medical or financial. Pick-up is 1:30, so the 2:00 reminder would clash and moves to 1:15. A family lift costs $0, under the $25 ride limit.",
      technical:
        'UNSAFE_PATTERN.test(draft)      → false\nfindClash(plan, reminders)      → { from: "14:00", to: "13:15" }\noverLimit(0, 25)                → 0',
      screen: { type: "working", text: "Checking the details…" },
    },
    {
      id: "decision",
      actors: ["you"],
      kind: "human",
      title: "Your decision",
      plain: "One plan, one question. Nothing has been sent to anyone yet.",
      technical:
        'create_decision({\n  kind: "plan_ride",\n  optionId: "family",\n  shownCost: 0,\n  payload: { moveReminder: true }\n})  // waits for a yes',
      screen: plan,
    },
    {
      ...LOCK_STEP,
      plain:
        "Saved. Joe has 10 seconds to undo.",
      screen: { type: "undo", text: "Asking Maya for a lift on Thursday." },
    },
    {
      id: "memory",
      actors: ["memory"],
      kind: "ai",
      title: "Memory keeper offers one thing to keep",
      plain:
        "After the chat it suggests one fact. Joe keeps it or skips it, and the conversation itself is deleted.",
      technical: json({
        proposals: [{ kind: "like", text: "You love live jazz in the afternoon" }],
      }),
      screen: { type: "memory", proposal: "You love live jazz in the afternoon" },
    },
  ];
}

function milkSteps(said: string): RunStep[] {
  return [
    {
      id: "checkin",
      actors: ["checkin"],
      kind: "ai",
      title: "Check-in understands the need",
      plain: "Hears a need, not an outing: milk.",
      technical: json({
        reply: "Got it. I’ll show you a way to get milk.",
        eventIds: [],
        needs: ["milk"],
      }),
      screen: { type: "said", text: said },
    },
    {
      id: "routing",
      actors: [],
      kind: "rule",
      title: "The specialists aren’t needed",
      plain:
        "No outing, ride or family help was mentioned, so Outings, Rides, Family circle and the Coordinator aren’t called. Fewer AI calls, less to go wrong.",
      technical:
        "eventIds.length === 0 && no ride/family words\n→ prepareAgentDraft() skipped, draft = null",
      screen: { type: "working", text: "Working out the simplest way…" },
    },
    {
      id: "checks",
      actors: ["safety", "rules"],
      kind: "rule",
      title: "Ordinary code builds the choices",
      plain:
        "Milk is fine to arrange. Because Maya is set up as family, asking her comes first. Delivery services aren’t connected yet, and Company says so.",
      technical:
        'UNSAFE_PATTERN.test("milk")   → false\nerrandQuestion("milk", "Maya") → [ "Ask Maya", "I’ll get it myself", "Not now" ]',
      screen: { type: "working", text: "Working out the simplest way…" },
    },
    {
      id: "decision",
      actors: ["you"],
      kind: "human",
      title: "Your decision",
      plain: "One question with clear choices. Nothing has been sent to anyone yet.",
      technical:
        'create_decision({\n  kind: "errand",\n  optionId: "family",\n  shownCost: 0\n})  // waits for a yes',
      screen: {
        type: "plan",
        title: "Milk",
        when: "Needed soon",
        rows: ["Ask Maya to bring some · $0", "Or get it yourself", "Or not now"],
        yes: "Yes, ask Maya",
      },
    },
    {
      ...LOCK_STEP,
      plain:
        "Saved. Joe has 10 seconds to undo.",
      screen: { type: "undo", text: "Asking Maya to bring milk." },
    },
    {
      id: "memory",
      actors: ["memory"],
      kind: "ai",
      title: "Memory keeper keeps nothing",
      plain: "A one-off errand isn’t worth remembering, so it suggests nothing.",
      technical: json({ proposals: [] }),
      screen: { type: "memory", proposal: null },
    },
  ];
}

function pillsSteps(said: string): RunStep[] {
  const refusal = "Company can’t arrange medicines. Please speak to your pharmacy.";
  return [
    {
      id: "checkin",
      actors: ["checkin"],
      kind: "ai",
      title: "Check-in hears the request",
      plain: "Hears a request to order medicine.",
      technical: json({
        reply: "I’ll look into your pills.",
        eventIds: [],
        needs: ["blood pressure pills"],
      }),
      screen: { type: "said", text: said },
    },
    {
      id: "blocked",
      actors: ["safety"],
      kind: "rule",
      title: "The safety filter stops it",
      plain:
        "The words match the medicine rule. The AI’s answer is thrown away and no agent plans anything. This is a fixed rule, not a judgment call by a model.",
      technical:
        "UNSAFE_PATTERN.test(output)  → true   // matched: “blood pressure”, “pills”\n→ model reply discarded\n→ createErrand() refuses",
      outcome: "blocked",
      screen: { type: "working", text: "Checking…" },
    },
    {
      id: "told",
      actors: ["you"],
      kind: "human",
      title: "Joe is told plainly",
      plain: `Joe sees: “${refusal}” No decision to make, nothing sent.`,
      technical: `throw new Error("${refusal}")`,
      screen: { type: "message", text: refusal },
    },
  ];
}

const STEP_BUILDERS: Record<ScenarioId, (said: string) => RunStep[]> = {
  jazz: jazzSteps,
  milk: milkSteps,
  pills: pillsSteps,
};

/** Every node, in the order the diagram draws them. */
export const NODE_IDS: readonly NodeId[] = [
  "checkin",
  "outings",
  "rides",
  "family",
  "coordinator",
  "safety",
  "rules",
  "you",
  "decision",
  "scheduler",
  "memory",
] as const;

export const EDGES: readonly (readonly [NodeId, NodeId])[] = [
  ["checkin", "outings"],
  ["checkin", "rides"],
  ["checkin", "family"],
  ["outings", "coordinator"],
  ["rides", "coordinator"],
  ["family", "coordinator"],
  ["coordinator", "safety"],
  ["coordinator", "rules"],
  ["safety", "you"],
  ["rules", "you"],
  ["you", "decision"],
  ["decision", "scheduler"],
  ["decision", "memory"],
] as const;

export const edgeKey = (from: NodeId, to: NodeId): string => `${from}>${to}`;

export function buildRun(id: ScenarioId): Run {
  const scenario = SCENARIOS.find((item) => item.id === id) ?? SCENARIOS[0]!;
  const steps = STEP_BUILDERS[scenario.id](scenario.said);
  const acting = new Set(steps.flatMap((step) => step.actors));
  const decision = steps.findIndex((step) => step.id === "decision");
  const undo = steps.findIndex((step) => step.id === "lock");
  return {
    scenario,
    steps,
    decisionStep: decision >= 0 ? decision : null,
    undoStep: undo >= 0 ? undo : null,
    skipped: NODE_IDS.filter((node) => !acting.has(node)),
  };
}

/** The state of every node once the run has reached step `index` (-1 = not started). */
export function nodeStates(run: Run, index: number): Record<NodeId, NodeState> {
  const states = Object.fromEntries(NODE_IDS.map((node) => [node, "idle"])) as Record<
    NodeId,
    NodeState
  >;
  if (index < 0) return states;
  for (const node of run.skipped) states[node] = "skipped";
  run.steps.slice(0, index + 1).forEach((step, stepIndex) => {
    const current = stepIndex === index;
    for (const node of step.actors) {
      states[node] = step.outcome === "blocked" ? "blocked" : current ? "active" : "done";
    }
  });
  return states;
}

const REACHED: readonly NodeState[] = ["active", "done", "blocked"];

/** Edge states follow from the nodes at each end. */
export function edgeStates(nodes: Record<NodeId, NodeState>): Record<string, EdgeState> {
  const stateFor = (from: NodeState, to: NodeState): EdgeState => {
    if (from === "skipped" || to === "skipped") return "skipped";
    if (!REACHED.includes(from) || !REACHED.includes(to)) return "idle";
    return to === "active" || to === "blocked" ? "active" : "done";
  };
  return Object.fromEntries(
    EDGES.map(([from, to]) => [edgeKey(from, to), stateFor(nodes[from], nodes[to])]),
  );
}
