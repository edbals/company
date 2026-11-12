// Server commands for the real app. Every call runs as the signed-in user (row security applies);
// household-crossing work goes through database functions that check membership themselves.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEMORY_EXCLUDE, UNSAFE_PATTERN } from "@/lib/safety";
import { findClash } from "./plan-logic";
import { requireElder } from "./role-guard";
import { interestsWithout, namesMentioned, redactName } from "./scrub";

const auth = [requireSupabaseAuth] as const;
const id = z.string().uuid();
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
const safeText = (t: string) => !UNSAFE_PATTERN.test(t) && !MEMORY_EXCLUDE.test(t);

// ---------- profile ----------
export const getMe = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle();
  fail(error);
  return data;
});

const ProfileIn = z.object({
  role: z.enum(["elder", "family"]).optional(),
  display_name: z.string().trim().min(1).max(60).optional(),
  timezone: z.string().max(64).optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  ride_limit: z.number().int().min(0).max(500).optional(),
  share_plans: z.boolean().optional(), share_errands: z.boolean().optional(), share_outings: z.boolean().optional(),
  escalate_no_reply: z.boolean().optional(), help_contact_consent: z.boolean().optional(), read_aloud: z.boolean().optional(),
  phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/).nullable().optional(),
  onboarded: z.boolean().optional(), reconfirm: z.boolean().optional(),
});
export const saveProfile = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => ProfileIn.parse(d))
  .handler(async ({ data, context }) => {
    const { data: cur } = await context.supabase.from("profiles").select("role, onboarded").eq("id", context.userId).single();
    const { reconfirm, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (rest.role && cur?.onboarded && cur.role !== rest.role) throw new Error("Your role can't change after setup.");
    if (rest.timezone) { try { new Intl.DateTimeFormat("en-US", { timeZone: rest.timezone }); } catch { throw new Error("Unknown timezone"); } }
    if (reconfirm || rest.onboarded) patch["last_confirmed"] = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase.from("profiles").update(patch as never).eq("id", context.userId);
    fail(error);
    if (rest.role === "elder" && rest.onboarded) {
      for (const i of rest.interests ?? []) {
        if (safeText(i)) await context.supabase.from("memory_facts").insert({ user_id: context.userId, kind: "like", text: `You enjoy ${i.toLowerCase()}`, source: "You said at setup" });
      }
    }
    return { ok: true };
  });

async function familyName(sb: any): Promise<string | null> {
  const { data } = await sb.rpc("elder_household");
  const m = (data?.members ?? []).find((x: { status: string }) => x.status === "active");
  return m ? (m.name || "your family") : null;
}

/** Commits any choice whose Undo window has closed (e.g. the person left the page). Idempotent. */
async function flushDecisions(sb: any) {
  const { data } = await sb.from("decisions").select("id").eq("status", "pending").lt("undo_until", new Date().toISOString());
  for (const d of data ?? []) await sb.rpc("commit_decision", { _id: d.id, _send_now: false });
}

// ---------- older adult home ----------
export const getHome = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const sb = context.supabase;
  await flushDecisions(sb);
  const since = new Date(Date.now() - 864e5).toISOString();
  const [profile, plans, errands, reminders, activity, events] = await Promise.all([
    sb.from("profiles").select("*").eq("id", context.userId).single(),
    sb.from("plans").select("*").or(`starts_at.gte.${since},status.eq.planning`).neq("status", "skipped").order("starts_at").limit(30),
    sb.from("errands").select("*").not("status", "in", "(skipped,done)").order("created_at").limit(20),
    sb.from("reminders").select("*").order("at_time"),
    sb.from("activity").select("*").order("created_at", { ascending: false }).limit(12),
    sb.from("events").select("id, title, place, starts_at, ends_at, cost, tags").is("owner_id", null).gte("starts_at", new Date().toISOString()).order("starts_at").limit(40),
  ]);
  fail(profile.error); fail(plans.error);
  const p = profile.data!;
  const planned = new Set((plans.data ?? []).map((x) => x.event_id));
  const interests = p.interests.map((i: string) => i.toLowerCase());
  const pool = (events.data ?? []).filter((e) => !planned.has(e.id) && !p.declined_events.includes(e.id));
  const ranked = [...pool.filter((e) => e.tags.some((t: string) => interests.some((i: string) => t.includes(i) || i.includes(t)))), ...pool];
  const suggestions = [...new Map(ranked.map((e) => [e.id, e])).values()].slice(0, p.fewer_suggestions ? 1 : 2);
  return { profile: p, plans: plans.data ?? [], errands: errands.data ?? [], reminders: reminders.data ?? [], activity: activity.data ?? [], suggestions, familyName: await familyName(sb) };
});

