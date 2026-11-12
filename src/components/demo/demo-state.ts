// Pure state machine for the /demo page. Screens after "working" are driven by the planner's
// result, not by fixed scenarios.
import { DEMO_HISTORY_MAX } from "@/lib/demo-contract";
import type { DemoPlan, DemoProfile, DemoResult, DemoRide, DemoTurn } from "@/lib/demo-contract";

export type Screen =
  | "name"
  | "helper"
  | "likes"
  | "ask"
  | "working"
  | "error"
  | "options"
  | "question"
  | "plan"
  | "undo"
  | "family"
  | "memory"
  | "reminder"
  | "blocked"
  | "finish";

export const UNDO_SECONDS = 10;

export const STAGES = ["About you", "Ask", "Planning", "Decide", "Done"] as const;
const STAGE_OF: Readonly<Record<Screen, number>> = {
  name: 0,
  helper: 0,
  likes: 0,
  ask: 1,
  error: 1,
  working: 2,
  options: 3,
  question: 3,
  plan: 3,
  undo: 3,
  family: 3,
  memory: 3,
  reminder: 3,
  blocked: 3,
  finish: 4,
};
export function stageOf(screen: Screen): number {
  return STAGE_OF[screen];
}

export const JOE: DemoProfile = {
  name: "Joe",
  helper: { name: "Maya", relation: "daughter" },
  likes: ["jazz", "coffee with friends"],
};

export function firstName(profile: DemoProfile): string {
  return profile.name.split(/\s+/)[0] || profile.name;
}

export interface DemoState {
  readonly screen: Screen;
  readonly profile: DemoProfile;
  readonly words: string;
  readonly result: DemoResult | null;
  /** The plan being decided: a direct plan result, or the option the person chose. */
  readonly plan: DemoPlan | null;
  /** The last few turns, sent with each request so follow-ups continue the same ask. */
  readonly history: readonly DemoTurn[];
  readonly error: string | null;
  readonly ride: DemoRide;
  readonly seconds: number;
  readonly accepted: boolean;
  readonly memory: "kept" | "skipped" | null;
  readonly reminder: boolean | null;
}

export type DemoAction =
  | { type: "name"; name: string }
  | { type: "helper"; helper: DemoProfile["helper"] }
  | { type: "likes"; likes: readonly string[] }
  | { type: "skip" }
  | { type: "submit"; words: string }
  | { type: "resolved"; result: DemoResult }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "choose"; index: number }
  | { type: "askHelper" }
  | { type: "ride"; ride: DemoRide }
  | { type: "confirm" }
  | { type: "tick" }
  | { type: "undo" }
  | { type: "next" }
  | { type: "accept" }
  | { type: "memory"; choice: "kept" | "skipped" }
  | { type: "reminder"; yes: boolean }
  | { type: "again" }
  | { type: "reset"; profile?: DemoProfile | null };

export const EMPTY_PROFILE: DemoProfile = { name: "", helper: null, likes: [] };

export function initialState(profile: DemoProfile | null = null): DemoState {
  return {
    screen: profile ? "ask" : "name",
    profile: profile ?? EMPTY_PROFILE,
    words: "",
    result: null,
    plan: null,
    history: [],
    error: null,
    ride: "undecided",
    seconds: 0,
    accepted: false,
    memory: null,
    reminder: null,
  };
}

/** Where a plan opens: the ride question when it is open and a helper could drive. */
function planScreen(plan: DemoPlan): Screen {
  return plan.ride === "undecided" && plan.helperRequest ? "question" : "plan";
}

/** Where a fresh planner result opens. */
function firstOutcomeScreen(result: DemoResult): Screen {
  const { outcome } = result;
  if (outcome.kind === "chat") return "ask";
  if (outcome.kind === "options") return "options";
  if (outcome.kind === "reminder") return "reminder";
  if (outcome.kind === "blocked") return "blocked";
  return planScreen(outcome);
}

/** The request the helper's phone shows: the plan's, or the reminder's. */
export function helperRequestOf(state: DemoState): string | null {
  if (state.plan) return state.plan.helperRequest;
  const outcome = state.result?.outcome;
  return outcome?.kind === "reminder" ? outcome.helperRequest : null;
}

