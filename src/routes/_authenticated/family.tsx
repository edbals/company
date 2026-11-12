import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { acceptInvite, ackAlert, familyOverview, getMe, leaveHousehold, respondRequest, setPace, type FamilyHousehold } from "@/lib/app.functions";
import { btn, Empty, ErrorBox, input, Loading, OfflineBanner, useSignOut } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/family")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me?.onboarded) throw redirect({ to: "/onboarding" });
    if (me.role !== "family") throw redirect({ to: "/app" });
    return { me };
  },
  head: () => ({ meta: [{ title: "Family — Company" }, { name: "description", content: "What your family member chose to share." }] }),
  component: Family,
});

const when = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

function Family() {
  const { me } = Route.useRouteContext();
  const fetchOverview = useServerFn(familyOverview);
  const q = useQuery({ queryKey: ["family"], queryFn: () => fetchOverview(), refetchInterval: 10_000 });
  const signOut = useSignOut();
  return (
    <div className="min-h-dvh bg-stage">
      <OfflineBanner />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <img src="/company-logo.svg" alt="Company" className="h-8 w-auto" />
          <div className="flex items-center gap-4 text-[17px]"><span className="text-muted-foreground">{me.display_name}</span><button className="font-bold underline-offset-4 hover:underline" onClick={signOut}>Sign out</button></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8 text-[19px]">
        {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
          <>
            {(q.data ?? []).length === 0 && <Empty>You're not linked to anyone yet. Ask them for an invitation code.</Empty>}
            {(q.data ?? []).map((h) => <HouseholdView key={h.household_id} h={h} />)}
            <JoinBox />
          </>
        )}
      </main>
    </div>
  );
}

function HouseholdView({ h }: { h: FamilyHousehold }) {
  const qc = useQueryClient();
  const respond = useServerFn(respondRequest);
  const ack = useServerFn(ackAlert);
  const pace = useServerFn(setPace);
  const leave = useServerFn(leaveHousehold);
  const refresh = () => qc.invalidateQueries({ queryKey: ["family"] });
  const name = h.elder_name || "Your family member";
  const open = h.requests.filter((r) => r.status === "sent");
  const past = h.requests.filter((r) => r.status !== "sent").slice(0, 6);
  const groups = new Map<string, typeof h.updates>();
  for (const u of h.updates) { const k = u.period ?? ""; groups.set(k, [...(groups.get(k) ?? []), u]); }
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[16px] font-bold uppercase tracking-wider text-agent-family">{name}</p>
          <h1 className="font-display text-[36px] leading-tight">What {name} chose to share</h1>
        </div>
        <div role="radiogroup" aria-label="How often you hear" className="grid grid-cols-3 rounded-full bg-muted p-1">
          {([["now", "Right away"], ["daily", "Daily"], ["weekly", "Weekly"]] as const).map(([p, l]) => (
            <button key={p} role="radio" aria-checked={h.pace === p} onClick={async () => { await pace({ data: { householdId: h.household_id, pace: p } }); refresh(); }}
              className={cn("min-h-11 rounded-full px-4 text-[16px] font-bold", h.pace === p ? "bg-card shadow-soft" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
      </div>

      {h.alerts.map((a) => (
        <article key={a.id} role="alert" className={cn("rounded-2xl border-2 p-5", a.ack_at ? "border-border bg-card" : "border-destructive bg-alert-soft")}>
          <p className="text-[15px] font-bold uppercase tracking-wider text-destructive">{a.kind === "help" ? "I need help" : "Plan fell through"} · {when(a.created_at, h.timezone)}</p>
          <p className="mt-1 text-[22px] font-bold">{a.message}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {h.phone && <a href={`tel:${h.phone.replace(/[^+0-9]/g, "")}`} className="tap inline-flex items-center gap-2 rounded-xl bg-destructive px-5 text-[19px] font-bold text-destructive-foreground"><Phone className="size-5" aria-hidden />Call {name}</a>}
            {!a.ack_at ? <button className="tap rounded-xl border-2 border-primary/30 bg-card px-5 text-[19px] font-bold" onClick={async () => { await ack({ data: { id: a.id } }); refresh(); }}>I've seen this</button> : <span className="self-center text-muted-foreground">Seen</span>}
          </div>
          {!h.phone && <p className="mt-2 text-[16px] text-muted-foreground">{name} hasn't shared a phone number with Company.</p>}
        </article>
      ))}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h2 className="font-display text-[26px]">Requests</h2>
          {open.length === 0 && <Empty>No requests right now.</Empty>}
          {open.map((r) => (
            <article key={r.id} className="card-soft space-y-3 p-5">
              <p className="text-[15px] font-bold uppercase tracking-wider text-agent-family">{r.kind === "ride" ? "Ride" : "Errand"} · {when(r.created_at, h.timezone)}</p>
              <p className="text-[20px]">{r.text}</p>
              <div className="grid grid-cols-2 gap-2">
                <button className={btn.primary} onClick={async () => { try { await respond({ data: { id: r.id, accept: true } }); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } }}>Yes, I can</button>
                <button className={btn.secondary} onClick={async () => { await respond({ data: { id: r.id, accept: false } }); refresh(); }}>Can't this time</button>
              </div>
            </article>
          ))}
          {past.map((r) => <p key={r.id} className="rounded-xl border border-border px-4 py-2 text-[17px] text-muted-foreground">{r.text.slice(0, 70)}… — {r.status === "accepted" ? (r.mine ? "you said yes" : "accepted") : r.status === "declined" ? "declined" : "withdrawn"}</p>)}
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-[26px]">Updates</h2>
          {h.queued > 0 && <p className="rounded-xl bg-muted px-4 py-3 text-[17px] text-muted-foreground">{h.queued} update{h.queued > 1 ? "s" : ""} waiting for your {h.pace === "daily" ? "daily" : "weekly"} summary.</p>}
          {h.updates.length === 0 && <Empty>Nothing new from {name} yet.</Empty>}
          {[...groups.entries()].map(([period, items]) => (
            <article key={period || "now"} className="card-soft p-5">
              {period && <p className="mb-2 text-[15px] font-bold uppercase tracking-wider text-muted-foreground">{h.pace === "daily" ? "Daily summary" : "Weekly"} · {period}</p>}
              <ul className="space-y-2">{items.map((u) => <li key={u.id}>{u.text} {!period && <span className="text-[15px] text-muted-foreground">· {when(u.created_at, h.timezone)}</span>}</li>)}</ul>
            </article>
          ))}
        </div>
      </div>
      <p className="text-[16px] text-muted-foreground">You can answer requests. You can't book or change {name}'s plans, and you never see their chats or what Company remembers.</p>
      <button className={btn.ghost} onClick={async () => { if (!confirm(`Stop following ${name}?`)) return; await leave({ data: { householdId: h.household_id } }); refresh(); }}>Leave this household</button>
    </section>
  );
}

function JoinBox() {
  const accept = useServerFn(acceptInvite);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="card-soft max-w-xl space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); try { await accept({ data: { code } }); setMsg("Sent. They'll need to say yes before you see anything."); setCode(""); qc.invalidateQueries({ queryKey: ["family"] }); } catch (er) { setMsg(er instanceof Error ? er.message : "Couldn't join"); } }}>
      <h2 className="font-display text-[24px]">Have an invitation code?</h2>
      <label htmlFor="code" className="sr-only">Invitation code</label>
      <input id="code" value={code} onChange={(e) => setCode(e.target.value)} className={input} placeholder="Paste the code" />
      <button className={btn.primary} disabled={code.trim().length < 10}>Join</button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