// ---------- events ----------
export const listEvents = createServerFn({ method: "GET" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(60).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("events").select("*").gte("ends_at", new Date().toISOString()).order("starts_at").limit(50);
    const q = data.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`title.ilike.%${q}%,place.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q.toLowerCase()}}`);
    const { data: rows, error } = await query;
    fail(error);
    return (rows ?? []).map((e) => ({ ...e, mine: e.owner_id === context.userId }));
  });

const EventIn = z.object({
  id: id.optional(), title: z.string().trim().min(1).max(120), place: z.string().trim().max(120).default(""),
  description: z.string().trim().max(500).default(""), starts_at: z.string().datetime({ offset: true }), ends_at: z.string().datetime({ offset: true }),
  cost: z.number().min(0).max(1000).default(0),
}).refine((e) => new Date(e.ends_at) > new Date(e.starts_at), "End must be after start");
export const saveEvent = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => EventIn.parse(d))
  .handler(async ({ data, context }) => {
    const { id: eid, ...row } = data;
    const tags = row.title.toLowerCase().split(/\W+/).filter((w) => w.length > 2).slice(0, 8);
    if (eid) {
      const { error } = await context.supabase.from("events").update({ ...row, tags }).eq("id", eid).eq("owner_id", context.userId);
      fail(error); return { id: eid };
    }
    const { data: ev, error } = await context.supabase.from("events").insert({ ...row, tags, owner_id: context.userId }).select("id").single();
    fail(error); return { id: ev!.id };
  });
export const deleteEvent = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("events").delete().eq("id", data.id).eq("owner_id", context.userId);
    fail(error); return { ok: true };
  });

// ---------- plans ----------
export const createPlan = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ eventId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await requireElder(context.supabase, context.userId, "Only the person's own account can make a plan.");
    const { data: existing } = await sb.from("plans").select("id").eq("event_id", data.eventId).neq("status", "skipped").maybeSingle();
    if (existing) return { id: existing.id };
    const { data: ev } = await sb.from("events").select("*").eq("id", data.eventId).single();
    if (!ev) throw new Error("That event isn't available.");
    const pickup = new Date(new Date(ev.starts_at).getTime() - 30 * 60_000).toISOString();
    const { data: plan, error } = await sb.from("plans").insert({ user_id: context.userId, event_id: ev.id, title: ev.title, place: ev.place, starts_at: ev.starts_at, ends_at: ev.ends_at, cost: ev.cost, pickup_at: pickup }).select("id").single();
    fail(error);
    await sb.from("activity").insert({ user_id: context.userId, entity_id: plan!.id, agent: "outings", text: `Started a plan for ${ev.title}. Nothing is booked yet.` });
    await sb.from("profiles").update({ consecutive_declines: 0 }).eq("id", context.userId);
    return { id: plan!.id };
  });

/** A person's own plan need not come from the event catalog. The person supplies
 * unverified details before anything is saved; no provider is contacted. */
const PersonalPlanIn = z.object({
  title: z.string().trim().min(3).max(120),
  place: z.string().trim().max(120),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  share: z.boolean().default(false),
}).refine((p) => new Date(p.ends_at) > new Date(p.starts_at), "End must be after start")
  .refine((p) => new Date(p.starts_at).getTime() > Date.now(), "Choose a future start time");
export const createPersonalPlan = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => PersonalPlanIn.parse(d))
  .handler(async ({ data, context }) => {
    if (UNSAFE_PATTERN.test(data.title)) throw new Error("Company can't arrange medical or money actions from a personal plan.");
    await requireElder(context.supabase, context.userId, "Only the person's own account can make a plan.");
    const noTravel = /^(At home|Online or phone)$/i.test(data.place);
    const pickup = noTravel ? null : new Date(new Date(data.starts_at).getTime() - 30 * 60_000).toISOString();
    const { data: plan, error } = await context.supabase.from("plans").insert({
      user_id: context.userId, event_id: null, title: data.title, place: data.place,
      starts_at: data.starts_at, ends_at: data.ends_at, pickup_at: pickup,
      share_override: data.share,
    }).select("id").single();
    fail(error);
    await context.supabase.from("activity").insert({ user_id: context.userId, entity_id: plan!.id,
      agent: "coordinator", text: "Started your personal plan. The time, place and cost have not been independently checked. Nothing was booked or sent." });
    return { id: plan!.id };
  });

