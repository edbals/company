import { z } from "zod";
import { askModel } from "./ai-model.server";

const Ride = z.enum(["own_way", "family", "undecided"]);
const Family = z.enum(["ride", "invite", "update", "none"]);
const EventChoice = z.object({ eventId: z.string().nullable() });
const Draft = EventChoice.extend({ ride: Ride, family: Family });
export type AgentDraft = z.infer<typeof Draft>;

type Candidate = { id: string; title: string; place: string | null; starts_at: string };

async function run<T>(schema: z.ZodType<T>, task: string, input: unknown): Promise<T | null> {
  try {
    return schema.parse(await askModel(task, input));
  } catch {
    return null;
  }
}

export async function prepareAgentDraft(
  words: string,
  checkin: { reply: string; eventIds: string[] },
  events: Candidate[],
): Promise<AgentDraft | null> {
  const candidates = events.filter((event) => checkin.eventIds.includes(event.id));
  const handoff = { words, checkin };
  const [outing, ride, family] = await Promise.all([
    candidates.length
      ? run(EventChoice, "You are Outings. Pick one supplied event ID that best fits the request, or null. Return {eventId}. Never invent an event.", { ...handoff, candidates })
      : null,
    run(z.object({ ride: Ride }), "You are Rides. Return {ride}: own_way if the person says they will arrange travel, family if they explicitly want family help with a ride, otherwise undecided. Do not offer bookings.", handoff),
    run(z.object({ family: Family }), "You are Family circle. Return {family}: ride, invite, or update only if the person explicitly asks to involve family in that way, otherwise none. This is a suggestion for review only.", handoff),
  ]);
  const event = candidates.find((candidate) => candidate.id === outing?.eventId);
  const options = { eventId: event?.id ?? null, ride: ride?.ride ?? "undecided", family: family?.family ?? "none" } satisfies AgentDraft;
  if (!options.eventId && options.ride === "undecided" && options.family === "none") return null;

  const draft = await run(Draft, "You are Coordinator. Assemble the draft from the supplied specialist results. Return {eventId, ride, family}. Keep a suggestion only if it fits the request; otherwise use null, undecided, or none. Never add a new choice.", { ...handoff, options, event });
  if (!draft) return null;
  return {
    eventId: draft.eventId === options.eventId ? draft.eventId : null,
    ride: draft.ride === options.ride ? draft.ride : "undecided",
    family: draft.family === options.family ? draft.family : "none",
  };
}
