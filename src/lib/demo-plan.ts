// Shared, pure pieces of the public /demo planner and the deterministic planner used when the AI
// is unavailable. Safe to import in the browser; re-exports the contract and helpers it needs.
import { keywordMatch, safeTz } from "./plan-logic";
import type { DemoInput, DemoOutcome, DemoProfile, DemoResult, TraceStep } from "./demo-contract";
import { onDayOffset, requestedDayOffset, requestedTime, sampleEvents } from "./demo-events";
import type { SampleEvent } from "./demo-events";
import {
  chatResult,
  firstName,
  inferRide,
  memoryFor,
  personalPlan,
  planOutcome,
  reminderOutcome,
  replyFor,
  rideLine,
  safetyLine,
  skipped,
} from "./demo-outcomes";
import {
  ACTIVITY,
  BOOK_RIDE,
  GREETING,
  MEDICINE,
  OPEN_ENDED,
  RIDE_WORDS,
  placeFrom,
  requestText,
  saidYesToRide,
  titleFrom,
  tripTitle,
  type RequestText,
} from "./demo-words";
import { UNSAFE_PATTERN } from "./safety";

export * from "./demo-contract";
export * from "./demo-events";
export {
  chatResult,
  firstName,
  helperRequest,
  inferRide,
  memoryFor,
  personalPlan,
  planOutcome,
  planReply,
  reminderOutcome,
  replyFor,
  rideLine,
  safeMemory,
  safetyLine,
  skipped,
} from "./demo-outcomes";
export { requestText, type RequestText } from "./demo-words";

const MAX_OPTIONS = 3;

/** Rules, not AI: requests for medicine or money never reach a model or a plan. */
export function blockedResult(words: string): DemoResult | null {
  const medicine = MEDICINE.test(words);
  if (!UNSAFE_PATTERN.test(words) && !medicine) return null;
  const outcome: DemoOutcome = {
    kind: "blocked",
    reason: medicine ? "Company never orders medicine." : "Company never moves money.",
    alternative: medicine ? "Remind me to call the pharmacy" : "Remind me to ask someone I trust",
  };
  return {
    source: "rules",
    reply: replyFor(outcome, { name: "you", helper: null, likes: [] }),
    steps: [
      { agent: "checkin", status: "done", line: "Heard the request." },
      {
        agent: "safety",
        status: "blocked",
        line: medicine
          ? "Stopped a medicine order. Rules, not AI."
          : "Stopped a money request. Rules, not AI.",
      },
      ...skipped(["outings", "rides", "family", "coordinator", "memory"]),
    ],
    outcome,
  };
}

/** Blocks this turn, or the earlier request a short answer like "yes please" continues. */
export function blockedFor(input: Pick<DemoInput, "words" | "history">): DemoResult | null {
  const request = requestText(input);
  return blockedResult(request.detail) ?? blockedResult(request.base);
}

/** Everything the planners read from the person's words; this turn wins over earlier ones. */
export interface DemoContext {
  profile: DemoProfile;
  name: string;
  tz: string;
  now: Date;
  request: RequestText;
  dayOffset: number | null;
  time: number | null;
  ride: ReturnType<typeof inferRide>;
  booking: boolean;
  events: SampleEvent[];
}

export function demoContext(input: DemoInput, now: Date): DemoContext {
  const tz = safeTz(input.timezone);
  const request = requestText(input);
  const { base, detail } = request;
  const dayOffset = requestedDayOffset(detail, now, tz) ?? requestedDayOffset(base, now, tz);
  const detailRide = inferRide(detail, input.profile);
  const saidYes = saidYesToRide(request) && !!input.profile.helper;
  const fromBase = saidYes ? "family" : inferRide(base, input.profile);
  const ride = detailRide === "undecided" ? fromBase : detailRide;
  return {
    profile: input.profile,
    name: firstName(input.profile),
    tz,
    now,
    request,
    dayOffset,
    time: requestedTime(detail) ?? requestedTime(base),
    ride,
    booking: BOOK_RIDE.test(base) || BOOK_RIDE.test(detail),
    events: sampleEvents(now).map((event) => onDayOffset(event, dayOffset, now, tz)),
  };
}

/** Sample events that fit the person's likes first, then the soonest others. */
export function likedEvents(ctx: DemoContext, max = MAX_OPTIONS): SampleEvent[] {
  const liked = keywordMatch(ctx.profile.likes.join(". "), ctx.events).eventIds;
  const ordered = [
    ...ctx.events.filter((event) => liked.includes(event.id)),
    ...[...ctx.events]
      .filter((event) => !liked.includes(event.id))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  ];
  return ordered.slice(0, max);
}

export function samplePlanFor(ctx: DemoContext, event: SampleEvent, memory: string | null) {
  return planOutcome({ profile: ctx.profile, event, ride: ctx.ride, tz: ctx.tz, memory });
}

function familyStep(ctx: DemoContext, drafted: boolean): TraceStep {
  const helper = ctx.profile.helper;
  if (!helper)
    return { agent: "family", status: "skipped", line: "No helper added, so nothing to send." };
  return drafted
    ? { agent: "family", status: "done", line: `Drafted one clear request for ${helper.name}.` }
    : { agent: "family", status: "skipped", line: `Nothing to ask ${helper.name}.` };
}

