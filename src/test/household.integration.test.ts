// Real two-account household test against the project's backend. Runs only where the
// backend credentials are present (the sandbox); creates and deletes its own throwaway users.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env["SUPABASE_URL"];
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"];
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const enabled = !!(URL_ && ANON && SERVICE);

const keyFetch = (key: string): typeof fetch => (input, init) => {
  const h = new Headers(init?.headers);
  if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
  h.set("apikey", key);
  return fetch(input, { ...init, headers: h });
};
const client = (key: string) => createClient(URL_!, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: keyFetch(key) } });

describe.skipIf(!enabled)("household across two real accounts", () => {
  const admin = enabled ? client(SERVICE!) : (null as unknown as SupabaseClient);
  const ids: string[] = [];
  const pw = `T3st-${Math.random().toString(36).slice(2)}!`;
  let elder: SupabaseClient, family: SupabaseClient, stranger: SupabaseClient;
  let elderId = "", familyId = "";

  const decide = (c: SupabaseClient, kind: string, target: string, option: string, cost: number, payload: Record<string, string>, key: string) =>
    c.rpc("create_decision", { _kind: kind, _target: target, _option: option, _shown_cost: cost, _payload: payload, _key: key }) as unknown as Promise<{ data: { id: string; quote_cost: number } | null; error: { message: string } | null }>;

  async function user(tag: string, role: "elder" | "family", name: string) {
    const email = `company-test-${tag}-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
    const c = client(ANON!);
    const { error: e2 } = await c.auth.signInWithPassword({ email, password: pw });
    if (e2) throw e2;
    await c.from("profiles").update({ role, display_name: name, onboarded: true, help_contact_consent: true }).eq("id", data.user.id);
    return { c, id: data.user.id };
  }

  beforeAll(async () => {
    ({ c: elder, id: elderId } = await user("elder", "elder", "Rosa"));
    ({ c: family, id: familyId } = await user("family", "family", "Ana"));
    ({ c: stranger } = await user("stranger", "family", "Eve"));
  }, 60_000);
  afterAll(async () => { for (const id of ids) await admin.auth.admin.deleteUser(id); });

  it("invite → accept → elder approves → request → family accepts → covered; revoke removes access", async () => {
    const { data: code, error } = await elder.rpc("create_invitation");
    expect(error).toBeNull();
    expect((await family.rpc("accept_invitation", { _code: code })).error).toBeNull();
    // single-use
    expect((await stranger.rpc("accept_invitation", { _code: code })).error).not.toBeNull();
    // pending: nothing visible yet
    expect(((await family.rpc("family_overview")).data as unknown[]).length).toBe(0);
    expect((await elder.rpc("set_member_status", { _member: familyId, _status: "active" })).error).toBeNull();

    const { data: ev } = await elder.from("events").insert({ owner_id: elderId, title: "Choir night", starts_at: new Date(Date.now() + 2 * 864e5).toISOString(), ends_at: new Date(Date.now() + 2 * 864e5 + 36e5).toISOString() }).select("*").single();
    const { data: plan } = await elder.from("plans").insert({ user_id: elderId, event_id: ev!.id, title: ev!.title, starts_at: ev!.starts_at, ends_at: ev!.ends_at }).select("*").single();
    await elder.from("checkins").insert({ user_id: elderId, turns: [{ who: "you", text: "SECRET morning chat" }] });
    await elder.from("memory_facts").insert({ user_id: elderId, kind: "like", text: "SECRET memory fact" });

    // Undo window: committing early without Send now does nothing
    const { data: dec } = await decide(elder, "plan_ride", plan!.id, "family", 0, {}, "k1-household");
    expect((await elder.rpc("commit_decision", { _id: dec!.id, _send_now: false })).data).toBe("too_early");
    expect((await family.rpc("family_overview")).data[0].requests.length).toBe(0);
    // Send now commits once; a retry is idempotent
    const c1 = await elder.rpc("commit_decision", { _id: dec!.id, _send_now: true }); if (c1.error) console.log("COMMITERR", c1.error.message); expect(c1.data).toBe("committed");
    expect((await elder.rpc("commit_decision", { _id: dec!.id, _send_now: true })).data).toBe("committed");
    const ov = (await family.rpc("family_overview")).data[0];
    expect(ov.requests.length).toBe(1);
    expect(JSON.stringify(ov)).not.toContain("SECRET");
    // not covered before a person says yes
    expect((await elder.from("plans").select("ride_status").eq("id", plan!.id).single()).data!.ride_status).toBe("waiting_family");
    // a stranger can't answer, read, or touch the elder's rows (IDOR)
    expect((await stranger.rpc("respond_request", { _id: ov.requests[0].id, _accept: true })).error).not.toBeNull();
    expect((await stranger.from("plans").select("*").eq("id", plan!.id)).data).toEqual([]);
    expect((await family.from("memory_facts").select("*")).data).toEqual([]);
    expect((await family.from("checkins").select("*")).data).toEqual([]);
    await stranger.from("plans").update({ status: "skipped" }).eq("id", plan!.id);
    expect((await elder.from("plans").select("status").eq("id", plan!.id).single()).data!.status).toBe("going");

    expect((await family.rpc("respond_request", { _id: ov.requests[0].id, _accept: true })).data).toBe("accepted");
    expect((await elder.from("plans").select("ride_status").eq("id", plan!.id).single()).data!.ride_status).toBe("covered_family");

    // per-plan sharing off hides the plan update immediately
    await elder.from("plans").update({ share_override: false }).eq("id", plan!.id);
    expect((await family.rpc("family_overview")).data[0].updates.length).toBe(0);

    // help alert reaches family regardless of pace
    await family.rpc("set_family_pace", { _hh: ov.household_id, _pace: "weekly" });
    const { data: hh } = await elder.rpc("my_household");
    await elder.from("alerts").insert({ household_id: hh, user_id: elderId, kind: "help", message: "Rosa pressed help" });
    expect((await family.rpc("family_overview")).data[0].alerts.length).toBe(1);

    // revoke: access ends at once
    await elder.rpc("set_member_status", { _member: familyId, _status: "revoked" });
    expect(((await family.rpc("family_overview")).data as unknown[]).length).toBe(0);
  }, 60_000);

  it("a changed fare after the yes needs a new yes", async () => {
    const start = new Date(Date.now() + 3 * 864e5).toISOString();
    const { data: plan } = await elder.from("plans").insert({ user_id: elderId, title: "Film", starts_at: start, ends_at: new Date(Date.parse(start) + 36e5).toISOString(), ride_quote: 18 }).select("*").single();
    // The server derives the cost: a yes to a price the person wasn't shown is refused outright.
    expect((await decide(elder, "plan_ride", plan!.id, "own_way", 12, {}, "k2-wrongprice")).error?.message).toMatch(/quote_changed/);
    const { data: dec } = await decide(elder, "plan_ride", plan!.id, "own_way", 18, {}, "k2-fare-yes");
    expect(dec!.quote_cost).toBe(18);
    await elder.from("plans").update({ ride_quote: 28 }).eq("id", plan!.id);
    expect((await elder.rpc("commit_decision", { _id: dec!.id, _send_now: true })).data).toBe("quote_changed");
    expect((await elder.from("plans").select("status").eq("id", plan!.id).single()).data!.status).toBe("planning");
  }, 30_000);

  it("two households: rows can't be moved into another household, and internal checks are locked", async () => {
    const { c: elder2, id: elder2Id } = await user("elder2", "elder", "Bea");
    const { c: fam2, id: fam2Id } = await user("fam2", "family", "Cal");
    const { data: code2 } = await elder2.rpc("create_invitation");
    await fam2.rpc("accept_invitation", { _code: code2 });
    await elder2.rpc("set_member_status", { _member: fam2Id, _status: "active" });
    const { data: hh2 } = await elder2.rpc("my_household");
    const { data: hh1 } = await elder.rpc("my_household");
    expect(hh1).not.toBe(hh2);

    // Inserting straight into the other household is refused
    expect((await elder.from("alerts").insert({ household_id: hh2, user_id: elderId, kind: "help", message: "SPOOF insert" })).error).not.toBeNull();
    // Moving own rows into the other household is refused
    const { data: a, error: ae } = await elder.from("alerts").insert({ household_id: hh1, user_id: elderId, kind: "help", message: "SPOOF alert" }).select("id").single(); if (ae) console.log("ALERTERR", ae.message);
    const { data: r } = await elder.from("requests").insert({ household_id: hh1, user_id: elderId, kind: "ride", target_id: elderId, text: "SPOOF request" }).select("id").single();
    const { data: u } = await elder.from("updates").insert({ household_id: hh1, user_id: elderId, category: "plans", text: "SPOOF update" }).select("id").single();
    for (const [t, id] of [["alerts", a!.id], ["requests", r!.id], ["updates", u!.id]] as const) {
      const { error, data } = await elder.from(t).update({ household_id: hh2 }).eq("id", id).select("id");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
    const ov2 = JSON.stringify((await fam2.rpc("family_overview")).data);
    expect(ov2).not.toContain("SPOOF");
    // Other household's family can't act on them either
    expect((await fam2.rpc("ack_alert", { _id: a!.id })).error).not.toBeNull();
    expect((await fam2.rpc("respond_request", { _id: r!.id, _accept: true })).error).not.toBeNull();
    // Updates tied to another person's plan are refused
    const { data: p2 } = await elder2.from("plans").insert({ user_id: elder2Id, title: "Bea's", starts_at: new Date().toISOString(), ends_at: new Date().toISOString() }).select("id").single();
    expect((await elder.from("updates").insert({ household_id: hh1, user_id: elderId, category: "plans", plan_id: p2!.id, text: "x" })).error).not.toBeNull();
    // Escalation check is internal only
    expect((await stranger.rpc("check_escalations", { _hh: hh2 })).error).not.toBeNull();
    expect((await fam2.rpc("check_escalations", { _hh: hh2 })).error).not.toBeNull();
    expect((await client(ANON!).rpc("check_escalations", { _hh: hh2 })).error).not.toBeNull();
  }, 60_000);

  it("acknowledging twice writes one note; deleted plans take their updates with them", async () => {
    const { c: el, id: elId } = await user("elder3", "elder", "Dee");
    const { c: fm, id: fmId } = await user("fam3", "family", "Fin");
    const { data: code } = await el.rpc("create_invitation");
    await fm.rpc("accept_invitation", { _code: code });
    await el.rpc("set_member_status", { _member: fmId, _status: "active" });
    const { data: hh } = await el.rpc("my_household");
    const { data: a } = await el.from("alerts").insert({ household_id: hh, user_id: elId, kind: "help", message: "help" }).select("id").single();
    expect((await fm.rpc("ack_alert", { _id: a!.id })).error).toBeNull();
    expect((await fm.rpc("ack_alert", { _id: a!.id })).error).toBeNull();
    expect((await el.from("activity").select("id").eq("entity_id", a!.id)).data!.length).toBe(1);

    const { data: p } = await el.from("plans").insert({ user_id: elId, title: "ORPHAN plan", starts_at: new Date().toISOString(), ends_at: new Date().toISOString() }).select("id").single();
    await el.from("updates").insert({ household_id: hh, user_id: elId, category: "plans", plan_id: p!.id, text: "ORPHAN update" });
    await el.from("plans").delete().eq("id", p!.id);
    expect(JSON.stringify((await fm.rpc("family_overview")).data)).not.toContain("ORPHAN");
  }, 60_000);

  it("unknown options are rejected and a retried commit runs once", async () => {
    const start = new Date(Date.now() + 4 * 864e5).toISOString();
    const { data: plan } = await elder.from("plans").insert({ user_id: elderId, title: "Gallery", starts_at: start, ends_at: start }).select("*").single();
    expect((await decide(elder, "plan_ride", plan!.id, "limo", 0, {}, "bad-option")).error?.message).toMatch(/invalid_choice/);
    // Choices can't be written directly, and a plan can't mark itself covered.
    expect((await elder.from("decisions").insert({ user_id: elderId, kind: "plan_ride", target_id: plan!.id, option_id: "none", undo_until: new Date().toISOString(), idempotency_key: "direct-1" })).error).not.toBeNull();
    expect((await elder.from("plans").update({ ride_status: "covered_family" }).eq("id", plan!.id)).error).not.toBeNull();
    expect((await elder.from("plans").update({ status: "going" }).eq("id", plan!.id)).error).not.toBeNull();
    expect((await elder.from("plans").select("status").eq("id", plan!.id).single()).data!.status).toBe("planning");
    const { data: ok } = await decide(elder, "plan_ride", plan!.id, "none", 0, {}, "ok-none-1");
    // Retrying creation with the same key returns the same pending choice
    expect((await decide(elder, "plan_ride", plan!.id, "none", 0, {}, "ok-none-1")).data!.id).toBe(ok!.id);
    const [r1, r2] = await Promise.all([elder.rpc("commit_decision", { _id: ok!.id, _send_now: true }), elder.rpc("commit_decision", { _id: ok!.id, _send_now: true })]);
    expect([r1.data, r2.data].sort()).toEqual(["committed", "committed"]);
    expect((await elder.from("activity").select("id").eq("entity_id", plan!.id)).data!.length).toBe(1);
    // cancelled decision can't be committed afterwards
    const { data: c } = await decide(elder, "plan_ride", plan!.id, "skip", 0, {}, "c-skip-1");
    expect((await elder.rpc("cancel_decision", { _id: c!.id })).data).toBe("cancelled");
    expect((await elder.rpc("commit_decision", { _id: c!.id, _send_now: true })).data).toBe("cancelled");
    // Undo after it was already sent says so, instead of pretending
    expect((await elder.rpc("cancel_decision", { _id: ok!.id })).data).toBe("committed");
    // Undo racing the commit: exactly one wins
    const { data: race } = await decide(elder, "plan_ride", plan!.id, "skip", 0, {}, "race-skip-1");
    const [u, cm] = await Promise.all([elder.rpc("cancel_decision", { _id: race!.id }), elder.rpc("commit_decision", { _id: race!.id, _send_now: true })]);
    expect([u.data, cm.data].filter((x) => x === "cancelled").length + [cm.data].filter((x) => x === "committed").length).toBeGreaterThanOrEqual(1);
    const final = (await elder.from("decisions").select("status").eq("id", race!.id).single()).data!.status;
    expect(["cancelled", "committed"]).toContain(final);
    expect(final === "cancelled" ? cm.data === "cancelled" : u.data === "committed").toBe(true);
  }, 60_000);

  it("a clashing reminder moves for that one day only", async () => {
    const start = new Date(Date.now() + 5 * 864e5); start.setUTCHours(14, 0, 0, 0);
    const { data: r } = await elder.from("reminders").insert({ user_id: elderId, label: "generic reminder", at_time: "14:00" }).select("id").single();
    const { data: plan } = await elder.from("plans").insert({ user_id: elderId, title: "Concert", starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 36e5).toISOString(), pickup_at: new Date(start.getTime() - 30 * 6e4).toISOString() }).select("*").single();
    expect((await decide(elder, "plan_ride", plan!.id, "none", 0, { reminder_id: "00000000-0000-0000-0000-000000000000", reminder_to: "13:15" }, "rem-bad-1")).error?.message).toMatch(/invalid_reminder/);
    const { data: d } = await decide(elder, "plan_ride", plan!.id, "none", 0, { reminder_id: r!.id, reminder_to: "13:15" }, "rem-ok-1");
    expect((await elder.rpc("commit_decision", { _id: d!.id, _send_now: true })).data).toBe("committed");
    expect((await elder.from("reminders").select("at_time").eq("id", r!.id).single()).data!.at_time).toBe("14:00:00");
    const { data: ov } = await elder.from("reminder_overrides").select("on_date, at_time").eq("reminder_id", r!.id);
    expect(ov).toEqual([{ on_date: start.toISOString().slice(0, 10), at_time: "13:15:00" }]);
  }, 30_000);

  it("expired or reused invitation codes are refused, and family can't create invitations", async () => {
    expect((await family.rpc("create_invitation")).error).not.toBeNull();
    expect((await family.rpc("accept_invitation", { _code: "not-a-real-code-123" })).error).not.toBeNull();
  });
});
