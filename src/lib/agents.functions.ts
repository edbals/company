// Live Talk and Remember for signed-in older adults. All context is loaded on the server from
// the caller's own rows; the client sends only their words and ids.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { prepareAgentDraft, type AgentDraft } from "./planning-agents.server";
import { askModel } from "./ai-model.server";
import { keywordMatch } from "./plan-logic";
import { requireElder } from "./role-guard";
import { MEMORY_EXCLUDE, UNSAFE_PATTERN } from "@/lib/safety";

type Turn = { who: "you" | "company"; text: string; source?: "ai" | "ready"; requestId?: string; eventIds?: string[]; needs?: string[]; draft?: AgentDraft | null };
const LECTURE = /\b(you should|make sure (you|to)|try to|remember to) (eat|sleep|rest|drink|take)\b/i;
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean).length;

const TALK = `You are Company, a clear and respectful planning companion for an older adult. Do not assume where they live, whether they drive, or whether family is available. Speak to them by first name.
Return JSON only: {"reply": string, "found": [{"kind": "wish"|"need", "text": string}], "eventIds": string[], "needs": string[]}.
- reply: at most two short warm sentences, easy reading level, responding to what they said.
- eventIds: ids from "events" that match a wish they expressed (max 3). Never invent ids.
- needs: short item names for things they need, e.g. "milk" (max 2).
- Never lecture or comment on food, sleep or health. No medical advice, no medication names. Never move money.
- If they haven't named a goal or need yet, ask what they would like to plan or get done.
- If you matched a catalog event or item, say you'll show that option. If the goal has no matching event or item, acknowledge it and say they can start a personal plan by adding a time and setting. Never imply an option was verified when none was.
- Do not ask booking questions yourself.`;

const REMEMBER = `You are Company's Memory keeper. From the conversation, propose at most 3 short facts worth remembering to help plan things the person enjoys.
Return JSON only: {"proposals": [{"kind": "person"|"like"|"routine", "text": string}]}.
- Write facts in second person, e.g. "You love live jazz in the afternoon" or "Walt is a friend who likes jazz".
- Never propose health, medication, symptoms, food, sleep, money, or anything judging capacity. Skip one-off errands and small talk.
- Return {"proposals": []} if nothing is worth keeping.`;

const CHECKIN_ONLY = "Only the person's own account can check in.";

/** Per-person cap on live model calls; past it Talk still answers with the keyword matcher. */
const TALK_MODEL_LIMIT_PER_HOUR = 60;
const HOUR_SECONDS = 3600;

async function takeTalkQuota(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("take_voice_quota", { _bucket: `talk:${userId}`, _window_seconds: HOUR_SECONDS, _limit: TALK_MODEL_LIMIT_PER_HOUR });
  if (error) console.error("talk quota check failed:", error.message);
  return !error && data === true;
}

const TalkIn = z.object({ checkinId: z.string().uuid().nullable(), words: z.string().trim().min(1).max(400), requestId: z.string().min(8).max(80) });

