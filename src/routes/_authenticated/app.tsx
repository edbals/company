import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, CalendarSearch, Home, MessageCircle, Phone, Settings, Users } from "lucide-react";
import { getMe, sendHelp } from "@/lib/app.functions";
import { btn, OfflineBanner } from "@/components/app/kit";
import { fmtDay } from "@/lib/plan-logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async () => {
    const me = await getMe();
    if (!me?.onboarded) throw redirect({ to: "/onboarding" });
    if (me.role !== "elder") throw redirect({ to: "/family" });
    return { me };
  },
  head: () => ({ meta: [{ title: "Your week — Company" }, { name: "description", content: "Your plans, errands and check-in." }] }),
  component: AppLayout,
});

const NAV = [
  ["/app", "Home", Home], ["/app/talk", "Talk", MessageCircle], ["/app/events", "What's on", CalendarSearch],
  ["/app/memory", "Remembers", Brain], ["/app/people", "People", Users], ["/app/settings", "Settings", Settings],
] as const;

function AppLayout() {
  const { me } = Route.useRouteContext();
  const [help, setHelp] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link to="/app" aria-label="Company home"><img src="/company-logo.svg" alt="Company" className="h-7 w-auto" /></Link>
            <p className="mt-0.5 text-[16px] text-muted-foreground">{fmtDay(new Date().toISOString(), me.timezone)}</p>
          </div>
          <button onClick={() => setHelp(true)} className="tap rounded-full border-2 border-destructive bg-card px-4 text-[19px] font-bold text-destructive hover:bg-alert-soft">I need help</button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-5 text-[22px]">
        {help ? <HelpScreen onClose={() => setHelp(false)} /> : <Outlet />}
      </main>
      {!help && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
          <div className="mx-auto grid max-w-2xl grid-cols-6">
            {NAV.map(([to, label, Icon]) => {
              const active = to === "/app" ? path === "/app" || path === "/app/" : path.startsWith(to);
              return (
                <Link key={to} to={to} aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[14px] font-bold sm:text-[16px]", active ? "text-foreground" : "text-muted-foreground")}>
                  <Icon className={cn("size-6", active && "text-agent-checkin")} aria-hidden />{label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function HelpScreen({ onClose }: { onClose: () => void }) {
  const send = useServerFn(sendHelp);
  const [state, setState] = useState<null | "sending" | { sent: boolean; reason?: string; to?: string }>(null);
  const alert = async () => {
    setState("sending");
    try { setState(await send()); } catch { setState({ sent: false, reason: "error" }); }
  };
  return (
    <section className="space-y-5" aria-labelledby="help-title">
      <h1 id="help-title" className="font-display text-[32px]">Do you need help right now?</h1>
      <a href="tel:911" className="flex h-28 w-full items-center justify-center gap-3 rounded-3xl bg-destructive text-[32px] font-bold text-destructive-foreground shadow-soft"><Phone className="size-9" aria-hidden />Call 911</a>
      <p className="text-center text-[17px] text-muted-foreground">This opens your phone's dialer. Company isn't an emergency service.</p>
      {state && typeof state === "object" ? (
        <p role="status" className={cn("rounded-2xl p-4 text-[22px] font-bold", state.sent ? "bg-accent-soft" : "bg-alert-soft text-destructive")}>
          {state.sent ? `${state.to} has been alerted in Company. They'll see it right away.`
            : state.reason === "consent" ? "Help alerts to family are off. You can turn them on in Settings."
            : state.reason === "no_family" ? "No family member is linked yet. Invite someone under People." : "Couldn't send the alert. Please call instead."}
        </p>
      ) : (
        <button className={btn.danger} disabled={state === "sending"} onClick={alert}>{state === "sending" ? "Alerting…" : "Alert my family"}</button>
      )}
      <button className={btn.secondary} onClick={onClose}>I'm okay, go back</button>
    </section>
  );
}
