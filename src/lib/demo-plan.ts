// Shared, pure pieces of the public /demo planner: the request/response contract, the sample
// events, and the keyword planner used when the AI is unavailable. Safe to import in the browser.
import { z } from "zod";
import {
  fmtDay,
  fmtTime,
  keywordMatch,
  localDayNumber,
  money,
  partsIn,
  safeTz,
} from "./plan-logic";
import { UNSAFE_PATTERN, MEMORY_EXCLUDE } from "./safety";

export const DEMO_WORDS_MAX = 400;

export const DemoProfile = z.object({
  name: z.string().trim().min(1).max(40),
  helper: z
    .object({ name: z.string().trim().min(1).max(40), relation: z.string().trim().max(30) })
    .nullable(),
  likes: z.array(z.string().trim().min(1).max(30)).max(6),
});
export type DemoProfile = z.infer<typeof DemoProfile>;

export const DemoInput = z.object({
  profile: DemoProfile,
  words: z.string().trim().min(1).max(DEMO_WORDS_MAX),
  timezone: z.string().max(60),
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

const Outcome = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    title: z.string(),
    when: z.string(),
    place: z.string(),
    cost: z.string(),
    ride: Ride,
    helperRequest: z.string().nullable(),
    memory: z.string().nullable(),
  }),
  z.object({ kind: z.literal("reminder"), title: z.string(), when: z.string() }),
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

export interface SampleEvent {
  id: string;
  title: string;
  place: string;
  starts_at: string;
  ends_at: string;
  cost: number;
  tags: string[];
}

const DAY_MS = 864e5;
interface EventSeed {
  id: string;
  title: string;
  place: string;
  day: number;
  hour: number;
  hours: number;
  cost: number;
  tags: string[];
}
const EVENT_SEEDS: readonly EventSeed[] = [
  {
    id: "jazz",
    title: "Live jazz afternoon",
    place: "Lakeside Café",
    day: 3,
    hour: 14,
    hours: 2,
    cost: 12,
    tags: ["jazz", "music", "live music", "concert", "band"],
  },
  {
    id: "market",
    title: "Saturday farmers market",
    place: "Riverside Square",
    day: 5,
    hour: 10,
    hours: 3,
    cost: 0,
    tags: ["market", "farmers market", "shopping", "food", "vegetables"],
  },
  {
    id: "garden",
    title: "Garden club meet-up",
    place: "Community Garden",
    day: 2,
    hour: 11,
    hours: 2,
    cost: 0,
    tags: ["garden", "gardening", "plants", "flowers"],
  },
  {
    id: "film",
    title: "Classic film matinee",
    place: "Rio Theatre",
    day: 4,
    hour: 13,
    hours: 2,
    cost: 8,
    tags: ["film", "films", "movie", "movies", "cinema"],
  },
  {
    id: "library",
    title: "Local history talk",
    place: "Central Library",
    day: 6,
    hour: 15,
    hours: 1,
    cost: 0,
    tags: ["library", "history", "talk", "lecture", "books", "reading"],
  },
  {
    id: "walk",
    title: "Gentle park walk group",
    place: "Stanley Park entrance",
    day: 1,
    hour: 10,
    hours: 1,
    cost: 0,
    tags: ["walk", "walks", "walking", "park", "outdoors", "nature"],
  },
  {
    id: "cards",
    title: "Cards and coffee afternoon",
    place: "Seniors' Centre",
    day: 2,
    hour: 14,
    hours: 2,
    cost: 3,
    tags: ["cards", "bridge", "games", "coffee", "friends", "coffee with friends"],
  },
  {
    id: "choir",
    title: "Community choir concert",
    place: "St. Andrew's Hall",
    day: 8,
    hour: 19,
    hours: 2,
    cost: 10,
    tags: ["choir", "singing", "sing", "concert", "music"],
  },
  {
    id: "art",
    title: "Watercolour drop-in class",
    place: "Arts Centre",
    day: 9,
    hour: 13,
    hours: 2,
    cost: 15,
    tags: ["art", "painting", "watercolour", "drawing", "class"],
  },
];

