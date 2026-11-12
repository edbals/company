import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { declineSuggestion, getPlan, markOutcome, rideFellThrough, saveFact, updatePlan } from "@/lib/app.functions";
import { fmtTime, fmtWhen, noTravelNeeded, planChip, rideQuestion, type PlanLike } from "@/lib/plan-logic";
import { DecisionQuestion } from "@/components/app/DecisionQuestion";
import { btn, Chip, ErrorBox, input, label, Loading, Toggle } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/plans/$planId")({ component: PlanPage });

function PlanPage() {
  const { planId } = Route.useParams();
  const fetchPlan = useServerFn(getPlan);
  const q = useQuery({ queryKey: ["plan", planId], queryFn: () => fetchPlan({ data: { id: planId } }), refetchInterval: 15_000 });
  const qc = useQueryClient();
  const update = useServerFn(updatePlan);
  const fell = useServerFn(rideFellThrough);
  const outcome = useServerFn(markOutcome);
  const decline = useServerFn(declineSuggestion);
  const keep = useServerFn(saveFact);
  const [friend, setFriend] = useState("");
  const [fare, setFare] = useState("");
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["plan", planId] }); qc.invalidateQueries({ queryKey: ["home"] }); };

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const { plan, log, reminders, profile, pending, familyName } = q.data;
  const tz = profile.timezone;
  const p = plan as PlanLike & typeof plan;
  const chip = planChip(plan);
  const recovering = plan.ride_status === "not_covered";
  const noTravel = noTravelNeeded(plan.place);
  const asking = plan.status === "planning" || recovering;
  const rq = rideQuestion({ plan: p, tz, rideLimit: profile.ride_limit, familyName, reminders, recovering });
  const isPast = new Date(plan.ends_at).getTime() < Date.now();

  return (
    <div className="space-y-6">
      <Link to="/app" className="text-[18px] font-bold text-muted-foreground">← This week</Link>
      {recovering && <p role="alert" className="rounded-2xl bg-alert-soft p-4 font-bold text-destructive">Your ride fell through. Review the available choices below.</p>}
      {asking ? (
        <DecisionQuestion
          key={`${plan.status}-${plan.ride_status}-${plan.ride_quote}`}
          kind={recovering ? "recover" : "plan_ride"} targetId={plan.id} text={rq.text} options={rq.options} rideLimit={profile.ride_limit}
          initialPending={pending ? { id: pending.id, undo_until: pending.undo_until, option_id: pending.option_id } : null}
          payloadFor={() => ({ ...(friend.trim() && !recovering ? { friend: friend.trim() } : {}), ...(rq.clash ? { moveReminder: true } : {}) })}
          onNotNow={async () => { if (plan.event_id) { const r = await decline({ data: { eventId: plan.event_id } }); if (r.askFewer) toast("You've said no twice. You can ask for fewer suggestions on Home."); } await update({ data: { id: plan.id, skip: true } }); toast("Okay. It won't be suggested again this week."); refresh(); history.back(); }}
          onDone={() => refresh()}
          extra={
            <div className="space-y-3">
              {!recovering && (
                <div><label className={label} htmlFor="friend">Who might join you? (optional; Company won't invite them)</label>
                  <input id="friend" value={friend} onChange={(e) => setFriend(e.target.value)} placeholder="Their name" className={input} maxLength={40} /></div>
              )}
              {!noTravel && <details className="rounded-2xl border border-border bg-card p-3">
                <summary className="cursor-pointer text-[18px] font-bold">Know a taxi fare? Add it</summary>
                <div className="mt-2 flex gap-2">
                  <input aria-label="Taxi fare in dollars" inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="e.g. 18" className={input} />
                  <button className="tap shrink-0 rounded-2xl bg-secondary px-4 text-[18px] font-bold" onClick={async () => { const n = Number(fare); if (!Number.isFinite(n) || n < 0) return; await update({ data: { id: plan.id, ride_quote: n } }); refresh(); }}>Save</button>
                </div>
                <p className="mt-1 text-[16px] text-muted-foreground">Ride services aren't connected yet, so you book the taxi yourself. A changed fare needs a fresh yes.</p>
              </details>}
            </div>
          }
        />
      ) : (
        <section className="space-y-2">
          <div className="flex items-start justify-between gap-3"><h1 className="font-display text-[30px] leading-tight">{plan.title}</h1><Chip tone={chip.tone}>{chip.label}</Chip></div>
          <p>{fmtWhen(plan, tz)}</p>
          {plan.place && <p className="text-muted-foreground">{plan.place}</p>}
          {plan.friend_name && <p className="text-[19px]">With {plan.friend_name}</p>}
          {plan.status === "going" && !isPast && !noTravel && (
            <button className={btn.secondary} onClick={async () => { await fell({ data: { id: plan.id } }); refresh(); }}>My ride fell through</button>
          )}
          {plan.status === "going" && isPast && !memo && (
            <div className="card-soft space-y-3 p-4">
              <h2 className="font-display text-[26px]">How was it?</h2>
              <div className="grid grid-cols-3 gap-2">
                {(["lovely", "okay", "missed"] as const).map((o) => (
                  <button key={o} className="tap rounded-xl border-2 border-primary/20 bg-card text-[19px] font-bold" onClick={async () => { const r = await outcome({ data: { id: plan.id, outcome: o } }); setMemo(r.suggestion); refresh(); }}>{o === "missed" ? "Didn't go" : o[0]!.toUpperCase() + o.slice(1)}</button>
                ))}
              </div>
            </div>
          )}
          {memo && (
            <div className="card-soft space-y-3 p-4">
              <p className="text-[20px]">Should Company remember this? <b>“{memo}”</b></p>
              <div className="grid grid-cols-2 gap-2">
                <button className={btn.primary} onClick={async () => { await keep({ data: { kind: "like", text: memo, source: "You agreed after an outing" } }); setMemo(null); toast("Saved to what Company remembers."); }}>Remember</button>
                <button className={btn.secondary} onClick={() => setMemo(null)}>Don't</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card-soft space-y-3 p-4">
        <label htmlFor="share" className="flex items-center justify-between gap-3 text-[21px]">
          Tell family about this plan?
          <Toggle id="share" label="Share this plan with family" checked={plan.share_override ?? profile.share_plans} onChange={async (v) => { await update({ data: { id: plan.id, share_override: v } }); refresh(); }} />
        </label>
        {plan.status === "planning" ? (!editing ? <button className={btn.ghost} onClick={() => setEditing(true)}>Edit details</button> : <EditPlan plan={plan} tz={tz} onDone={() => { setEditing(false); refresh(); }} />)
          : <p className="text-[17px] text-muted-foreground">This plan has been confirmed. A different time or place needs a new plan and a new approval.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-[19px] font-bold uppercase tracking-wider text-muted-foreground">What happened</h2>
        <ol className="space-y-1.5 text-[18px]">{log.map((l) => <li key={l.id}><span className="text-muted-foreground">{fmtTime(l.created_at, tz)}</span> · {l.text}</li>)}</ol>
      </section>
    </div>
  );
}

function toLocalInput(iso: string) { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function EditPlan({ plan, onDone }: { plan: { id: string; title: string; place: string; starts_at: string; ends_at: string }; tz: string; onDone: () => void }) {
  const update = useServerFn(updatePlan);
  const [f, setF] = useState({ title: plan.title, place: plan.place, start: toLocalInput(plan.starts_at), end: toLocalInput(plan.ends_at) });
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await update({ data: { id: plan.id, title: f.title, place: f.place, starts_at: new Date(f.start).toISOString(), ends_at: new Date(f.end).toISOString() } }); onDone(); } catch (er) { toast.error(er instanceof Error ? er.message : "Couldn't save"); } }}>
      <div><label className={label} htmlFor="t">Title</label><input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} /></div>
      <div><label className={label} htmlFor="pl">Place</label><input id="pl" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} className={input} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="s">Starts</label><input id="s" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={input} /></div>
        <div><label className={label} htmlFor="en">Ends</label><input id="en" type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className={input} /></div>
      </div>
      <button className={btn.primary}>Save changes</button>
    </form>
  );
}
