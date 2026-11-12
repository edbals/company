import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createErrand, createPlan, declineSuggestion, getHome, setFewer } from "@/lib/app.functions";
import { errandChip, fmtTime, fmtWhen, planChip, timeLabel } from "@/lib/plan-logic";
import { btn, Chip, Empty, ErrorBox, input, Loading } from "@/components/app/kit";
import { PersonalPlanForm } from "@/components/app/PersonalPlanForm";

export const Route = createFileRoute("/_authenticated/app/")({ component: Home });

function Home() {
  const fetchHome = useServerFn(getHome);
  const q = useQuery({ queryKey: ["home"], queryFn: () => fetchHome(), refetchInterval: 20_000 });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const plan = useServerFn(createPlan);
  const decline = useServerFn(declineSuggestion);
  const fewer = useServerFn(setFewer);
  const errand = useServerFn(createErrand);
  const [askFewer, setAskFewer] = useState(false);
  const [item, setItem] = useState("");
  const [addingPersonal, setAddingPersonal] = useState(false);

  if (q.isLoading) return <Loading what="Getting your week" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const { profile, plans, errands, reminders, activity, suggestions, familyName } = q.data;
  const tz = profile.timezone;
  const first = profile.display_name.split(" ")[0];
  const needs = plans.filter((p) => p.status === "planning" || p.ride_status === "not_covered");
  const week = plans.filter((p) => !needs.includes(p));
  const joined = plans.some((p) => p.ride_status === "covered_family") && errands.find((e) => e.status === "covered_family");
  const recentFamily = activity.find((a) => a.agent === "family" && Date.now() - new Date(a.created_at).getTime() < 864e5);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h1 className="font-display text-[32px] leading-tight">Hello, {first}.</h1>
        <Link to="/app/talk" className={btn.primary}>Talk to Company</Link>
        <button className={btn.secondary} onClick={() => setAddingPersonal((value) => !value)}>{addingPersonal ? "Close personal plan" : "Start a personal plan"}</button>
        {addingPersonal && <PersonalPlanForm onCancel={() => setAddingPersonal(false)} />}
      </section>

      {joined && <p role="status" className="rounded-2xl border border-accent/60 bg-accent-soft p-4 font-bold">{familyName} is driving you and bringing the {joined.item} too.</p>}
      {!joined && recentFamily && <p role="status" className="rounded-2xl border border-accent/60 bg-accent-soft p-4">{recentFamily.text}</p>}

      {needs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[19px] font-bold uppercase tracking-wider text-agent-coordinator">Needs your answer</h2>
          {needs.map((p) => (
            <Link key={p.id} to="/app/plans/$planId" params={{ planId: p.id }} className={`card-soft block p-4 ${p.ride_status === "not_covered" ? "border-destructive/50" : ""}`}>
              <div className="flex items-start justify-between gap-2"><span className="font-display text-[25px] leading-tight">{p.title}</span><Chip tone={planChip(p).tone}>{planChip(p).label}</Chip></div>
              <p className="text-[19px] text-muted-foreground">{p.ride_status === "not_covered" ? "Your ride fell through. Review your options." : fmtWhen(p, tz)}</p>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[28px]">This week</h2>
        {week.length === 0 && errands.length === 0 && <Empty>Nothing is planned yet. What would make this week feel good?</Empty>}
        {week.map((p) => (
          <Link key={p.id} to="/app/plans/$planId" params={{ planId: p.id }} className="card-soft block p-4">
            <div className="flex items-start justify-between gap-2"><span className="font-display text-[25px] leading-tight">{p.title}</span><Chip tone={planChip(p).tone}>{planChip(p).label}</Chip></div>
            <p className="text-[19px] text-muted-foreground">{fmtWhen(p, tz)}{p.place ? ` · ${p.place}` : ""}</p>
          </Link>
        ))}
        {errands.map((e) => (
          <Link key={e.id} to="/app/errands/$errandId" params={{ errandId: e.id }} className="card-soft flex items-center justify-between gap-2 p-4">
            <span className="font-display text-[25px] capitalize">{e.item}</span><Chip tone={errandChip(e.status).tone}>{errandChip(e.status).label}</Chip>
          </Link>
        ))}
        <form className="flex gap-2" onSubmit={async (ev) => { ev.preventDefault(); if (!item.trim()) return; try { const r = await errand({ data: { item, need_by: null } }); setItem(""); navigate({ to: "/app/errands/$errandId", params: { errandId: r.id } }); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't add"); } }}>
          <label htmlFor="need" className="sr-only">Something you need</label>
          <input id="need" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Something you need, like milk" className={input} maxLength={60} />
          <button className="tap shrink-0 rounded-2xl bg-secondary px-5 text-[19px] font-bold">Add</button>
        </form>
      </section>

      {reminders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[19px] font-bold uppercase tracking-wider text-muted-foreground">Your reminders</h2>
          <ul className="space-y-1">{reminders.map((r) => <li key={r.id}>{timeLabel(r.at_time)} · {r.label}{r.moved_from ? ` (moved from ${timeLabel(r.moved_from)})` : ""}</li>)}</ul>
        </section>
      )}

      {askFewer && (
        <section className="card-soft space-y-3 p-4" aria-live="polite">
          <h2 className="font-display text-[26px]">Would you like fewer suggestions?</h2>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.primary} onClick={async () => { await fewer({ data: { value: true } }); setAskFewer(false); qc.invalidateQueries({ queryKey: ["home"] }); }}>Yes, fewer</button>
            <button className={btn.secondary} onClick={async () => { await fewer({ data: { value: false } }); setAskFewer(false); }}>No, keep them</button>
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[19px] font-bold uppercase tracking-wider text-muted-foreground">Ideas for you</h2>
          {suggestions.map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-secondary p-4">
              <h3 className="font-display text-[24px]">{s.title}</h3>
              <p className="text-[19px]">{fmtWhen(s, tz)} · {s.place}{Number(s.cost) ? ` · $${s.cost}` : " · free"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="tap rounded-xl border-2 border-primary/20 bg-card text-[19px] font-bold" onClick={async () => { const r = await plan({ data: { eventId: s.id } }); navigate({ to: "/app/plans/$planId", params: { planId: r.id } }); }}>Plan it</button>
                <button className="tap rounded-xl text-[19px] font-bold text-muted-foreground" onClick={async () => { const r = await decline({ data: { eventId: s.id } }); if (r.askFewer) setAskFewer(true); qc.invalidateQueries({ queryKey: ["home"] }); }}>Not this week</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {activity.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[19px] font-bold uppercase tracking-wider text-muted-foreground">What happened lately</h2>
          <ol className="space-y-1 text-[18px]">{activity.slice(0, 6).map((a) => <li key={a.id}><span className="text-muted-foreground">{fmtTime(a.created_at, tz)}</span> · {a.text}</li>)}</ol>
        </section>
      )}
    </div>
  );
}
