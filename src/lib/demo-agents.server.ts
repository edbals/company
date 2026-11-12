// Server-only: runs Company's real agents for the public /demo. Nothing is read from or written to
// anyone's account; events come from the sample list and the only stored thing is a quota counter.
import { z } from "zod";
import { askModel } from "./ai-model.server";
import { prepareAgentDraft } from "./planning-agents.server";
import { MEMORY_EXCLUDE, UNSAFE_PATTERN } from "./safety";
import { safeTz } from "./plan-logic";
import {
  DemoResult,
  blockedResult,
  chatResult,
  fallbackPlan,
  firstName,
  inferRide,
  memoryFor,
  onRequestedDay,
  planOutcome,
  rideLine,
  sampleEvents,
  type DemoInput,
  type DemoRide,
  type SampleEvent,
  type TraceStep,
} from "./demo-plan";

const PER_VISITOR_PER_HOUR = 12;
const GLOBAL_PER_DAY = 500;
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

const CHECKIN = `You are Check-in, part of Company, a respectful planning companion for an older adult. Speak to them by first name.
Return JSON only: {"reply": string, "kind": "outing"|"errand"|"chat", "eventIds": string[], "needs": string[]}.
- reply: at most two short warm sentences at an easy reading level.
- kind "outing" when they want to go or do something; eventIds = up to 3 ids from "events" that fit (consider "likes" when they are open-ended). Never invent ids.
- kind "errand" when they need an item; needs = up to 2 short item names, e.g. "milk".
- kind "chat" for greetings or anything unclear; ask one short question about what they'd like to do.
- Never lecture about food, sleep or health. No medical advice or medication names. Never move money. Never claim anything is booked.`;

const MEMORY = `You are Memory keeper. Suggest at most one short fact worth remembering to plan things this person enjoys next time.
Return JSON only: {"fact": string|null}. Write it in third person using their first name, e.g. "Joe enjoys live jazz afternoons".
Never include health, medication, food, sleep, money or anything judging ability. Return {"fact": null} if nothing is worth keeping.`;

const CheckinOut = z.object({
  reply: z.string().min(1).max(320),
  kind: z.enum(["outing", "errand", "chat"]),
  eventIds: z.array(z.string()).max(5),
  needs: z.array(z.string().max(30)).max(2),
});
const MemoryOut = z.object({ fact: z.string().max(120).nullable() });

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
const isSafeReply = (text: string) => sentences(text) <= 2 && !UNSAFE_PATTERN.test(text);

async function hashIp(ip: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`company-demo:${ip}`),
  );
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Spends one AI call from the visitor's hourly and the site's daily budget. Any failure means no AI. */
export async function takeDemoQuota(ip: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const take = async (bucket: string, limit: number, window: number) => {
      const { data, error } = await supabaseAdmin.rpc("take_voice_quota", {
        _bucket: bucket,
        _limit: limit,
        _window_seconds: window,
      });
      if (error) console.error("demo quota check failed:", error.message);
      return !error && data === true;
    };
    if (!(await take(`demo:ip:${await hashIp(ip)}`, PER_VISITOR_PER_HOUR, HOUR_SECONDS)))
      return false;
    return await take("demo:global", GLOBAL_PER_DAY, DAY_SECONDS);
  } catch (err) {
    console.error("demo quota unavailable:", err instanceof Error ? err.name : "error");
    return false;
  }
}

async function suggestMemory(input: DemoInput, event: SampleEvent): Promise<string | null> {
  try {
    const out = MemoryOut.parse(
      await askModel(
        MEMORY,
        {
          firstName: firstName(input.profile),
          said: input.words,
          event: event.title,
          likes: input.profile.likes,
        },
        4000,
      ),
    );
    const fact = out.fact?.trim();
    if (fact && !MEMORY_EXCLUDE.test(fact) && !UNSAFE_PATTERN.test(fact)) return fact;
  } catch {
    // Fall through to the rule-based suggestion below.
  }
  return memoryFor(input.profile, event);
}