export const getPlan = createServerFn({ method: "GET" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await flushDecisions(sb);
    const [plan, log, rems, prof, pending] = await Promise.all([
      sb.from("plans").select("*").eq("id", data.id).maybeSingle(),
      sb.from("activity").select("*").eq("entity_id", data.id).order("created_at"),
      sb.from("reminders").select("id, label, at_time"),
      sb.from("profiles").select("timezone, ride_limit, share_plans, display_name").eq("id", context.userId).single(),
      sb.from("decisions").select("*").eq("target_id", data.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1),
    ]);
    if (!plan.data) throw new Error("Plan not found");
    return { plan: plan.data, log: log.data ?? [], reminders: rems.data ?? [], profile: prof.data!, pending: pending.data?.[0] ?? null, familyName: await familyName(sb) };
  });

export const updatePlan = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({
    id, share_override: z.boolean().nullable().optional(), ride_quote: z.number().min(0).max(1000).optional(),
    title: z.string().trim().min(1).max(120).optional(), place: z.string().trim().max(120).optional(),
    starts_at: z.string().datetime({ offset: true }).optional(), ends_at: z.string().datetime({ offset: true }).optional(),
    skip: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id: pid, skip, ...patch } = data;
    const changesDetails = patch.title !== undefined || patch.place !== undefined || patch.starts_at !== undefined || patch.ends_at !== undefined;
    if (changesDetails) {
      const { data: current, error: readError } = await context.supabase.from("plans").select("title, place, starts_at, ends_at, status").eq("id", pid).maybeSingle();
      fail(readError);
      if (!current) throw new Error("Plan not found.");
      if (current.status !== "planning") throw new Error("This plan is already confirmed. Start a new plan to change its time or place.");
      const { data: pending } = await context.supabase.from("decisions").select("id").eq("target_id", pid).eq("status", "pending").limit(1);
      if (pending?.length) throw new Error("Your earlier choice is still in its Undo period. Undo or wait before editing details.");
      const starts = new Date(patch.starts_at ?? current.starts_at), ends = new Date(patch.ends_at ?? current.ends_at);
      if (!(ends > starts)) throw new Error("End must be after start.");
    }
    const extra: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (skip) extra["status"] = "skipped";
    if (patch.starts_at) extra["pickup_at"] = new Date(new Date(patch.starts_at).getTime() - 30 * 60_000).toISOString();
    const { error } = await context.supabase.from("plans").update({ ...patch, ...extra } as never).eq("id", pid);
    fail(error);
    const note = patch.ride_quote !== undefined ? `Taxi fare noted: about $${patch.ride_quote}. Any earlier choice needs a fresh yes.` : patch.share_override !== undefined ? (patch.share_override === false ? "Your family won't see this plan." : "Your family can see this plan.") : patch.title || patch.starts_at || patch.place ? "Plan details edited." : null;
    if (note) await context.supabase.from("activity").insert({ user_id: context.userId, entity_id: pid, text: note });
    return { ok: true };
  });

export const rideFellThrough = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: p } = await sb.from("plans").select("*").eq("id", data.id).single();
    if (!p || p.status !== "going") throw new Error("Only a plan you're going to can have a ride problem.");
    await sb.from("plans").update({ ride_status: "not_covered", updated_at: new Date().toISOString() }).eq("id", p.id);
    await sb.from("requests").update({ status: "withdrawn" }).eq("target_id", p.id).eq("status", "sent");
    await sb.from("activity").insert({ user_id: context.userId, entity_id: p.id, agent: "rides", text: "Your ride fell through. Not covered yet. Company is working on it with you." });
    const { data: hh } = await sb.rpc("my_household");
    const { data: me } = await sb.from("profiles").select("display_name").eq("id", context.userId).single();
    if (hh) await sb.from("updates").insert({ household_id: hh, user_id: context.userId, category: "plans", plan_id: p.id, text: `${me?.display_name || "They"}'s ride to ${p.title} fell through. Company is sorting it out with them.` });
    return { ok: true };
  });

