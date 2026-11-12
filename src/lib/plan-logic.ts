// Pure, shared rules for the real app. Costs, clashes and limits are computed here, never by the model.

export interface PlanLike {
  title: string; place: string; starts_at: string; ends_at: string; cost: number;
  ride_quote: number; pickup_at: string | null; status: string; ride_status: string; event_id?: string | null;
}
export interface ReminderLike { id: string; label: string; at_time: string }
export interface ChoiceOption {
  id: "family" | "own_way" | "no_ride" | "skip" | "not_now";
  label: string; cost: number; time: string; reason: string; overLimitBy: number; sends: boolean; primary?: boolean;
}

export function partsIn(iso: string, tz: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), hour: "numeric", minute: "2-digit", hourCycle: "h23", weekday: "long", day: "numeric", month: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value])) as Record<"hour" | "minute" | "weekday" | "day" | "month", string | undefined>;
  return { minutes: Number(p.hour) * 60 + Number(p.minute), weekday: p.weekday ?? "", day: p.day ?? "", month: p.month ?? "" };
}
export function safeTz(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}
export const fmtTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), hour: "numeric", minute: "2-digit" }).format(new Date(iso)).toLowerCase();
export const fmtDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), weekday: "long", day: "numeric", month: "short" }).format(new Date(iso));
export const fmtWhen = (p: { starts_at: string; ends_at: string }, tz: string) => `${fmtDay(p.starts_at, tz)}, ${fmtTime(p.starts_at, tz)} to ${fmtTime(p.ends_at, tz)}`;
export const money = (n: number) => (Number(n) === 0 ? "free" : `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const timeLabel = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
export const noTravelNeeded = (place: string) => /^(At home|Online or phone)$/i.test(place.trim());

/** Departure time: the saved pickup, else 30 minutes before the start. */
export function departureIso(plan: PlanLike) {
  if (noTravelNeeded(plan.place)) return plan.starts_at;
  return plan.pickup_at ?? new Date(new Date(plan.starts_at).getTime() - 30 * 60_000).toISOString();
}

/** A reminder clashes when it falls between departure and the end of the plan (overnight-aware). Propose 15 minutes before departure, on that date only. */
export function findClash(plan: PlanLike, reminders: ReminderLike[], tz: string) {
  const departure = departureIso(plan);
  const from = partsIn(departure, tz).minutes;
  const to = partsIn(plan.ends_at, tz).minutes;
  const days = localDayNumber(plan.ends_at, tz) - localDayNumber(departure, tz);
  for (const r of reminders) {
    const [h = 0, m = 0] = r.at_time.split(":").map(Number);
    const min = h * 60 + m;
    const clashes = days > 1 || (days === 1 ? min >= from || min < to : min >= from && min < to);
    if (clashes) return { reminder: r, to: hhmm((from - 15 + 1440) % 1440) };
  }
  return null;
}
export function localDayNumber(iso: string, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value])) as Record<string, string>;
  return Date.UTC(Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"])) / 86400000;
}

export const overLimit = (cost: number, limit: number) => Math.max(0, Math.round((Number(cost) - limit) * 100) / 100);

/** The one question for getting to a plan. Cheapest option first; ride services aren't connected, so they're never offered as bookable. */
export function rideQuestion(args: { plan: PlanLike; tz: string; rideLimit: number; familyName: string | null; reminders: ReminderLike[]; recovering: boolean; reason?: string }) {
  const { plan, tz, rideLimit, familyName, recovering } = args;
  const dep = fmtTime(departureIso(plan), tz);
  const clash = recovering ? null : findClash(plan, args.reminders, tz);
  if (!recovering && noTravelNeeded(plan.place)) return {
    text: `${plan.title}, ${fmtWhen(plan, tz)}. Does this plan look right? No travel is needed. Nothing has been booked or sent.`,
    options: [
      { id: "no_ride" as const, label: "Add to my week", cost: 0, time: "—", reason: "This saves your plan. It does not invite anyone or make a booking.", overLimitBy: 0, sends: true, primary: true },
      { id: "not_now" as const, label: "Not now", cost: 0, time: "—", reason: "You can review it later.", overLimitBy: 0, sends: false },
    ], clash: null,
  };
  const opts: ChoiceOption[] = [];
  if (familyName) opts.push({ id: "family", label: `Ask ${familyName}`, cost: 0, time: `Pickup ${dep}`, reason: `${familyName} gets a request and can say no.`, overLimitBy: 0, sends: true, primary: true });
  const q = Number(plan.ride_quote);
  opts.push({
    id: "own_way", label: q > 0 ? `I'll take a taxi, about ${money(q)}` : "I'll make my own way", cost: q, time: `Leave by ${dep}`,
    reason: q > 0 ? (overLimit(q, rideLimit) ? `Over your ${money(rideLimit)} ride limit by ${money(overLimit(q, rideLimit))}. Still your call.` : "You book and pay the driver yourself.") : "Walk, bus or a lift you arrange.",
    overLimitBy: overLimit(q, rideLimit), sends: true, primary: !familyName,
  });
  if (!recovering) opts.push({ id: "no_ride", label: "No ride needed", cost: 0, time: "—", reason: "It's close by or online.", overLimitBy: 0, sends: true });
  opts.sort((a, b) => a.cost - b.cost); // free choices always come before paid ones
  opts.push(recovering
    ? { id: "skip", label: "Skip it", cost: 0, time: "—", reason: "Nothing is sent.", overLimitBy: 0, sends: true }
    : { id: "not_now", label: "Not now", cost: 0, time: "—", reason: "Nothing is booked. It won't be suggested again this week.", overLimitBy: 0, sends: false });
  const head = recovering
    ? `${args.reason ?? "Your ride fell through."} How would you like to get to ${plan.title}?`
    : `${plan.title}, ${fmtWhen(plan, tz)}, ${plan.event_id === null ? "cost not verified" : money(plan.cost)}.${clash ? ` I'd move your ${timeLabel(clash.reminder.at_time)} reminder to ${timeLabel(clash.to)}.` : ""} How would you like to get there?`;
  return { text: head, options: opts, clash };
}

