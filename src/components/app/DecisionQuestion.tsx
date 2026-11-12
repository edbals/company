import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelDecision, commitDecision, createDecision } from "@/lib/app.functions";
import type { ChoiceOption } from "@/lib/plan-logic";
import { money } from "@/lib/plan-logic";
import { btn, newKey } from "./kit";
import { cn } from "@/lib/utils";

type Kind = "plan_ride" | "errand" | "recover";
type Pending = { id: string; undo_until: string; option_id: string };
/** counting: Undo window open · cancelling/committing: waiting for the server · undo_failed: paused, the person decides again. */
type Phase = "counting" | "cancelling" | "committing" | "undo_failed";

/** One question, 2–3 options with cost/time/reason, then a 10-second Undo before the server commits. */
export function DecisionQuestion(props: {
  kind: Kind; targetId: string; text: string; options: ChoiceOption[]; rideLimit: number;
  payloadFor?: (o: ChoiceOption) => { friend?: string; moveReminder?: boolean }; initialPending?: Pending | null;
  onNotNow?: () => void; onDone: (result: string) => void; extra?: React.ReactNode;
}) {
  const create = useServerFn(createDecision);
  const commit = useServerFn(commitDecision);
  const cancel = useServerFn(cancelDecision);
  const [pending, setPending] = useState<Pending | null>(props.initialPending ?? null);
  const [phase, setPhase] = useState<Phase>("counting");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  const finish = (result: string) => {
    setPending(null); setPhase("counting");
    if (result === "quote_changed") toast("The fare changed, so nothing was sent. Please choose again.");
    if (result === "no_family") toast("No family member is linked yet. Invite someone under People.");
    if (result === "cancelled") toast("Undone. Nothing was sent.");
    props.onDone(result);
  };

  const doCommit = async (sendNow: boolean) => {
    if (!pending || inFlight.current) return;
    inFlight.current = true; setPhase("committing");
    try {
      const { result } = await commit({ data: { id: pending.id, sendNow } });
      if (result === "too_early") { setPhase("counting"); return; }
      finish(result);
    } catch {
      setPhase("counting");
      toast.error("Couldn't reach Company. Your choice is saved and will be sent when the connection is back.");
    } finally { inFlight.current = false; }
  };

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [pending]);
  useEffect(() => {
    if (pending && phase === "counting" && now >= new Date(pending.undo_until).getTime()) void doCommit(false);
  }, [now, pending, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (o: ChoiceOption) => {
    if (!o.sends) { props.onNotNow?.(); return; }
    setBusy(true);
    try {
      const d = await create({ data: { kind: props.kind, targetId: props.targetId, optionId: o.id as "family", shownCost: o.cost, payload: props.payloadFor?.(o) ?? {}, key: newKey() } });
      setPhase("counting");
      setPending({ id: d.id, undo_until: d.undo_until, option_id: d.option_id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Nothing was sent.");
      props.onDone("refresh");
    } finally { setBusy(false); }
  };

  const undo = async () => {
    if (!pending || inFlight.current) return;
    inFlight.current = true; setPhase("cancelling");
    try {
      const { status } = await cancel({ data: { id: pending.id } });
      if (status === "committed") toast("It was already sent, so it couldn't be undone.");
      finish(status);
    } catch {
      setPhase("undo_failed");
      toast.error("Undo didn't reach Company. Please try again.");
    } finally { inFlight.current = false; }
  };

  const left = pending ? Math.max(0, Math.ceil((new Date(pending.undo_until).getTime() - now) / 1000)) : 0;
  const chosen = pending ? props.options.find((o) => (o.id === "no_ride" ? "none" : o.id) === pending.option_id) : null;
  const notNow = props.options.find((o) => o.id === "not_now");
  const main = props.options.filter((o) => o !== notNow);
  const waiting = phase === "cancelling" || phase === "committing";

  return (
    <section aria-labelledby="q-title" className="space-y-4">
      <p className="text-[17px] font-bold uppercase tracking-wider text-agent-coordinator">One question</p>
      <h2 id="q-title" className="font-display text-[28px] leading-tight">{props.text}</h2>
      {props.extra}
      <div className="space-y-3">
        {main.map((o) => (
          <button key={o.id} disabled={!!pending || busy} onClick={() => choose(o)}
            className={cn("w-full rounded-2xl border-2 px-4 py-3 text-left transition disabled:opacity-50",
              o.primary ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-card hover:border-primary/45",
              chosen?.id === o.id && "ring-4 ring-accent disabled:opacity-100")}>
            <span className="block text-[22px] font-bold">{o.label}</span>
            <span className={cn("block text-[18px]", o.primary ? "text-primary-foreground/85" : "text-muted-foreground")}>{o.cost === 0 ? "Free" : money(o.cost)} · {o.time}</span>
            <span className={cn("block text-[18px]", o.primary ? "text-primary-foreground/85" : "text-muted-foreground")}>{o.reason}</span>
            {o.overLimitBy > 0 && <span className="mt-1 inline-block rounded-full bg-accent px-3 py-0.5 text-[16px] font-bold text-accent-foreground">{money(o.overLimitBy)} over your {money(props.rideLimit)} limit</span>}
          </button>
        ))}
      </div>
      {notNow && !pending && <button className={btn.ghost} onClick={() => choose(notNow)}>Not now</button>}
      {pending && (
        <div role="status" aria-live="polite" className="sticky bottom-2 overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <div className="h-1.5 bg-accent transition-[width] duration-200" style={{ width: `${(left / 10) * 100}%` }} />
          <div className="p-4">
            <p className="text-[22px] font-bold">
              {phase === "cancelling" ? "Undoing…" : phase === "committing" ? "Sending…" : phase === "undo_failed" ? "Undo didn't go through" : `Sending in ${left} second${left === 1 ? "" : "s"}`}
            </p>
            <p className="text-[18px] text-primary-foreground/80">
              {chosen ? `“${chosen.label}”. ` : ""}{phase === "undo_failed" ? "Try Undo again, or send it." : "Nothing leaves Company until then."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button disabled={waiting} className="tap rounded-xl border-2 border-primary-foreground/40 text-[21px] font-bold disabled:opacity-50" onClick={undo}>{phase === "undo_failed" ? "Try Undo again" : "Undo"}</button>
              <button disabled={waiting} className="tap rounded-xl bg-accent text-[21px] font-bold text-accent-foreground disabled:opacity-50" onClick={() => doCommit(true)}>Send now</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
