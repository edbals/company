import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createPersonalPlan } from "@/lib/app.functions";
import { btn, input, label } from "./kit";

type Setting = "home" | "remote" | "elsewhere";

/** Uses the existing plans table directly, without inventing a catalog event. */
export function PersonalPlanForm({ initialTitle = "", onCancel }: { initialTitle?: string; onCancel?: () => void }) {
  const create = useServerFn(createPersonalPlan);
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle.slice(0, 120));
  const [setting, setSetting] = useState<Setting>("elsewhere");
  const [place, setPlace] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const begins = new Date(start), ends = new Date(end);
    if (!Number.isFinite(begins.getTime()) || !Number.isFinite(ends.getTime()) || ends <= begins) {
      toast.error("Choose a start and end time, with the end after the start."); return;
    }
    setBusy(true);
    try {
      const result = await create({ data: {
        title: title.trim(),
        place: setting === "home" ? "At home" : setting === "remote" ? "Online or phone" : place.trim(),
        starts_at: begins.toISOString(), ends_at: ends.toISOString(), share,
      } });
      navigate({ to: "/app/plans/$planId", params: { planId: result.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the plan. Please try again.");
    } finally { setBusy(false); }
  };
  return <form className="card-soft space-y-4 p-4" onSubmit={submit}>
    <div><h2 className="font-display text-[25px]">Start a personal plan</h2><p className="text-[17px] text-muted-foreground">Add the details you know. Company hasn't checked the time, place or cost, and nothing will be booked.</p></div>
    <div><label className={label} htmlFor="personal-title">What would you like to do?</label><input id="personal-title" className={input} required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
    <fieldset className="space-y-2"><legend className={label}>Where will it happen?</legend>
      {([ ["home", "At home"], ["remote", "Online or by phone"], ["elsewhere", "Somewhere else or undecided"] ] as const).map(([value, text]) =>
        <label key={value} className="flex min-h-12 items-center gap-3 text-[19px]"><input type="radio" name="personal-setting" value={value} checked={setting === value} onChange={() => setSetting(value)} className="size-5" />{text}</label>)}
    </fieldset>
    {setting === "elsewhere" && <div><label className={label} htmlFor="personal-place">Place, if known</label><input id="personal-place" className={input} maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="You can decide later" /></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className={label} htmlFor="personal-start">Start</label><input id="personal-start" className={input} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><label className={label} htmlFor="personal-end">End</label><input id="personal-end" className={input} type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
    </div>
    <label className="flex items-center gap-3 text-[18px]"><input type="checkbox" className="size-5" checked={share} onChange={(e) => setShare(e.target.checked)} />Share this plan with linked family</label>
    <div className="flex flex-wrap gap-2"><button type="submit" className={btn.primary} disabled={busy}>{busy ? "Saving…" : "Save plan for review"}</button>{onCancel && <button type="button" className={btn.ghost} onClick={onCancel}>Cancel</button>}</div>
  </form>;
}