export function errandQuestion(item: string, familyName: string | null) {
  const opts: ChoiceOption[] = [];
  if (familyName) opts.push({ id: "family", label: `Ask ${familyName}`, cost: 0, time: "When they can", reason: `${familyName} gets a request and can say no.`, overLimitBy: 0, sends: true, primary: true });
  opts.push({ id: "own_way", label: "I'll get it myself", cost: 0, time: "—", reason: "Delivery services aren't connected yet.", overLimitBy: 0, sends: true, primary: !familyName });
  opts.push({ id: "not_now", label: "Not now", cost: 0, time: "—", reason: "Nothing is sent.", overLimitBy: 0, sends: false });
  return { text: `For the ${item}: ${familyName ? `ask ${familyName} to bring some, or get it yourself?` : "would you like to get it yourself?"}`, options: opts };
}

export type Chip = "planning" | "booking" | "waiting_joe" | "confirmed" | "not_covered" | "waiting_maya" | "covered_maya" | "covered_taxi" | "delivery_booked" | "skipped";
export function planChip(p: { status: string; ride_status: string }): { label: string; tone: "warn" | "ok" | "bad" | "muted" } {
  if (p.status === "skipped") return { label: "Skipped", tone: "muted" };
  if (p.status === "done") return { label: "Done", tone: "ok" };
  if (p.status === "planning") return { label: "Waiting for you", tone: "warn" };
  switch (p.ride_status) {
    case "waiting_family": return { label: "Waiting for family", tone: "warn" };
    case "covered_family": return { label: "Covered by family", tone: "ok" };
    case "own_way": return { label: "Making own way", tone: "ok" };
    case "not_needed": return { label: "Going", tone: "ok" };
    case "not_covered": return { label: "Not covered", tone: "bad" };
    default: return { label: "Going", tone: "ok" };
  }
}
export function errandChip(status: string): { label: string; tone: "warn" | "ok" | "bad" | "muted" } {
  return ({
    waiting_elder: { label: "Waiting for you", tone: "warn" }, waiting_family: { label: "Waiting for family", tone: "warn" },
    covered_family: { label: "Covered by family", tone: "ok" }, own_way: { label: "Getting it yourself", tone: "ok" },
    skipped: { label: "Skipped", tone: "muted" }, done: { label: "Done", tone: "ok" },
  } as const)[status as "done"] ?? { label: status, tone: "muted" };
}

/** Keyword fallback when the live service doesn't answer. Negation-aware: "I don't want jazz" proposes nothing. */
export function keywordMatch(words: string, events: { id: string; title: string; tags: string[] }[]) {
  const clauses = words.toLowerCase().replace(/’/g, "'").split(/[.!?;,]|\b(?:but|however|instead|and)\b/);
  const affirmative = clauses.filter((c) => !/\b(?:don'?t|do not|not|no|never|skip|without|decline|avoid|can'?t|cannot)\b/.test(c));
  const contains = (clause: string, term: string) => {
    const escaped = term.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !!escaped && new RegExp(`\\b${escaped}\\b`).test(clause);
  };
  const eventIds = events.filter((e) => affirmative.some((c) => e.tags.some((t) => contains(c, t)) || contains(c, e.title))).slice(0, 3).map((e) => e.id);
  const needs: string[] = [];
  for (const clause of affirmative) {
    const re = /\b(?:out of|run out of|ran out of|needs?(?:\s+(?:some|more))?|low on|buy)\s+([a-z][a-z ]{1,24}?)\s*$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clause.trim())) && needs.length < 2) {
      const item = m[1]!.trim();
      if (item && !/^(a|an|the|help|to)$/.test(item) && !needs.includes(item)) needs.push(item);
    }
    if (needs.length >= 2) break;
  }
  return { eventIds, needs };
}
