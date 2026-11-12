// Builds the /demo planner's outcomes and the words shown with them. The bubble text is always
// derived from the outcome here, so what Company says can never disagree with what is on screen.
import { fmtDay, fmtTime, money } from "./plan-logic";
import type {
  AgentStepId,
  DemoOutcome,
  DemoPlan,
  DemoProfile,
  DemoResult,
  DemoRide,
  TraceStep,
} from "./demo-contract";
import { clockText, whenText, type SampleEvent } from "./demo-events";
import { MEMORY_EXCLUDE, UNSAFE_PATTERN } from "./safety";
import { OWN_WAY, RIDE_WORDS } from "./demo-words";

const PICKUP_LEAD_MINUTES = 30;
const NOT_CHECKED = "not checked";
/** Visits to hospitals or clinics are fine to plan but are never kept as a memory. */
const HEALTH_PLACE = /\b(hospital|clinic|doctor|dentist|surgery|care home|hospice|sick|ill)\b/i;

export function firstName(profile: DemoProfile): string {
  return profile.name.split(/\s+/)[0] ?? profile.name;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function inferRide(words: string, profile: DemoProfile): DemoRide {
  if (OWN_WAY.test(words)) return "own_way";
  if (profile.helper && RIDE_WORDS.test(words)) return "family";
  return "undecided";
}

/** A memory fact is never about health, food, sleep or money. */
export function safeMemory(fact: string | null | undefined): string | null {
  const text = fact?.trim();
  if (!text) return null;
  return MEMORY_EXCLUDE.test(text) || UNSAFE_PATTERN.test(text) || HEALTH_PLACE.test(text)
    ? null
    : text;
}

export function memoryFor(profile: DemoProfile, event: SampleEvent): string | null {
  return safeMemory(`${firstName(profile)} enjoys ${event.title.toLowerCase()}.`);
}

export function helperRequest(profile: DemoProfile, event: SampleEvent, tz: string): string | null {
  if (!profile.helper) return null;
  const pickUp = fmtTime(
    new Date(new Date(event.starts_at).getTime() - PICKUP_LEAD_MINUTES * 6e4).toISOString(),
    tz,
  );
  return `${firstName(profile)} asks: “Can you drive me on ${fmtDay(event.starts_at, tz)}? Pick-up ${pickUp}.”`;
}

interface PlanArgs {
  profile: DemoProfile;
  event: SampleEvent;
  ride: DemoRide;
  tz: string;
  memory: string | null;
  offerHelper?: boolean;
}
export function planOutcome(args: PlanArgs): DemoPlan {
  const { profile, event, ride, tz, memory, offerHelper = true } = args;
  return {
    kind: "plan",
    origin: "sample",
    title: event.title,
    when: `${fmtDay(event.starts_at, tz)}, ${fmtTime(event.starts_at, tz)}`,
    place: event.place,
    cost: money(event.cost),
    ride,
    helperRequest: ride === "own_way" || !offerHelper ? null : helperRequest(profile, event, tz),
    memory,
    notice: null,
  };
}

export interface PersonalArgs {
  profile: DemoProfile;
  title: string;
  place: string | null;
  dayOffset: number | null;
  time: number | null;
  ride: DemoRide;
  memory: string | null;
  booking: boolean;
  offerHelper: boolean;
  now: Date;
  tz: string;
}

function personalRequest(args: PersonalArgs): string | null {
  if (!args.profile.helper || !args.offerHelper || args.ride === "own_way") return null;
  const day = whenText(args.dayOffset, null, args.now, args.tz).replace(/, time not set$/, "");
  const on = args.dayOffset === null ? "" : ` on ${day}`;
  const pickUp =
    args.time === null ? "Pick-up time to agree." : `Pick-up ${clockText(args.time - 30)}.`;
  return `${firstName(args.profile)} asks: “Can you drive me${on}? It’s for: ${args.title}. ${pickUp}”`;
}

export function bookingNotice(profile: DemoProfile): string {
  const helper = profile.helper?.name;
  return helper
    ? `Taxi booking is not connected, but ${helper} could drive you or you can go your own way.`
    : "Taxi booking is not connected, so this one is your own way for now.";
}

/** The person's own plan: only what they said, cost not checked, nothing booked. */
export function personalPlan(args: PersonalArgs): DemoPlan {
  return {
    kind: "plan",
    origin: "personal",
    title: args.title,
    when: whenText(args.dayOffset, args.time, args.now, args.tz),
    place: args.place,
    cost: NOT_CHECKED,
    ride: args.ride,
    helperRequest: personalRequest(args),
    memory: args.memory,
    notice: args.booking ? bookingNotice(args.profile) : null,
  };
}

export function errandRequest(profile: DemoProfile, item: string): string | null {
  return profile.helper ? `${firstName(profile)} asks: “Could you help me get ${item}?”` : null;
}

export function reminderOutcome(
  profile: DemoProfile,
  item: string,
  offerHelper: boolean,
): Extract<DemoOutcome, { kind: "reminder" }> {
  return {
    kind: "reminder",
    title: `Pick up ${item}`,
    when: "On your next shopping trip",
    helperRequest: offerHelper ? errandRequest(profile, item) : null,
  };
}

/** What Company says with a plan card. Shared with the browser for options the person picks. */
export function planReply(plan: DemoPlan, profile: DemoProfile): string {
  const name = firstName(profile);
  if (plan.origin === "sample")
    return `${name}, I found ${plan.title.toLowerCase()} at ${plan.place ?? "a sample place"}. Have a look.`;
  const first = `${name}, I wrote down your own plan: ${plan.title}.`;
  if (plan.notice) return `${first} ${plan.notice}`;
  return plan.when.includes("not set") ? `${first} The time isn’t set yet.` : first;
}

/** The bubble text for any outcome except chat, whose text is a question. */
export function replyFor(outcome: Exclude<DemoOutcome, { kind: "chat" }>, profile: DemoProfile) {
  const name = firstName(profile);
  switch (outcome.kind) {
    case "plan":
      return planReply(outcome, profile);
    case "options":
      return outcome.options.length === 1
        ? `${name}, here is one idea from the sample events. Pick it, or say no.`
        : `${name}, here are ${outcome.options.length} ideas from the sample events. Pick the one you like.`;
    case "reminder":
      return `Got it, ${name}. Want a reminder to ${lowerFirst(outcome.title)}?`;
    case "blocked":
      return outcome.alternative.includes("pharmacy")
        ? "I can't order medicine. Want a reminder to call the pharmacy instead?"
        : "I can't move money or handle payments. Want a reminder to ask someone you trust?";
  }
}

export function skipped(
  ids: readonly AgentStepId[],
  line = "Not needed for this request.",
): TraceStep[] {
  return ids.map((agent) => ({ agent, status: "skipped" as const, line }));
}

export function rideLine(ride: DemoRide, profile: DemoProfile): string {
  const helper = profile.helper?.name;
  if (ride === "family" && helper) return `Suggests asking ${helper} for a lift.`;
  if (ride === "own_way") return "You'll get there your own way.";
  return helper ? `Can ask ${helper}. Other rides: Not connected.` : "Other rides: Not connected.";
}

export function safetyLine(outcome: DemoOutcome): string {
  if (outcome.kind === "plan" && outcome.origin === "personal")
    return "Checked for medicine and money; cost not checked. Rules, not AI.";
  if (outcome.kind === "reminder") return "Checked the reminder. Rules, not AI.";
  return "Checked cost and timing. Rules, not AI.";
}

export function chatResult(reply: string, source: "ai" | "ready"): DemoResult {
  return {
    source,
    reply,
    steps: [
      { agent: "checkin", status: "done", line: "Asked one question to understand." },
      ...skipped(["outings", "rides", "family", "coordinator", "safety", "memory"]),
    ],
    outcome: { kind: "chat" },
  };
}