export const markOutcome = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id, outcome: z.enum(["lovely", "okay", "missed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: p } = await sb.from("plans").select("*").eq("id", data.id).single();
    if (!p) throw new Error("Plan not found");
    await sb.from("plans").update({ status: data.outcome === "missed" ? "skipped" : "done", updated_at: new Date().toISOString() }).eq("id", p.id);
    await sb.from("activity").insert({ user_id: context.userId, entity_id: p.id, agent: "checkin", text: data.outcome === "missed" ? "You didn't make it this time." : `You said it was ${data.outcome}.` });
    const { data: hh } = await sb.rpc("my_household");
    const { data: me } = await sb.from("profiles").select("display_name").eq("id", context.userId).single();
    if (hh && data.outcome !== "missed") await sb.from("updates").insert({ household_id: hh, user_id: context.userId, category: "outings", plan_id: p.id, text: `${me?.display_name || "They"} went to ${p.title}${p.friend_name ? ` with ${p.friend_name}` : ""} and said it was ${data.outcome}.` });
    return { ok: true, suggestion: data.outcome === "lovely" ? `You enjoy ${p.title.toLowerCase()}${p.friend_name ? ` with ${p.friend_name}` : ""}` : null };
  });

export const declineSuggestion = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ eventId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("profiles").select("declined_events, consecutive_declines").eq("id", context.userId).single();
    const n = (p?.consecutive_declines ?? 0) + 1;
    await context.supabase.from("profiles").update({ declined_events: [...new Set([...(p?.declined_events ?? []), data.eventId])], consecutive_declines: n }).eq("id", context.userId);
    return { askFewer: n >= 2 };
  });
export const setFewer = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ value: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({ fewer_suggestions: data.value, consecutive_declines: 0 }).eq("id", context.userId);
    return { ok: true };
  });

// ---------- errands & reminders ----------
export const createErrand = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ item: z.string().trim().min(1).max(60), need_by: z.string().date().nullable().default(null) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireElder(context.supabase, context.userId, "Only the person's own account can ask for an errand.");
    if (UNSAFE_PATTERN.test(data.item)) throw new Error("Company can't arrange medicines. Please speak to your pharmacy.");
    const { data: e, error } = await context.supabase.from("errands").insert({ user_id: context.userId, item: data.item.toLowerCase(), need_by: data.need_by }).select("id").single();
    fail(error); return { id: e!.id };
  });
export const getErrand = createServerFn({ method: "GET" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    await flushDecisions(context.supabase);
    const [e, log, pending] = await Promise.all([
      context.supabase.from("errands").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("activity").select("*").eq("entity_id", data.id).order("created_at"),
      context.supabase.from("decisions").select("*").eq("target_id", data.id).eq("status", "pending").limit(1),
    ]);
    if (!e.data) throw new Error("Errand not found");
    return { errand: e.data, log: log.data ?? [], pending: pending.data?.[0] ?? null, familyName: await familyName(context.supabase) };
  });
export const addReminder = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ label: z.string().trim().min(1).max(80), at_time: z.string().regex(/^\d{2}:\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminders").insert({ user_id: context.userId, ...data });
    fail(error); return { ok: true };
  });
export const deleteReminder = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminders").delete().eq("id", data.id);
    fail(error); return { ok: true };
  });

// ---------- decisions (explicit yes, 10-second Undo, server commit) ----------
export const createDecision = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["plan_ride", "errand", "recover"]), targetId: id,
    optionId: z.enum(["family", "own_way", "no_ride", "skip"]), shownCost: z.number().min(0).max(1000),
    payload: z.object({ friend: z.string().trim().min(1).max(40).optional(), moveReminder: z.boolean().optional() }).default({}),
    key: z.string().min(8).max(80),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // The reminder change is recomputed here from the person's own plan and reminders, never taken from the client.
    const payload: Record<string, string> = {};
    if (data.payload.friend) payload["friend"] = data.payload.friend;
    if (data.kind === "plan_ride" && data.payload.moveReminder && data.optionId !== "skip") {
      const [{ data: p }, { data: rems }, { data: prof }] = await Promise.all([
        sb.from("plans").select("*").eq("id", data.targetId).maybeSingle(),
        sb.from("reminders").select("id, label, at_time"),
        sb.from("profiles").select("timezone").eq("id", context.userId).single(),
      ]);
      const clash = p ? findClash(p, rems ?? [], prof?.timezone ?? "UTC") : null;
      if (clash) { payload["reminder_id"] = clash.reminder.id; payload["reminder_to"] = clash.to; }
    }
    const { data: dec, error } = await sb.rpc("create_decision", {
      _kind: data.kind, _target: data.targetId, _option: data.optionId === "no_ride" ? "none" : data.optionId,
      _shown_cost: data.shownCost, _payload: payload, _key: data.key,
    });
    if (error) {
      if (/quote_changed/.test(error.message)) throw new Error("The price changed. Please look at the new price and choose again.");
      if (/invalid_choice/.test(error.message)) throw new Error("That choice isn't available any more. Please refresh.");
      throw new Error("Couldn't save your choice. Nothing was sent.");
    }
    return dec as { id: string; undo_until: string; option_id: string; status: string };
  });
