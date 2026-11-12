// The request/response contract of the public /demo planner. Pure and safe to import in the browser.
import { z } from "zod";

export const DEMO_WORDS_MAX = 400;
/** How many recent turns ({who, text}) the browser sends so follow-ups continue the same request. */
export const DEMO_HISTORY_MAX = 6;
export const DEMO_TURN_MAX = 400;

export const DemoProfile = z.object({
  name: z.string().trim().min(1).max(40),
  helper: z
    .object({ name: z.string().trim().min(1).max(40), relation: z.string().trim().max(30) })
    .nullable(),
  likes: z.array(z.string().trim().min(1).max(30)).max(6),
});
export type DemoProfile = z.infer<typeof DemoProfile>;

export const DemoTurn = z.object({
  who: z.enum(["person", "company"]),
  text: z.string().trim().min(1).max(DEMO_TURN_MAX),
});
export type DemoTurn = z.infer<typeof DemoTurn>;

export const DemoInput = z.object({
  profile: DemoProfile,
  words: z.string().trim().min(1).max(DEMO_WORDS_MAX),
  timezone: z.string().max(60),
  history: z.array(DemoTurn).max(DEMO_HISTORY_MAX).default([]),
});
export type DemoInput = z.infer<typeof DemoInput>;

export const AGENT_STEP_IDS = [
  "checkin",
  "outings",
  "rides",
  "family",
  "coordinator",
  "safety",
  "memory",
] as const;
export type AgentStepId = (typeof AGENT_STEP_IDS)[number];

const TraceStep = z.object({
  agent: z.enum(AGENT_STEP_IDS),
  status: z.enum(["done", "skipped", "blocked"]),
  line: z.string().min(1).max(160),
});
export type TraceStep = z.infer<typeof TraceStep>;

const Ride = z.enum(["family", "own_way", "undecided"]);
export type DemoRide = z.infer<typeof Ride>;

const PlanOutcome = z.object({
  kind: z.literal("plan"),
  /** "sample": one of the made-up sample events. "personal": the person's own plan, nothing checked. */
  origin: z.enum(["sample", "personal"]),
  title: z.string().min(1).max(80),
  when: z.string().min(1).max(80),
  place: z.string().max(80).nullable(),
  cost: z.string().min(1).max(30),
  ride: Ride,
  helperRequest: z.string().max(240).nullable(),
  memory: z.string().max(160).nullable(),
  /** An honest note, e.g. that taxi booking is not connected. */
  notice: z.string().max(200).nullable(),
});
export type DemoPlan = z.infer<typeof PlanOutcome>;

const Outcome = z.discriminatedUnion("kind", [
  PlanOutcome,
  z.object({ kind: z.literal("options"), options: z.array(PlanOutcome).min(1).max(3) }),
  z.object({
    kind: z.literal("reminder"),
    title: z.string().min(1).max(80),
    when: z.string().min(1).max(80),
    helperRequest: z.string().max(240).nullable(),
  }),
  z.object({ kind: z.literal("blocked"), reason: z.string(), alternative: z.string() }),
  z.object({ kind: z.literal("chat") }),
]);
export type DemoOutcome = z.infer<typeof Outcome>;

export const DemoResult = z.object({
  source: z.enum(["ai", "ready", "rules"]),
  reply: z.string().min(1).max(320),
  steps: z.array(TraceStep),
  outcome: Outcome,
});
export type DemoResult = z.infer<typeof DemoResult>;