function readyResult(
  outcome: Exclude<DemoOutcome, { kind: "chat" }>,
  steps: TraceStep[],
  ctx: DemoContext,
): DemoResult {
  return { source: "ready", reply: replyFor(outcome, ctx.profile), steps, outcome };
}

function planSteps(
  ctx: DemoContext,
  outcome: Extract<DemoOutcome, { kind: "plan" }>,
  picked: string,
): TraceStep[] {
  return [
    { agent: "checkin", status: "done", line: "Heard something you want to do." },
    { agent: "outings", status: outcome.origin === "sample" ? "done" : "skipped", line: picked },
    { agent: "rides", status: "done", line: rideLine(outcome.ride, ctx.profile) },
    familyStep(ctx, !!outcome.helperRequest),
    { agent: "coordinator", status: "done", line: "Combined these into one plan." },
    { agent: "safety", status: "done", line: safetyLine(outcome) },
    {
      agent: "memory",
      status: outcome.memory ? "done" : "skipped",
      line: outcome.memory ? "Suggests one thing to remember." : "Nothing worth keeping.",
    },
  ];
}

function fallbackSample(ctx: DemoContext, event: SampleEvent): DemoResult {
  const outcome = samplePlanFor(ctx, event, memoryFor(ctx.profile, event));
  return readyResult(
    outcome,
    planSteps(ctx, outcome, `Picked ${event.title} from the sample events.`),
    ctx,
  );
}

function fallbackPersonal(ctx: DemoContext, title: string, place: string | null): DemoResult {
  const outcome = personalPlan({
    profile: ctx.profile,
    title,
    place,
    dayOffset: ctx.dayOffset,
    time: ctx.time,
    ride: ctx.ride,
    memory: null,
    booking: ctx.booking,
    offerHelper: true,
    now: ctx.now,
    tz: ctx.tz,
  });
  return readyResult(outcome, planSteps(ctx, outcome, "Your own plan, so no sample event."), ctx);
}

function fallbackOptions(ctx: DemoContext): DemoResult {
  const options = likedEvents(ctx).map((event) =>
    samplePlanFor(ctx, event, memoryFor(ctx.profile, event)),
  );
  const steps: TraceStep[] = [
    { agent: "checkin", status: "done", line: "Heard an open wish." },
    {
      agent: "outings",
      status: "done",
      line: `Picked ${options.length} sample events to choose from.`,
    },
    ...skipped(["rides", "family"], "Waits until you pick one."),
    { agent: "coordinator", status: "skipped", line: "Nothing to combine yet." },
    { agent: "safety", status: "done", line: "Checked cost and timing. Rules, not AI." },
    {
      agent: "memory",
      status: "done",
      line: "A simple rule suggests what to remember once you pick.",
    },
  ];
  return readyResult({ kind: "options", options }, steps, ctx);
}

function fallbackReminder(ctx: DemoContext, item: string): DemoResult {
  const outcome = reminderOutcome(ctx.profile, item, true);
  const steps: TraceStep[] = [
    { agent: "checkin", status: "done", line: `Heard a need: ${item}.` },
    ...skipped(["outings", "rides"]),
    familyStep(ctx, !!outcome.helperRequest),
    { agent: "coordinator", status: "skipped", line: "Nothing to combine." },
    { agent: "safety", status: "done", line: "Checked the reminder. Rules, not AI." },
    { agent: "memory", status: "skipped", line: "One-off errands aren't kept." },
  ];
  return readyResult(outcome, steps, ctx);
}

/** The first thing the person needs, ignoring "need to ..." which is an activity, not an item. */
export function errandItem(words: string, events: SampleEvent[]): string | null {
  const needs = keywordMatch(words, events).needs;
  return needs.find((item) => !/^to\b/.test(item) && !RIDE_WORDS.test(item)) ?? null;
}

/** Deterministic planner for when the AI is resting. Always returns a complete, matching result. */
export function fallbackPlan(input: DemoInput, now: Date = new Date()): DemoResult {
  const blocked = blockedFor(input);
  if (blocked) return blocked;
  const ctx = demoContext(input, now);
  const { base } = ctx.request;
  if (ctx.booking) return fallbackPersonal(ctx, tripTitle(base), placeFrom(base));
  const item = errandItem(base, ctx.events);
  if (item) return fallbackReminder(ctx, item);
  const direct = keywordMatch(base, ctx.events).eventIds[0];
  const event = ctx.events.find((sample) => sample.id === direct);
  if (event) return fallbackSample(ctx, event);
  if (OPEN_ENDED.test(base)) return fallbackOptions(ctx);
  const title = titleFrom(base);
  if (title && ACTIVITY.test(base)) return fallbackPersonal(ctx, title, placeFrom(base));
  return chatResult(
    GREETING.test(base)
      ? `Hi ${ctx.name}. What would you like to do this week?`
      : `I'm not sure I can plan that yet, ${ctx.name}. Tell me what you'd like to do, and when.`,
    "ready",
  );
}
