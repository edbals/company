import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Key the retired local-only demo used; cleared on sign-out so no old data lingers.
const LEGACY_LOCAL_STORAGE_KEY = "company-demo-v1";

export const btn = {
  primary: "tap inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[21px] font-bold text-primary-foreground shadow-soft transition hover:opacity-95 active:translate-y-px disabled:opacity-50",
  secondary: "tap inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/20 bg-card px-5 text-[21px] font-bold text-foreground transition hover:border-primary/45 disabled:opacity-50",
  ghost: "tap inline-flex items-center justify-center rounded-2xl px-4 text-[19px] font-bold text-muted-foreground underline-offset-4 hover:underline",
  danger: "tap inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive bg-card px-5 text-[21px] font-bold text-destructive",
};
export const input = "min-h-14 w-full rounded-2xl border-2 border-input bg-card px-4 text-[20px] placeholder:text-muted-foreground/70";
export const label = "mb-1.5 block text-[18px] font-bold";

export function Chip({ tone, children }: { tone: "warn" | "ok" | "bad" | "muted"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[16px] font-bold",
      tone === "bad" ? "border-destructive bg-destructive text-destructive-foreground"
      : tone === "ok" ? "border-success/30 bg-success-soft text-success"
      : tone === "warn" ? "border-accent/50 bg-accent-soft text-accent-foreground" : "border-border bg-muted text-muted-foreground")}>
      {tone === "bad" && <span aria-hidden className="size-2 rounded-full bg-destructive-foreground" />}{children}
    </span>
  );
}

export function Loading({ what = "Loading" }: { what?: string }) {
  return <p role="status" className="py-10 text-center text-[20px] text-muted-foreground animate-pulse">{what}…</p>;
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="card-soft space-y-3 p-5">
      <p className="text-[20px] font-bold">That didn't load.</p>
      <p className="text-[18px] text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
      {retry && <button className={btn.secondary} onClick={retry}>Try again</button>}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-input p-5 text-[20px] text-muted-foreground">{children}</p>;
}

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on(); window.addEventListener("online", on); window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);
  if (online) return null;
  return <div role="status" className="bg-accent-soft px-4 py-2 text-center text-[17px] font-bold">You're offline. Changes will wait until you're connected.</div>;
}

export function Logo({ to = "/" as const, className }: { to?: "/" | "/app" | "/family"; className?: string }) {
  return <Link to={to} aria-label="Company home"><img src="/company-logo.svg" alt="Company" className={cn("h-8 w-auto", className)} /></Link>;
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    try { localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY); } catch { /* storage unavailable */ }
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  };
}

export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function Toggle({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id: string }) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-60",
        checked ? "border-primary bg-primary" : "border-input bg-muted")}
    >
      <span className={cn("inline-block size-7 rounded-full bg-card shadow transition-transform", checked ? "translate-x-7" : "translate-x-0.5")} />
    </button>
  );
}