/** Sample local events over the next two weeks, dated from `now`. Never presented as live listings. */
export function sampleEvents(now: Date = new Date()): SampleEvent[] {
  const base = new Date(now);
  base.setUTCHours(0, 0, 0, 0);
  return EVENT_SEEDS.map((seed) => {
    const start = new Date(base.getTime() + seed.day * DAY_MS);
    start.setUTCHours(seed.hour + 8); // Seeds are Pacific local hours; UTC is 8 hours ahead.
    const end = new Date(start.getTime() + seed.hours * 36e5);
    return {
      id: seed.id,
      title: seed.title,
      place: seed.place,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      cost: seed.cost,
      tags: seed.tags,
    };
  });
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SATURDAY = 6;

/** How many days from today (in the person's timezone) they asked for, or null if they named no day. */
export function requestedDayOffset(words: string, now: Date, tz: string): number | null {
  const text = words.toLowerCase();
  if (/\b(today|tonight|this afternoon|this evening)\b/.test(text)) return 0;
  if (/\btomorrow\b/.test(text)) return 1;
  const today = WEEKDAYS.indexOf(partsIn(now.toISOString(), tz).weekday.toLowerCase());
  if (today < 0) return null;
  const named = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}s?\\b`).test(text));
  if (named >= 0) return (named - today + 7) % 7 || 7;
  if (/\bweekend\b/.test(text)) return today === 0 || today === SATURDAY ? 0 : SATURDAY - today;
  return null;
}

/** Moves a sample event to the day the person asked for, keeping its time of day. */
export function onRequestedDay(
  event: SampleEvent,
  words: string,
  now: Date,
  tz: string,
): SampleEvent {
  const offset = requestedDayOffset(words, now, tz);
  if (offset === null) return event;
  const days = localDayNumber(now.toISOString(), tz) + offset - localDayNumber(event.starts_at, tz);
  if (!days) return event;
  const move = (iso: string) => new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
  return { ...event, starts_at: move(event.starts_at), ends_at: move(event.ends_at) };
}

const MEDICINE =
  /\b(pill|pills|medic\w*|prescri\w*|dose|dosage|tablet\w*|insulin|blood pressure|pharmac\w*)\b/i;
const RIDE_WORDS = /\b(drive|driving|ride|lift|pick me up|pickup|pick-up|take me)\b/i;
const OWN_WAY = /\b(myself|my own|on my own|walk there|bus|taxi|i'?ll get there)\b/i;
const OPEN_ENDED = /\b(something|anything|ideas?|bored|fun|this week|weekend|get out|go out)\b/i;
const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you)[.! ]*$/i;

export function firstName(profile: DemoProfile): string {
  return profile.name.split(/\s+/)[0] ?? profile.name;
}

/** Rules, not AI: requests for medicine or money never reach a model or a plan. */
export function blockedResult(words: string): DemoResult | null {
  if (!UNSAFE_PATTERN.test(words) && !MEDICINE.test(words)) return null;
  const medicine = MEDICINE.test(words);
  return {
    source: "rules",
    reply: medicine
      ? "I can't order medicine. Want a reminder to call the pharmacy instead?"
      : "I can't move money or handle payments. Want a reminder to ask someone you trust?",
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
    outcome: {
      kind: "blocked",
      reason: medicine ? "Company never orders medicine." : "Company never moves money.",
      alternative: medicine ? "Remind me to call the pharmacy" : "Remind me to ask someone I trust",
    },
  };
}

function skipped(ids: readonly AgentStepId[]): TraceStep[] {
  return ids.map((agent) => ({
    agent,
    status: "skipped" as const,
    line: "Not needed for this request.",
  }));
}

export function inferRide(words: string, profile: DemoProfile): DemoRide {
  if (OWN_WAY.test(words)) return "own_way";
  if (profile.helper && RIDE_WORDS.test(words)) return "family";
  return "undecided";
}

export function helperRequest(profile: DemoProfile, event: SampleEvent, tz: string): string | null {
  if (!profile.helper) return null;
  const pickUp = fmtTime(
    new Date(new Date(event.starts_at).getTime() - 30 * 6e4).toISOString(),
    tz,
  );
  return `${firstName(profile)} asks: “Can you drive me on ${fmtDay(event.starts_at, tz)}? Pick-up ${pickUp}.”`;
}

export function memoryFor(profile: DemoProfile, event: SampleEvent): string | null {
  const fact = `${firstName(profile)} enjoys ${event.title.toLowerCase()}.`;
  return MEMORY_EXCLUDE.test(fact) || UNSAFE_PATTERN.test(fact) ? null : fact;
}

interface PlanArgs {
  profile: DemoProfile;
  event: SampleEvent;
  ride: DemoRide;
  tz: string;
  memory: string | null;
}
export function planOutcome({ profile, event, ride, tz, memory }: PlanArgs): DemoOutcome {
  return {
    kind: "plan",
    title: event.title,
    when: `${fmtDay(event.starts_at, tz)}, ${fmtTime(event.starts_at, tz)}`,
    place: event.place,
    cost: money(event.cost),
    ride,
    helperRequest: ride === "own_way" ? null : helperRequest(profile, event, tz),
    memory,
  };
}

export function rideLine(ride: DemoRide, profile: DemoProfile): string {
  const helper = profile.helper?.name;
  if (ride === "family" && helper) return `Suggests asking ${helper} for a lift.`;
  if (ride === "own_way") return "You'll get there your own way.";
  return helper ? `Can ask ${helper}. Other rides: Not connected.` : "Other rides: Not connected.";
}

function pickEvent(words: string, profile: DemoProfile, events: SampleEvent[]): SampleEvent | null {
  const { eventIds } = keywordMatch(words, events);
  const direct = events.find((event) => event.id === eventIds[0]);
  if (direct) return direct;
  if (!OPEN_ENDED.test(words)) return null;
  const fromLikes = keywordMatch(profile.likes.join(". "), events).eventIds[0];
  return events.find((event) => event.id === fromLikes) ?? events[0] ?? null;
}

/** Deterministic planner for when the AI is resting: keyword match over the sample events. */
export function fallbackPlan(input: DemoInput, now: Date = new Date()): DemoResult {
  const blocked = blockedResult(input.words);
  if (blocked) return blocked;
  const { profile, words } = input;
  const tz = safeTz(input.timezone);
  const name = firstName(profile);
  const events = sampleEvents(now);
  const picked = pickEvent(words, profile, events);
  const event = picked && onRequestedDay(picked, words, now, tz);
  if (event) {
    const ride = inferRide(words, profile);
    const memory = memoryFor(profile, event);
    return {
      source: "ready",
      reply: `${name}, I found ${event.title.toLowerCase()} at ${event.place}. Have a look.`,
      steps: [
        { agent: "checkin", status: "done", line: "Heard an outing wish." },
        { agent: "outings", status: "done", line: `Picked ${event.title} from the sample events.` },
        { agent: "rides", status: "done", line: rideLine(ride, profile) },
        {
          agent: "family",
          status: profile.helper ? "done" : "skipped",
          line: profile.helper
            ? `Drafted one clear request for ${profile.helper.name}.`
            : "No helper added, so nothing to send.",
        },
        { agent: "coordinator", status: "done", line: "Combined these into one plan." },
        { agent: "safety", status: "done", line: "Checked cost and timing. Rules, not AI." },
        {
          agent: "memory",
          status: memory ? "done" : "skipped",
          line: memory ? "Suggests one thing to remember." : "Nothing worth keeping.",
        },
      ],
      outcome: planOutcome({ profile, event, ride, tz, memory }),
    };
  }
  const { needs } = keywordMatch(words, events);
  const item = needs[0];
  if (item) {
    return {
      source: "ready",
      reply: `Got it, ${name}. Want a reminder to pick up ${item}?`,
      steps: [
        { agent: "checkin", status: "done", line: `Heard a need: ${item}.` },
        ...skipped(["outings", "rides", "family", "coordinator"]),
        { agent: "safety", status: "done", line: "Checked the reminder. Rules, not AI." },
        { agent: "memory", status: "skipped", line: "One-off errands aren't kept." },
      ],
      outcome: { kind: "reminder", title: `Pick up ${item}`, when: "On your next shopping trip" },
    };
  }
  return chatResult(
    GREETING.test(words)
      ? `Hi ${name}. What would you like to do this week?`
      : `I'm not sure I can plan that yet, ${name}. Try an outing, like music, a walk or a market.`,
    "ready",
  );
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