/** Where the plan goes after the undo window closes (or Maya accepts). */
function afterPlan(state: DemoState, fromFamily: boolean): Screen {
  const { plan } = state;
  if (!plan) return "finish";
  if (!fromFamily && state.ride === "family" && plan.helperRequest) return "family";
  return plan.memory ? "memory" : "finish";
}

function onResult(state: DemoState, result: DemoResult): DemoState {
  const { outcome } = result;
  const plan = outcome.kind === "plan" ? outcome : null;
  const turns: readonly DemoTurn[] = [
    ...state.history,
    { who: "person", text: state.words },
    { who: "company", text: result.reply },
  ];
  return {
    ...state,
    result,
    plan,
    history: turns.slice(-DEMO_HISTORY_MAX),
    ride: plan?.ride ?? "undecided",
    error: null,
    screen: firstOutcomeScreen(result),
  };
}

function onChoose(state: DemoState, index: number): DemoState {
  const outcome = state.result?.outcome;
  const plan =
    state.screen === "options" && outcome?.kind === "options" ? outcome.options[index] : undefined;
  if (!plan) return state;
  return { ...state, plan, ride: plan.ride, screen: planScreen(plan) };
}

function onAskHelper(state: DemoState): DemoState {
  const canAsk = state.screen === "reminder" && helperRequestOf(state) && state.profile.helper;
  return canAsk ? { ...state, screen: "family", accepted: false } : state;
}

function onNext(state: DemoState): DemoState {
  if (state.screen === "undo" && state.seconds === 0)
    return { ...state, screen: afterPlan(state, false) };
  if (state.screen === "family" && state.accepted)
    return {
      ...state,
      screen: afterPlan(state, true),
      reminder: state.plan ? state.reminder : true,
    };
  return state;
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "name":
      return state.screen === "name"
        ? { ...state, profile: { ...state.profile, name: action.name.trim() }, screen: "helper" }
        : state;
    case "helper":
      return state.screen === "helper"
        ? { ...state, profile: { ...state.profile, helper: action.helper }, screen: "likes" }
        : state;
    case "likes":
      return state.screen === "likes"
        ? { ...state, profile: { ...state.profile, likes: [...action.likes] }, screen: "ask" }
        : state;
    case "skip":
      return { ...initialState(JOE) };
    case "submit":
      return state.screen === "ask" || state.screen === "error"
        ? {
            ...initialState(state.profile),
            history: state.history,
            words: action.words,
            screen: "working",
          }
        : state;
    case "resolved":
      return state.screen === "working" ? onResult(state, action.result) : state;
    case "failed":
      return state.screen === "working"
        ? { ...state, error: action.message, screen: "error" }
        : state;
    case "retry":
      return state.screen === "error" ? { ...state, screen: "working" } : state;
    case "choose":
      return onChoose(state, action.index);
    case "askHelper":
      return onAskHelper(state);
    case "ride":
      return state.screen === "question" ? { ...state, ride: action.ride, screen: "plan" } : state;
    case "confirm":
      return state.screen === "plan" ? { ...state, screen: "undo", seconds: UNDO_SECONDS } : state;
    case "tick":
      return state.screen === "undo" && state.seconds > 0
        ? { ...state, seconds: state.seconds - 1 }
        : state;
    case "undo":
      return state.screen === "undo" && state.seconds > 0
        ? { ...state, screen: "plan", seconds: 0 }
        : state;
    case "next":
      return onNext(state);
    case "accept":
      return state.screen === "family" ? { ...state, accepted: true } : state;
    case "memory":
      return state.screen === "memory"
        ? { ...state, memory: action.choice, screen: "finish" }
        : state;
    case "reminder":
      return state.screen === "reminder" || state.screen === "blocked"
        ? { ...state, reminder: action.yes, screen: "finish" }
        : state;
    case "again":
      return { ...initialState(state.profile) };
    case "reset":
      return initialState(action.profile ?? null);
  }
}