export const commitDecision = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id, sendNow: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("commit_decision", { _id: data.id, _send_now: data.sendNow });
    fail(error); return { result: r as string };
  });
/** Returns the decision's real status: "cancelled", or "committed" if it was already sent. Throws if the server can't be reached. */
export const cancelDecision = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("cancel_decision", { _id: data.id });
    if (error) throw new Error("Couldn't reach Company to undo. Check your connection and try again.");
    return { status: r as string };
  });

// ---------- help ----------
export const sendHelp = createServerFn({ method: "POST" }).middleware([...auth]).handler(async ({ context }) => {
  const sb = context.supabase;
  await requireElder(sb, context.userId, "Only the person's own account can send a help alert.");
  const { data: me } = await sb.from("profiles").select("display_name, help_contact_consent, timezone").eq("id", context.userId).single();
  const { data: hh } = await sb.rpc("my_household");
  const fam = await familyName(sb);
  if (!me?.help_contact_consent) return { sent: false, reason: "consent" as const };
  if (!hh || !fam) return { sent: false, reason: "no_family" as const };
  const at = new Intl.DateTimeFormat("en-US", { timeZone: me.timezone, hour: "numeric", minute: "2-digit" }).format(new Date()).toLowerCase();
  const { error } = await sb.from("alerts").insert({ household_id: hh, user_id: context.userId, kind: "help", message: `${me.display_name || "Your family member"} pressed 'I need help' at ${at}.` });
  fail(error);
  await sb.from("activity").insert({ user_id: context.userId, agent: "family", text: `Help alert sent to ${fam} in Company.` });
  return { sent: true, to: fam };
});

// ---------- memory (the Memory keeper is the only writer) ----------
/** After Forget or a correction, remove any other copy: older activity lines quoting it, the active
 * check-in context, the setup interest it came from (fed to the model and suggestions), and a
 * friend's name on the person's plans and family updates. Decision payloads are server-owned and
 * not writable here; see the Lovable security request. */
async function scrubCopies(sb: any, userId: string, text: string) {
  const needle = text.replace(/[%_\\]/g, "").slice(0, 80);
  if (needle.length >= 3) fail((await sb.from("activity").delete().ilike("text", `%${needle}%`)).error);
  fail((await sb.from("checkins").delete().gte("created_at", "1970-01-01")).error);
  await scrubInterests(sb, userId, text);
  await scrubFriendNames(sb, userId, text);
}

async function scrubInterests(sb: any, userId: string, text: string) {
  const { data: me, error } = await sb.from("profiles").select("interests").eq("id", userId).maybeSingle();
  fail(error);
  const current: string[] = me?.interests ?? [];
  const kept = interestsWithout(current, text);
  if (kept.length !== current.length) fail((await sb.from("profiles").update({ interests: kept }).eq("id", userId)).error);
}

async function scrubFriendNames(sb: any, userId: string, text: string) {
  const { data: plans, error } = await sb.from("plans").select("id, friend_name").eq("user_id", userId).not("friend_name", "is", null);
  fail(error);
  const names = namesMentioned((plans ?? []).map((p: { friend_name: string | null }) => p.friend_name), text);
  if (names.length === 0) return;
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const planIds = (plans ?? []).filter((p: { friend_name: string | null }) => p.friend_name && lower.has(p.friend_name.trim().toLowerCase())).map((p: { id: string }) => p.id);
  fail((await sb.from("plans").update({ friend_name: null }).in("id", planIds)).error);
  const { data: ups, error: upErr } = await sb.from("updates").select("id, text").eq("user_id", userId);
  fail(upErr);
  for (const u of (ups ?? []) as { id: string; text: string }[]) {
    const redacted = names.reduce((t, n) => redactName(t, n), u.text);
    if (redacted !== u.text) fail((await sb.from("updates").update({ text: redacted }).eq("id", u.id)).error);
  }
}
export const listFacts = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("memory_facts").select("*").order("created_at");
  fail(error); return data ?? [];
});
const factText = z.string().trim().min(3).max(160).refine(safeText, "Company doesn't keep health, food or sleep details.");
export const saveFact = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["person", "like", "routine", "limit"]), text: factText, source: z.enum(["You said", "You agreed after a chat", "You agreed after an outing"]).default("You said") }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("memory_facts").insert({ user_id: context.userId, ...data });
    fail(error);
    await context.supabase.from("activity").insert({ user_id: context.userId, agent: "memory", text: "Memory: saved one thing you agreed to." });
    return { ok: true };
  });
