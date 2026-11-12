import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { addReminder, deleteAccount, deleteReminder, exportData, getHome, getMe, saveProfile } from "@/lib/app.functions";
import { timeLabel } from "@/lib/plan-logic";
import { btn, ErrorBox, input, label, Loading, useSignOut, Toggle } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: Settings });

export function useProfileSaver() {
  const save = useServerFn(saveProfile);
  const qc = useQueryClient();
  const router = useRouter();
  return async (patch: Record<string, unknown>) => {
    try { await save({ data: patch as never }); qc.invalidateQueries(); router.invalidate(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); }
  };
}

function Settings() {
  const fetchMe = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const fetchHome = useServerFn(getHome);
  const home = useQuery({ queryKey: ["home"], queryFn: () => fetchHome() });
  const save = useProfileSaver();
  const addRem = useServerFn(addReminder);
  const delRem = useServerFn(deleteReminder);
  const exp = useServerFn(exportData);
  const del = useServerFn(deleteAccount);
  const signOut = useSignOut();
  const qc = useQueryClient();
  const [rem, setRem] = useState({ label: "", at: "14:00" });
  const [confirmText, setConfirmText] = useState("");
  if (me.isLoading) return <Loading />;
  if (me.error || !me.data) return <ErrorBox error={me.error} retry={() => me.refetch()} />;
  const p = me.data;
  const row = (id: string, text: string, checked: boolean, on: (v: boolean) => void, note?: string) => (
    <div className="p-4">
      <label htmlFor={id} className="flex items-center justify-between gap-3">{text}<Toggle id={id} label={text} checked={checked} onChange={on} /></label>
      {note && <p className="mt-1 text-[17px] text-muted-foreground">{note}</p>}
    </div>
  );
  return (
    <div className="space-y-6">
      <h1 className="font-display text-[30px]">Settings</h1>
      <section className="card-soft divide-y divide-border">
        <h2 className="p-4 text-[19px] font-bold text-muted-foreground">What your family can see</h2>
        {row("sp", "Plans", p.share_plans, (v) => save({ share_plans: v }))}
        {row("se", "Errands", p.share_errands, (v) => save({ share_errands: v }))}
        {row("so", "Outings done", p.share_outings, (v) => save({ share_outings: v }))}
        <p className="flex justify-between p-4">Chats <b className="text-muted-foreground">Always private</b></p>
      </section>
      <section className="card-soft divide-y divide-border">
        <h2 className="p-4 text-[19px] font-bold text-muted-foreground">Help and safety</h2>
        {row("hc", "Alert my family when I press “I need help”", p.help_contact_consent, (v) => save({ help_contact_consent: v }))}
        {row("en", "Tell my family if a ride falls through and I haven't answered", p.escalate_no_reply, (v) => save({ escalate_no_reply: v }), "Off unless you turn it on.")}
        <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("phone") as string).trim(); void save({ phone: v || null }); }}>
          <label className={label} htmlFor="ph">Phone number for family to call you</label>
          <div className="flex gap-2"><input id="ph" name="phone" defaultValue={p.phone ?? ""} inputMode="tel" className={input} /><button className="tap shrink-0 rounded-2xl bg-secondary px-4 font-bold">Save</button></div>
        </form>
      </section>
      <section className="card-soft space-y-3 p-4">
        <h2 className="text-[19px] font-bold text-muted-foreground">Rides and money</h2>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void save({ ride_limit: Math.max(0, Math.min(500, Number(new FormData(e.currentTarget).get("lim")) || 0)) }); }}>
          <div className="flex-1"><label className={label} htmlFor="lim">Ride limit ($ per ride)</label><input id="lim" name="lim" type="number" min={0} max={500} defaultValue={p.ride_limit} className={input} /></div>
          <button className="tap rounded-2xl bg-secondary px-4 font-bold">Save</button>
        </form>
        <p className="text-[17px] text-muted-foreground">Ride booking service: <b>Not connected</b>. Delivery service: <b>Not connected</b>. You can ask family or make your own way.</p>
      </section>
      <section className="card-soft space-y-3 p-4">
        <h2 className="text-[19px] font-bold text-muted-foreground">Reminders</h2>
        <ul className="space-y-2">{(home.data?.reminders ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2"><span>{timeLabel(r.at_time)} · {r.label}</span><button className="tap px-3 text-[18px] font-bold text-muted-foreground" onClick={async () => { await delRem({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["home"] }); }}>Remove</button></li>
        ))}</ul>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={async (e) => { e.preventDefault(); if (!rem.label.trim()) return; await addRem({ data: { label: rem.label, at_time: rem.at } }); setRem({ label: "", at: "14:00" }); qc.invalidateQueries({ queryKey: ["home"] }); }}>
          <label htmlFor="rl" className="sr-only">Reminder</label><input id="rl" value={rem.label} onChange={(e) => setRem({ ...rem, label: e.target.value })} placeholder="Reminder" className={input} maxLength={80} />
          <label htmlFor="rt" className="sr-only">Time</label><input id="rt" type="time" value={rem.at} onChange={(e) => setRem({ ...rem, at: e.target.value })} className={input} />
          <button className="tap rounded-2xl bg-secondary px-4 font-bold">Add</button>
        </form>
        <p className="text-[17px] text-muted-foreground">Reminder names stay on your account and are never sent to the AI.</p>
      </section>
      <section className="card-soft divide-y divide-border">
        {row("ra", "Read questions aloud", p.read_aloud, (v) => save({ read_aloud: v }))}
        <div className="flex items-center justify-between gap-3 p-4"><span>Last confirmed: <b>{p.last_confirmed ?? "never"}</b></span><button className="tap rounded-2xl bg-secondary px-4 font-bold" onClick={() => save({ reconfirm: true })}>Reconfirm</button></div>
        <form className="space-y-2 p-4" onSubmit={(e) => { e.preventDefault(); const tz = (new FormData(e.currentTarget).get("tz") as string).trim(); void save({ timezone: tz }); }}>
          <label className={label} htmlFor="tz">Timezone</label>
          <div className="flex gap-2"><input id="tz" name="tz" defaultValue={p.timezone} className={input} /><button className="tap shrink-0 rounded-2xl bg-secondary px-4 font-bold">Save</button></div>
        </form>
      </section>
      <section className="card-soft space-y-3 p-4">
        <h2 className="text-[19px] font-bold text-muted-foreground">Your data</h2>
        <button className={btn.secondary} onClick={async () => { const d = await exp(); const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "company-my-data.json"; a.click(); URL.revokeObjectURL(url); }}>Download my data</button>
        <button className={btn.secondary} onClick={signOut}>Sign out</button>
        <details className="rounded-2xl border border-destructive/40 p-3">
          <summary className="cursor-pointer font-bold text-destructive">Delete my account</summary>
          <p className="mt-2 text-[18px]">This removes your plans, memory, chats and family links for good. Type DELETE to confirm.</p>
          <label htmlFor="del" className="sr-only">Type DELETE</label>
          <input id="del" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={input + " mt-2"} />
          <button className={btn.danger + " mt-2"} disabled={confirmText !== "DELETE"} onClick={async () => { try { await del({ data: { confirm: "DELETE" } }); await signOut(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't delete"); } }}>Delete everything</button>
        </details>
      </section>
    </div>
  );
}