function rideFrom(draftRide: DemoRide | undefined, input: DemoInput): DemoRide {
  if (draftRide === "family" && !input.profile.helper) return "undecided";
  return draftRide ?? inferRide(input.words, input.profile);
}

async function outingPlan(
  input: DemoInput,
  reply: string,
  eventIds: string[],
  events: SampleEvent[],
  now: Date,
): Promise<DemoResult | null> {
  const candidates = events.filter((event) => eventIds.includes(event.id));
  if (!candidates.length) return null;
  const words = input.profile.helper
    ? `${input.words} (My helper is ${input.profile.helper.name}.)`
    : input.words;
  const draft = await prepareAgentDraft(words, { reply, eventIds }, candidates);
  const chosen = candidates.find((c) => c.id === draft?.eventId) ?? candidates[0]!;
  const event = onRequestedDay(chosen, input.words, now, safeTz(input.timezone));
  const ride = rideFrom(draft?.ride, input);
  const memory = await suggestMemory(input, event);
  const helper = input.profile.helper;
  const steps: TraceStep[] = [
    { agent: "checkin", status: "done", line: "Understood an outing wish." },
    { agent: "outings", status: "done", line: `Picked ${event.title} from the sample events.` },
    { agent: "rides", status: "done", line: rideLine(ride, input.profile) },
    {
      agent: "family",
      status: helper ? "done" : "skipped",
      line: helper
        ? `Drafted one clear request for ${helper.name}.`
        : "No helper added, so nothing to send.",
    },
    {
      agent: "coordinator",
      status: "done",
      line: draft
        ? "Kept only what the specialists suggested."
        : "Used the best match; nothing new added.",
    },
    { agent: "safety", status: "done", line: "Checked cost and timing. Rules, not AI." },
    {
      agent: "memory",
      status: memory ? "done" : "skipped",
      line: memory ? "Suggests one thing to remember." : "Nothing worth keeping.",
    },
  ];
  return {
    source: "ai",
    reply,
    steps,
    outcome: planOutcome({
      profile: input.profile,
      event,
      ride,
      tz: safeTz(input.timezone),
      memory,
    }),
  };
}

/** Real agents first; any refusal, invalid output or missing key falls back to the keyword planner. */
export async function runDemoPlan(
  input: DemoInput,
  ip: string,
  now: Date = new Date(),
): Promise<DemoResult> {
  const blocked = blockedResult(input.words);
  if (blocked) return blocked;
  if (!(await takeDemoQuota(ip))) return fallbackPlan(input, now);
  const events = sampleEvents(now);
  try {
    const checkin = CheckinOut.parse(
      await askModel(CHECKIN, {
        firstName: firstName(input.profile),
        likes: input.profile.likes,
        helper: input.profile.helper,
        timezone: safeTz(input.timezone),
        now: now.toISOString(),
        events: events.map(({ id, title, place, starts_at, cost }) => ({
          id,
          title,
          place,
          starts_at,
          cost,
        })),
        words: input.words,
      }),
    );
    if (!isSafeReply(checkin.reply)) return fallbackPlan(input, now);
    const ids = checkin.eventIds.filter((id) => events.some((e) => e.id === id)).slice(0, 3);
    if (checkin.kind === "outing") {
      const plan = await outingPlan(input, checkin.reply, ids, events, now);
      if (plan) return DemoResult.parse(plan);
    }
    if (checkin.kind === "chat") return chatResult(checkin.reply, "ai");
    const fallback = fallbackPlan(input, now);
    return fallback.outcome.kind === "chat"
      ? chatResult(checkin.reply, "ai")
      : { ...fallback, source: "ai", reply: checkin.reply };
  } catch (err) {
    console.error("demo agents failed:", err instanceof Error ? err.name : "error");
    return fallbackPlan(input, now);
  }
}