export const correctFact = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id, text: factText }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase.from("memory_facts").select("text").eq("id", data.id).single();
    if (!f) throw new Error("Not found");
    const { error } = await context.supabase.from("memory_facts").update({ text: data.text, corrected_from: f.text, source: "You corrected", created_at: new Date().toISOString() }).eq("id", data.id);
    fail(error);
    await context.supabase.from("activity").insert({ user_id: context.userId, agent: "memory", text: "Memory: corrected one thing." });
    await scrubCopies(context.supabase, context.userId, f.text);
    return { ok: true };
  });
export const forgetFact = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase.from("memory_facts").select("text").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("memory_facts").delete().eq("id", data.id);
    fail(error);
    if (f) await scrubCopies(context.supabase, context.userId, f.text);
    await context.supabase.from("activity").insert({ user_id: context.userId, agent: "memory", text: "Memory: forgot one thing you asked me to." });
    return { ok: true };
  });

// ---------- household (older adult side) ----------
export const getHousehold = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("elder_household");
  fail(error); return (data as null | { household_id: string; members: { user_id: string; name: string; status: string; joined_at: string }[]; open_invites: number }) ?? null;
});
export const createInvite = createServerFn({ method: "POST" }).middleware([...auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("create_invitation");
  fail(error); return { code: data as string };
});
export const setMemberStatus = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ userId: id, status: z.enum(["active", "revoked"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_member_status", { _member: data.userId, _status: data.status });
    fail(error); return { ok: true };
  });
export const revokeInvites = createServerFn({ method: "POST" }).middleware([...auth]).handler(async ({ context }) => {
  const { error } = await context.supabase.rpc("revoke_invitations");
  fail(error); return { ok: true };
});

// ---------- family side ----------
export type FamilyHousehold = {
  household_id: string; elder_name: string; timezone: string; pace: "now" | "daily" | "weekly"; phone: string | null; queued: number;
  alerts: { id: string; kind: string; message: string; created_at: string; ack_at: string | null }[];
  requests: { id: string; kind: string; text: string; status: string; created_at: string; mine: boolean | null }[];
  updates: { id: string; category: string; text: string; created_at: string; period: string | null }[];
};
export const familyOverview = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("family_overview");
  fail(error); return (data as FamilyHousehold[]) ?? [];
});
export const acceptInvite = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ code: z.string().trim().min(10).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_invitation", { _code: data.code });
    if (error) throw new Error(/invalid_or_expired/.test(error.message) ? "That code isn't valid or has expired. Ask for a new one." : /family_account/.test(error.message) ? "Only a family account can accept an invitation." : "Couldn't accept the invitation.");
    return { ok: true };
  });
export const respondRequest = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id, accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("respond_request", { _id: data.id, _accept: data.accept });
    if (error) throw new Error("That request isn't available.");
    return { status: r as string };
  });
export const ackAlert = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("ack_alert", { _id: data.id });
    if (error) throw new Error("That alert isn't available.");
    return { ok: true };
  });
export const setPace = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ householdId: id, pace: z.enum(["now", "daily", "weekly"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_family_pace", { _hh: data.householdId, _pace: data.pace });
    fail(error); return { ok: true };
  });
export const leaveHousehold = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ householdId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("leave_household", { _hh: data.householdId });
    fail(error); return { ok: true };
  });

// ---------- privacy ----------
export const exportData = createServerFn({ method: "GET" }).middleware([...auth]).handler(async ({ context }) => {
  const sb = context.supabase;
  const tables = ["profiles", "plans", "errands", "reminders", "memory_facts", "checkins", "decisions", "activity", "requests", "updates", "alerts"] as const;
  const out: Record<string, {}[] | string> = { exported_at: new Date().toISOString() };
  for (const t of tables) out[t] = ((await sb.from(t).select("*")).data ?? []) as {}[];
  out["my_events"] = ((await sb.from("events").select("*").eq("owner_id", context.userId)).data ?? []) as {}[];
  return out;
});
export const deleteAccount = createServerFn({ method: "POST" }).middleware([...auth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("purge_my_data");
    fail(error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e2 } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    fail(e2);
    return { ok: true };
  });
