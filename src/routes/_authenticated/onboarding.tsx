import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMe, saveProfile } from "@/lib/app.functions";
import { btn, input, label, Toggle } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: async () => {
    const me = await getMe();
    if (me?.onboarded) throw redirect({ to: me.role === "family" ? "/family" : "/app" });
    return { me };
  },
  head: () => ({ meta: [{ title: "Set up Company" }, { name: "description", content: "A few questions to set up Company." }] }),
  component: Onboarding,
});

const INTERESTS = ["Live music", "Jazz", "Walking", "Gardening", "Films", "Choir", "Cards & games", "Woodworking", "Café chats", "Markets", "Church", "Dancing"];

function Onboarding() {
  const { me } = Route.useRouteContext();
  const save = useServerFn(saveProfile);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<"elder" | "family" | null>((me?.role as "elder" | "family" | null) ?? null);
  const [name, setName] = useState(me?.display_name ?? "");
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [interests, setInterests] = useState<string[]>([]);
  const [limit, setLimit] = useState(25);
  const [share, setShare] = useState({ share_plans: true, share_errands: true, share_outings: true });
  const [help, setHelp] = useState(true);
  const [phone, setPhone] = useState("");
  const [escalate, setEscalate] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await save({ data: role === "elder"
        ? { role, display_name: name, timezone: tz, interests, ride_limit: limit, ...share, help_contact_consent: help, escalate_no_reply: escalate, phone: phone || null, onboarded: true }
        : { role: "family", display_name: name, timezone: tz, onboarded: true } });
      navigate({ to: role === "family" ? "/family" : "/app" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); } finally { setBusy(false); }
  };

  const steps = role === "elder" ? 4 : 2;
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
        <img src="/company-logo.svg" alt="Company" className="h-8 w-auto" />
        <span className="text-[17px] text-muted-foreground">Step {step + 1} of {steps}</span>
      </header>
      <main className="mx-auto max-w-xl space-y-6 px-5 pb-16">
        {step === 0 && (
          <section className="space-y-5">
            <h1 className="font-display text-[34px] leading-tight">Who is this account for?</h1>
            {([["elder", "For me", "I want help doing the things I love. I decide everything."], ["family", "I'm family", "I'd like to know someone I love is okay, and help when asked."]] as const).map(([r, t, d]) => (
              <button key={r} onClick={() => setRole(r)} aria-pressed={role === r}
                className={cn("w-full rounded-2xl border-2 p-5 text-left", role === r ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-card")}>
                <span className="block font-display text-[26px]">{t}</span><span className="block text-[19px] opacity-85">{d}</span>
              </button>
            ))}
            <div><label className={label} htmlFor="name">Your first name</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={60} /></div>
            <div><label className={label} htmlFor="tz">Your timezone</label><input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className={input} /></div>
            <button className={btn.primary} disabled={!role || !name.trim()} onClick={() => (role === "family" ? setStep(1) : setStep(1))}>Next</button>
          </section>
        )}
        {step === 1 && role === "family" && (
          <section className="space-y-5">
            <h1 className="font-display text-[34px] leading-tight">You'll see what they choose to share</h1>
            <p className="text-[20px] text-muted-foreground">Ask them for an invitation code from their People page. You can answer their requests, but you can't book or change their plans, and you'll never see their chats.</p>
            <button className={btn.primary} disabled={busy} onClick={finish}>Finish setup</button>
            <button className={btn.ghost} onClick={() => setStep(0)}>Back</button>
          </section>
        )}
        {step === 1 && role === "elder" && (
          <section className="space-y-5">
            <h1 className="font-display text-[34px] leading-tight">What do you love doing?</h1>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button key={i} aria-pressed={interests.includes(i)} onClick={() => setInterests((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}
                  className={cn("tap rounded-full border-2 px-4 text-[19px] font-bold", interests.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-card")}>{i}</button>
              ))}
            </div>
            <div><label className={label} htmlFor="limit">The most you'd spend on one ride</label>
              <input id="limit" type="number" min={0} max={500} value={limit} onChange={(e) => setLimit(Math.max(0, Math.min(500, Number(e.target.value) || 0)))} className={input} />
              <p className="mt-1 text-[17px] text-muted-foreground">Anything more is shown with the difference and needs a fresh yes.</p></div>
            <button className={btn.primary} onClick={() => setStep(2)}>Next</button>
            <button className={btn.ghost} onClick={() => setStep(0)}>Back</button>
          </section>
        )}
        {step === 2 && role === "elder" && (
          <section className="space-y-4">
            <h1 className="font-display text-[34px] leading-tight">What may your family see?</h1>
            {([["share_plans", "Your plans"], ["share_errands", "Your errands"], ["share_outings", "Outings you've done"]] as const).map(([k, t]) => (
              <label key={k} htmlFor={k} className="card-soft flex items-center justify-between p-4 text-[21px]">{t}<Toggle id={k} label={t} checked={share[k]} onChange={(v) => setShare((s) => ({ ...s, [k]: v }))} /></label>
            ))}
            <p className="card-soft p-4 text-[21px]">Chats with Company <b className="float-right text-muted-foreground">Always private</b></p>
            <p className="text-[17px] text-muted-foreground">You can turn off sharing for any single plan later.</p>
            <button className={btn.primary} onClick={() => setStep(3)}>Next</button>
            <button className={btn.ghost} onClick={() => setStep(1)}>Back</button>
          </section>
        )}
        {step === 3 && role === "elder" && (
          <section className="space-y-4">
            <h1 className="font-display text-[34px] leading-tight">If you need help</h1>
            <label htmlFor="help" className="card-soft flex items-center justify-between gap-3 p-4 text-[20px]">When I press “I need help”, alert my linked family in Company at once<Toggle id="help" label="Help alerts" checked={help} onChange={setHelp} /></label>
            <div><label className={label} htmlFor="phone">Your phone number (optional)</label><input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
              <p className="mt-1 text-[17px] text-muted-foreground">Shown to your family only with a help alert, so they can call you.</p></div>
            <label htmlFor="esc" className="card-soft flex items-center justify-between gap-3 p-4 text-[20px]">If a ride falls through and I haven't answered, tell my family<Toggle id="esc" label="No-reply alerts" checked={escalate} onChange={setEscalate} /></label>
            <p className="text-[17px] text-muted-foreground">Company isn't an emergency service. The help screen always offers to call 911 first.</p>
            <button className={btn.primary} disabled={busy} onClick={finish}>Finish setup</button>
            <button className={btn.ghost} onClick={() => setStep(2)}>Back</button>
          </section>
        )}
      </main>
    </div>
  );
}
