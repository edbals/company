// Server-only: runs Company's real agents for the public /demo. Nothing is read from or written to
// anyone's account; events come from the sample list and the only stored thing is a quota counter.
// At most three sequential model round-trips: Check-in, then the specialists and Memory keeper in
// parallel, then Coordinator. The reply is always derived from the final outcome, never mixed.
import {
  DemoResult,
  blockedFor,
  chatResult,
  demoContext,
  errandItem,
  fallbackPlan,
  likedEvents,
  memoryFor,
  personalPlan,
  planOutcome,
  reminderOutcome,
  replyFor,
  rideLine,
  safeMemory,
  safetyLine,
  skipped,
  type DemoContext,
  type DemoInput,
  type DemoOutcome,
  type DemoPlan,
  type SampleEvent,
  type TraceStep,
} from "./demo-plan";
import { cleanHistory, isUnsafeText, titleFrom, tripTitle } from "./demo-words";
import {
  CHECKIN,
  CHECKIN_BUDGET_MS,
  COORDINATOR,
  COORDINATOR_BUDGET_MS,
  CheckinOut,
  CoordinatorOut,
  FAMILY,
  FamilyOut,
  MEMORY,
  MemoryOut,
  OUTINGS,
  OUTINGS_OPTIONS,
  OptionsOut,
  OutingsOut,
  RIDES,
  RidesOut,
  SPECIALIST_BUDGET_MS,
  ask,
  keepOrDrop,
} from "./demo-specialists.server";
import { takeDemoQuota } from "./demo-quota.server";

export { takeDemoQuota };