export const talkLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TalkIn.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("profiles").select("display_name, role, timezone, interests, declined_events").eq("id", context.userId).single();
    if (!me || me.role !== "elder") throw new Error(CHECKIN_ONLY);
    let checkinId = data.checkinId;
    let turns: Turn[] = [];
    if (checkinId) {
      const { data: c } = await sb.from("checkins").select("id, turns").eq("id", checkinId).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!c) return { checkinId: null, reply: "Let's start fresh. What would you like to plan or get done?", source: "ready" as const, eventIds: [], needs: [], requestId: data.requestId };
      turns = (c.turns as Turn[]) ?? [];
      const done = turns.find((t) => t.requestId === data.requestId);
      if (done) return { checkinId, reply: done.text, source: done.source ?? "ready", eventIds: done.eventIds ?? [], needs: done.needs ?? [], draft: done.draft ?? null, requestId: data.requestId };
    } else {
      const { data: c, error } = await sb.from("checkins").insert({ user_id: context.userId, turns: [] }).select("id").single();
      if (error || !c) throw new Error("Couldn't start the check-in");
      checkinId = c.id;
    }
    if (turns.length >= 20) return { checkinId, reply: "Let's pick this up later. Your plans are saved.", source: "ready" as const, eventIds: [], needs: [], requestId: data.requestId };

    const now = new Date();
    const { data: evs } = await sb.from("events").select("id, title, place, starts_at, ends_at, cost, tags")
      .gte("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 14 * 864e5).toISOString()).order("starts_at").limit(30);
    const events = (evs ?? []).filter((e) => !(me.declined_events ?? []).includes(e.id));
    const { data: facts } = await sb.from("memory_facts").select("text").limit(40);
    const { data: rems } = await sb.from("reminders").select("at_time");

    let reply = "", eventIds: string[] = [], needs: string[] = [], source: "ai" | "ready" = "ready";
    if (await takeTalkQuota(context.userId)) try {
      const raw = (await askModel(TALK, {
        firstName: me.display_name.split(" ")[0] || "there", interests: me.interests, remembered: (facts ?? []).map((f) => f.text),
        events: events.map(({ id, title, place, starts_at, ends_at, cost }) => ({ id, title, place, starts_at, ends_at, cost })),
        calendar: (rems ?? []).map((r) => ({ kind: "reminder", time: r.at_time })), timezone: me.timezone, now: now.toISOString(),
        conversation: turns.slice(-8).map((t) => ({ who: t.who, text: t.text })), words: data.words,
      })) as { reply?: unknown; eventIds?: unknown; needs?: unknown };
      const ok = typeof raw.reply === "string" && raw.reply.length > 0 && raw.reply.length <= 320 && sentences(raw.reply) <= 2
        && !UNSAFE_PATTERN.test(JSON.stringify(raw)) && !LECTURE.test(raw.reply)
        && Array.isArray(raw.eventIds) && raw.eventIds.every((id) => typeof id === "string" && events.some((e) => e.id === id))
        && (raw.needs === undefined || (Array.isArray(raw.needs) && raw.needs.every((n) => typeof n === "string" && n.length <= 30)));
      if (ok) {
        reply = raw.reply as string; eventIds = (raw.eventIds as string[]).slice(0, 3);
        needs = ((raw.needs as string[] | undefined) ?? []).map((n) => n.toLowerCase().replace(/[^a-z \-]/g, "").trim()).filter(Boolean).slice(0, 2);
        source = "ai";
      }
    } catch (err) {
      console.error("talk failed:", err instanceof Error ? err.name : "error");
    }
    if (source === "ready") {
      const k = keywordMatch(data.words, events);
      eventIds = k.eventIds; needs = k.needs;
      reply = eventIds.length || needs.length ? "Thanks. I've found some options to show you."
        : /^(not today|no thanks|nothing)[.! ]*$/i.test(data.words) ? "No problem. You can come back whenever you'd like to plan something."
        : /^(hi|hello|hey|good morning|thanks|thank you)[.! ]*$/i.test(data.words) ? "What would you like to plan or get done?"
        : "I heard you. You can start a personal plan by adding a time and setting; I haven't checked any options yet.";
    }
    const draft = source === "ai" && (eventIds.length || /\b(ride|drive|pickup|pick me up|family|invite|update)\b/i.test(data.words))
      ? await prepareAgentDraft(data.words, { reply, eventIds }, events)
      : null;
    const orderedEventIds = draft?.eventId
      ? [draft.eventId, ...eventIds.filter((id) => id !== draft.eventId)]
      : eventIds;
    turns.push({ who: "you", text: data.words }, { who: "company", text: reply, source, requestId: data.requestId, eventIds: orderedEventIds, needs, draft });
    await sb.from("checkins").update({ turns }).eq("id", checkinId);
    return { checkinId, reply, source, eventIds: orderedEventIds, needs, draft, requestId: data.requestId };
  });

export const rememberLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ checkinId: z.string().uuid(), note: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireElder(context.supabase, context.userId, CHECKIN_ONLY);
    const { data: c } = await context.supabase.from("checkins").select("turns").eq("id", data.checkinId).maybeSingle();
    // The raw conversation is only needed for this one step; it's deleted straight after, kept or not.
    await context.supabase.from("checkins").delete().eq("id", data.checkinId);
    if (!c) return { proposals: [], source: "ready" as const };
    const turns = ((c.turns as Turn[]) ?? []).slice(-12).map((t) => ({ who: t.who, text: t.text }));
    if (data.note) turns.push({ who: "you", text: data.note });
    const { data: facts } = await context.supabase.from("memory_facts").select("text").limit(40);
    try {
      const raw = (await askModel(REMEMBER, { conversation: turns, alreadyKnown: (facts ?? []).map((f) => f.text) })) as { proposals?: unknown };
      const P = z.array(z.object({ kind: z.enum(["person", "like", "routine"]), text: z.string().min(3).max(160) })).max(3);
      const parsed = P.safeParse(raw.proposals);
      if (!parsed.success) return { proposals: [], source: "ready" as const };
      const known = new Set((facts ?? []).map((f) => f.text.toLowerCase()));
      const proposals = parsed.data.filter((p) => !UNSAFE_PATTERN.test(p.text) && !MEMORY_EXCLUDE.test(p.text) && !known.has(p.text.toLowerCase()));
      return { proposals, source: "ai" as const };
    } catch {
      return { proposals: [], source: "ready" as const };
    }
  });

/** Leaving a check-in without the memory step: drop its short-lived conversation now. */
export const endCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ checkinId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireElder(context.supabase, context.userId, CHECKIN_ONLY);
    const { error } = await context.supabase.from("checkins").delete().eq("id", data.checkinId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
