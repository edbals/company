import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createPlan, deleteEvent, listEvents, saveEvent } from "@/lib/app.functions";
import { fmtWhen, money } from "@/lib/plan-logic";
import { btn, Empty, ErrorBox, input, label, Loading } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/events")({ component: Events });

function Events() {
  const { me } = Route.useRouteContext() as unknown as { me: { timezone: string } };
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const fetchEvents = useServerFn(listEvents);
  const list = useQuery({ queryKey: ["events", term], queryFn: () => fetchEvents({ data: { q: term } }) });
  const plan = useServerFn(createPlan);
  const del = useServerFn(deleteEvent);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-[30px]">What's on</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q); }} role="search">
        <label htmlFor="q" className="sr-only">Search events</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Music, walks, films…" className={input} maxLength={60} />
        <button className="tap shrink-0 rounded-2xl bg-primary px-5 text-[19px] font-bold text-primary-foreground">Search</button>
      </form>
      <button className={btn.secondary} onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "Add my own event"}</button>
      {adding && <EventForm onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["events"] }); }} />}
      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} retry={() => list.refetch()} /> : (list.data ?? []).length === 0 ? <Empty>Nothing found. Try another word, or add your own event.</Empty> : (
        <ul className="space-y-3">
          {list.data!.map((e) => (
            <li key={e.id} className="card-soft p-4">
              <h2 className="font-display text-[24px] leading-tight">{e.title}</h2>
              <p className="text-[19px]">{fmtWhen(e, me.timezone)}</p>
              <p className="text-[18px] text-muted-foreground">{e.place}{` · ${money(Number(e.cost))}`}{e.mine ? " · Yours" : ""}</p>
              {e.description && <p className="mt-1 text-[18px]">{e.description}</p>}
              <div className="mt-3 flex gap-2">
                <button className="tap flex-1 rounded-xl bg-primary text-[19px] font-bold text-primary-foreground" onClick={async () => { try { const r = await plan({ data: { eventId: e.id } }); navigate({ to: "/app/plans/$planId", params: { planId: r.id } }); } catch (er) { toast.error(er instanceof Error ? er.message : "Couldn't plan"); } }}>Plan it</button>
                {e.mine && <button className="tap rounded-xl px-4 text-[18px] font-bold text-muted-foreground" onClick={async () => { await del({ data: { id: e.id } }); qc.invalidateQueries({ queryKey: ["events"] }); }}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventForm({ onSaved }: { onSaved: () => void }) {
  const save = useServerFn(saveEvent);
  const [f, setF] = useState({ title: "", place: "", description: "", start: "", end: "", cost: "0" });
  return (
    <form className="card-soft space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await save({ data: { title: f.title, place: f.place, description: f.description, starts_at: new Date(f.start).toISOString(), ends_at: new Date(f.end).toISOString(), cost: Number(f.cost) || 0 } });
        toast("Event added."); onSaved();
      } catch (er) { toast.error(er instanceof Error ? er.message : "Check the times and try again."); }
    }}>
      <div><label className={label} htmlFor="et">What is it?</label><input id="et" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} maxLength={120} /></div>
      <div><label className={label} htmlFor="ep">Where?</label><input id="ep" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} className={input} maxLength={120} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="es">Starts</label><input id="es" type="datetime-local" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={input} /></div>
        <div><label className={label} htmlFor="ee">Ends</label><input id="ee" type="datetime-local" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className={input} /></div>
      </div>
      <div><label className={label} htmlFor="ec">Cost ($)</label><input id="ec" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} className={input} /></div>
      <button className={btn.primary}>Save event</button>
    </form>
  );
}