const MAX_CHAT_SENTENCES = 2;
const OPTION_CANDIDATES = 5;
const MAX_OPTIONS = 3;
/** Free AI text must never claim something happened that the demo cannot do. */
const CLAIMS =
  /\b(booked|reserved|ordered|delivered|confirmed|on (its|the) way|searched|live listings?|i(?:'ve| have) (?:sent|messaged|texted|called|arranged|asked|told))\b/i;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
export const isSafeChat = (text: string) =>
  !!text && sentences(text) <= MAX_CHAT_SENTENCES && !isUnsafeText(text) && !CLAIMS.test(text);

interface Run {
  input: DemoInput;
  ctx: DemoContext;
  checkin: CheckinOut;
  handoff: { words: string; history: ReturnType<typeof cleanHistory>; firstName: string };
}

const eventSummary = ({ id, title, place, starts_at, cost }: SampleEvent) => ({
  id,
  title,
  place,
  starts_at,
  cost,
});

function checkinIsSafe(checkin: CheckinOut): boolean {
  const fields = [checkin.title ?? "", checkin.place ?? "", ...checkin.needs];
  if (fields.some(isUnsafeText)) return false;
  return checkin.kind !== "chat" || isSafeChat(checkin.reply);
}

function aiResult(
  outcome: Exclude<DemoOutcome, { kind: "chat" }>,
  steps: TraceStep[],
  run: Run,
): DemoResult | null {
  if (isUnsafeText(JSON.stringify(outcome))) return null;
  return { source: "ai", reply: replyFor(outcome, run.ctx.profile), steps, outcome };
}

function familyLine(run: Run, ran: boolean, drafted: boolean): TraceStep {
  const helper = run.ctx.profile.helper;
  if (!helper || !ran)
    return { agent: "family", status: "skipped", line: "No helper added, so nothing to send." };
  return drafted
    ? { agent: "family", status: "done", line: `Drafted one clear request for ${helper.name}.` }
    : { agent: "family", status: "done", line: `Decided not to ask ${helper.name}.` };
}

interface Specialists {
  eventId: string | null;
  ride: CoordinatorOut["ride"];
  family: CoordinatorOut["family"];
  memory: string | null;
  memoryAnswered: boolean;
}

/** Round-trip 2: Outings, Rides, Family circle and Memory keeper together. Null if one fails. */
async function askSpecialists(run: Run, candidates: SampleEvent[]): Promise<Specialists | null> {
  const { handoff, ctx } = run;
  const title = run.checkin.title;
  const [outing, ride, family, memory] = await Promise.all([
    candidates.length
      ? ask(
          OutingsOut,
          OUTINGS,
          { ...handoff, candidates: candidates.map(eventSummary) },
          SPECIALIST_BUDGET_MS,
        )
      : Promise.resolve({ eventId: null }),
    ask(
      RidesOut,
      RIDES,
      { ...handoff, helper: ctx.profile.helper?.name ?? null },
      SPECIALIST_BUDGET_MS,
    ),
    ctx.profile.helper
      ? ask(
          FamilyOut,
          FAMILY,
          { ...handoff, kind: "plan", helper: ctx.profile.helper },
          SPECIALIST_BUDGET_MS,
        )
      : Promise.resolve({ family: "none" as const }),
    ask(
      MemoryOut,
      MEMORY,
      { ...handoff, likes: ctx.profile.likes, title, candidates: candidates.map((c) => c.title) },
      SPECIALIST_BUDGET_MS,
    ),
  ]);
  if (!outing || !ride || !family) return null;
  const eventId = candidates.some((c) => c.id === outing.eventId) ? outing.eventId : null;
  const rideChoice = ride.ride === "family" && !ctx.profile.helper ? "undecided" : ride.ride;
  return {
    eventId,
    ride: rideChoice,
    family: family.family,
    memory: safeMemory(memory?.fact),
    memoryAnswered: !!memory,
  };
}

function planSteps(run: Run, plan: DemoPlan, found: Specialists, dropped: number): TraceStep[] {
  const ranOutings = run.checkin.eventIds.length > 0;
  return [
    { agent: "checkin", status: "done", line: "Understood something you want to do." },
    ranOutings
      ? {
          agent: "outings",
          status: "done",
          line:
            plan.origin === "sample"
              ? `Picked ${plan.title} from the sample events.`
              : "No sample event fits; kept your own plan.",
        }
      : { agent: "outings", status: "skipped", line: "Your own plan, so no sample event." },
    { agent: "rides", status: "done", line: rideLine(plan.ride, run.ctx.profile) },
    familyLine(run, !!run.ctx.profile.helper, !!plan.helperRequest),
    {
      agent: "coordinator",
      status: "done",
      line: dropped
        ? `Dropped ${dropped} suggestion(s); added nothing.`
        : "Kept only what the specialists suggested.",
    },
    { agent: "safety", status: "done", line: safetyLine(plan) },
    found.memoryAnswered
      ? {
          agent: "memory",
          status: "done",
          line: plan.memory ? "Suggests one thing to remember." : "Nothing worth keeping.",
        }
      : {
          agent: "memory",
          status: "skipped",
          line: "Didn't answer in time, so nothing to remember.",
        },
  ];
}

function buildPlan(run: Run, kept: CoordinatorOut, candidates: SampleEvent[]): DemoPlan | null {
  const { ctx, checkin } = run;
  const event = candidates.find((c) => c.id === kept.eventId);
  const offerHelper = kept.family === "ride";
  if (event)
    return planOutcome({
      profile: ctx.profile,
      event,
      ride: kept.ride,
      tz: ctx.tz,
      memory: kept.memory,
      offerHelper,
    });
  const booking = ctx.booking || checkin.wantsBooking;
  const base = ctx.request.base;
  const title = checkin.title || (booking ? tripTitle(base) : titleFrom(base));
  if (!title) return null;
  return personalPlan({
    profile: ctx.profile,
    title,
    place: checkin.place || null,
    dayOffset: ctx.dayOffset,
    time: ctx.time,
    ride: kept.ride,
    memory: kept.memory,
    booking,
    offerHelper,
    now: ctx.now,
    tz: ctx.tz,
  });
}

async function planFlow(run: Run): Promise<DemoResult | null> {
  const ids = run.checkin.eventIds;
  const candidates = run.ctx.events.filter((event) => ids.includes(event.id)).slice(0, MAX_OPTIONS);
  const found = await askSpecialists(run, candidates);
  if (!found) return null;
  const options: CoordinatorOut = {
    eventId: found.eventId,
    ride: found.ride,
    family: found.family,
    memory: found.memory,
  };
  const chosen = await ask(
    CoordinatorOut,
    COORDINATOR,
    { ...run.handoff, options },
    COORDINATOR_BUDGET_MS,
  );
  if (!chosen) return null;
  const kept = keepOrDrop(options, chosen);
  const dropped = (Object.keys(options) as (keyof CoordinatorOut)[]).filter(
    (key) => options[key] !== kept[key],
  ).length;
  const plan = buildPlan(run, kept, candidates);
  return plan && aiResult(plan, planSteps(run, plan, found, dropped), run);
}

function optionsSteps(count: number): TraceStep[] {
  return [
    { agent: "checkin", status: "done", line: "Understood an open wish." },
    {
      agent: "outings",
      status: "done",
      line: `Chose ${count} sample events for you to pick from.`,
    },
    ...skipped(["rides", "family"], "Waits until you pick one."),
    {
      agent: "coordinator",
      status: "skipped",
      line: "Only one specialist answered; nothing to combine.",
    },
    { agent: "safety", status: "done", line: "Checked cost and timing. Rules, not AI." },
    {
      agent: "memory",
      status: "skipped",
      line: "Not asked; a simple rule suggests a memory once you pick.",
    },
  ];
}

async function optionsFlow(run: Run): Promise<DemoResult | null> {
  const { ctx, checkin } = run;
  const chosenIds = new Set([
    ...checkin.eventIds,
    ...likedEvents(ctx, OPTION_CANDIDATES).map((e) => e.id),
  ]);
  const candidates = ctx.events
    .filter((event) => chosenIds.has(event.id))
    .slice(0, OPTION_CANDIDATES);
  const picked = await ask(
    OptionsOut,
    OUTINGS_OPTIONS,
    { ...run.handoff, likes: ctx.profile.likes, candidates: candidates.map(eventSummary) },
    SPECIALIST_BUDGET_MS,
  );
  if (!picked) return null;
  const events = [...new Set(picked.eventIds)]
    .map((id) => candidates.find((event) => event.id === id))
    .filter((event): event is SampleEvent => !!event)
    .slice(0, MAX_OPTIONS);
  if (!events.length) return null;
  const options = events.map((event) =>
    planOutcome({
      profile: ctx.profile,
      event,
      ride: ctx.ride,
      tz: ctx.tz,
      memory: memoryFor(ctx.profile, event),
    }),
  );
  return aiResult({ kind: "options", options }, optionsSteps(events.length), run);
}

async function errandFlow(run: Run): Promise<DemoResult | null> {
  const { ctx, checkin } = run;
  const item =
    checkin.needs.find((need) => need && !isUnsafeText(need)) ??
    errandItem(ctx.request.base, ctx.events);
  if (!item) return null;
  const helper = ctx.profile.helper;
  const family = helper
    ? await ask(
        FamilyOut,
        FAMILY,
        { ...run.handoff, kind: "errand", item, helper },
        SPECIALIST_BUDGET_MS,
      )
    : { family: "none" as const };
  if (!family) return null;
  const outcome = reminderOutcome(ctx.profile, item, family.family === "ride");
  const steps: TraceStep[] = [
    { agent: "checkin", status: "done", line: `Understood a need: ${item}.` },
    ...skipped(["outings", "rides"]),
    familyLine(run, !!helper, !!outcome.helperRequest),
    {
      agent: "coordinator",
      status: "skipped",
      line: "Only one specialist answered; nothing to combine.",
    },
    { agent: "safety", status: "done", line: safetyLine(outcome) },
    { agent: "memory", status: "skipped", line: "One-off errands aren't kept." },
  ];
  return aiResult(outcome, steps, run);
}

/** Round-trip 1: Check-in sorts the request. Then the matching flow runs. Null means "use rules". */
async function runAgents(input: DemoInput, now: Date): Promise<DemoResult | null> {
  const ctx = demoContext(input, now);
  const history = cleanHistory(input.history);
  const checkin = await ask(
    CheckinOut,
    CHECKIN,
    {
      firstName: ctx.name,
      likes: ctx.profile.likes,
      helper: ctx.profile.helper,
      timezone: ctx.tz,
      now: now.toISOString(),
      events: ctx.events.map(eventSummary),
      history,
      words: input.words,
    },
    CHECKIN_BUDGET_MS,
  );
  if (!checkin || !checkinIsSafe(checkin)) return null;
  const valid = {
    ...checkin,
    eventIds: checkin.eventIds.filter((id) => ctx.events.some((e) => e.id === id)),
  };
  const run: Run = {
    input,
    ctx,
    checkin: valid,
    handoff: { words: input.words, history, firstName: ctx.name },
  };
  if (valid.kind === "chat") return chatResult(valid.reply, "ai");
  if (valid.kind === "errand") return errandFlow(run);
  if (valid.kind === "options") return optionsFlow(run);
  return planFlow(run);
}

/** Rules first, then real agents; any refusal, invalid output or quota miss uses the full fallback. */
export async function runDemoPlan(
  input: DemoInput,
  ip: string,
  now: Date = new Date(),
): Promise<DemoResult> {
  const blocked = blockedFor(input);
  if (blocked) return blocked;
  if (!(await takeDemoQuota(ip))) return fallbackPlan(input, now);
  try {
    const result = await runAgents(input, now);
    if (result) return DemoResult.parse(result);
  } catch (err) {
    console.error(
      "demo agents failed:",
      err instanceof Error ? err.message.slice(0, 300) : "error",
    );
  }
  return fallbackPlan(input, now);
}
