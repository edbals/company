// Server-only: the /demo planner's model calls. Each agent gets one bounded call; every output is
// Zod-validated, and a failed or invalid call returns null so the caller can fall back to rules.
import { z } from "zod";
import { askModel } from "./ai-model.server";

export const CHECKIN_BUDGET_MS = 5500;
export const SPECIALIST_BUDGET_MS = 4500;
export const COORDINATOR_BUDGET_MS = 4000;

const SHARED_RULES = `Never give medical advice or name medication. Never move money. Never claim anything is booked, ordered, delivered, searched live or sent. Taxis, ride services and deliveries are not connected; rides are family or the person's own way only.`;

export const CHECKIN = `You are Check-in, part of Company, a respectful planning companion for an older adult. You read what they said (and "history", the recent conversation, oldest first) and sort it.
Return JSON only: {"kind": "plan"|"options"|"errand"|"chat", "reply": string, "eventIds": string[], "title": string|null, "place": string|null, "needs": string[], "wantsBooking": boolean}.
- "plan": they want to do something specific (any activity, a visit to someone, a trip). title = short neutral title in their words without "my", e.g. "Go bowling with grandkids", "Visit sister Ruth in the hospital". place only if they named one, else null. eventIds = up to 3 ids from "events" ONLY if the wish clearly is one of those sample events, else [].
- "options": they are open-ended or bored. eventIds = up to 3 ids from "events" that fit their "likes".
- "errand": they need an item. needs = up to 2 short item names, e.g. "new reading glasses".
- "chat": greetings or anything unclear. reply = one short warm question, at most two short sentences, using their first name.
- If "words" is only an answer (e.g. "yes please", "Saturday at 2"), continue the request from "history".
- wantsBooking = true if they ask you to book or call a taxi, cab or car.
- Visiting someone in hospital is a normal plan. ${SHARED_RULES}`;

export const OUTINGS = `You are Outings. Pick the one supplied candidate event that best fits the request, or null if none truly fits. Return {"eventId": string|null}. Never invent an id.`;

export const OUTINGS_OPTIONS = `You are Outings. The person is open to ideas. From the supplied candidates, choose up to 3 that best fit their likes, best first. Return {"eventIds": string[]}. Never invent an id.`;

export const RIDES = `You are Rides. Return {"ride": "own_way"|"family"|"undecided"}: own_way if the person says they will get there themselves, family if they clearly want their helper to drive them, otherwise undecided. ${SHARED_RULES}`;

export const FAMILY = `You are Family circle. Decide whether to draft one short request to the person's helper. For a plan return {"family": "ride"} unless they say they will get there themselves or do not want family involved, then {"family": "none"}. For an errand return {"family": "ride"} only if asking the helper to help get the item fits, else {"family": "none"}. This is a suggestion for the person to review.`;

export const MEMORY = `You are Memory keeper. Suggest at most one short fact worth remembering to plan things this person enjoys next time.
Return JSON only: {"fact": string|null}. Third person with their first name, e.g. "Joe enjoys bowling with his grandkids".
Never include health, hospitals, medication, food, sleep, money or anything judging ability. Return {"fact": null} if nothing is worth keeping.`;

export const COORDINATOR = `You are Coordinator. Assemble the final plan from the specialists' suggestions in "options". You may only keep or drop each suggestion: keep eventId or use null, keep ride or use "undecided", keep family or use "none", keep memory or use null. Never add or change a choice.
Return {"eventId": string|null, "ride": "own_way"|"family"|"undecided", "family": "ride"|"none", "memory": string|null}.`;

const Text = (max: number) => z.string().trim().max(max);

export const CheckinOut = z.object({
  kind: z.enum(["plan", "options", "errand", "chat"]),
  reply: Text(320).default(""),
  eventIds: z.array(z.string()).max(5).default([]),
  title: Text(60).nullable().default(null),
  place: Text(60).nullable().default(null),
  needs: z.array(Text(30)).max(2).default([]),
  wantsBooking: z.boolean().default(false),
});
export type CheckinOut = z.infer<typeof CheckinOut>;

const Ride = z.enum(["own_way", "family", "undecided"]);
const Family = z.enum(["ride", "none"]);
export const OutingsOut = z.object({ eventId: z.string().nullable() });
export const OptionsOut = z.object({ eventIds: z.array(z.string()).max(5) });
export const RidesOut = z.object({ ride: Ride });
export const FamilyOut = z.object({ family: Family });
export const MemoryOut = z.object({ fact: Text(120).nullable() });
export const CoordinatorOut = z.object({
  eventId: z.string().nullable(),
  ride: Ride,
  family: Family,
  memory: Text(160).nullable(),
});
export type CoordinatorOut = z.infer<typeof CoordinatorOut>;

/** One bounded model call. Any failure or invalid output is logged and returns null. */
export async function ask<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  instructions: string,
  payload: unknown,
  budgetMs: number,
): Promise<T | null> {
  try {
    return schema.parse(await askModel(instructions, payload, budgetMs));
  } catch (err) {
    const agent = /^You are ([\w ]+?)[.,]/.exec(instructions)?.[1] ?? "agent";
    console.error(
      `demo ${agent} failed:`,
      err instanceof Error ? err.message.slice(0, 200) : "error",
    );
    return null;
  }
}

/** Coordinator may only keep or drop what the specialists suggested; anything else is dropped. */
export function keepOrDrop(options: CoordinatorOut, chosen: CoordinatorOut): CoordinatorOut {
  return {
    eventId: chosen.eventId !== null && chosen.eventId === options.eventId ? chosen.eventId : null,
    ride: chosen.ride === options.ride ? chosen.ride : "undecided",
    family: chosen.family === options.family ? chosen.family : "none",
    memory: chosen.memory !== null && chosen.memory === options.memory ? chosen.memory : null,
  };
}
