import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { btn, input, label } from "@/components/app/kit";

const safePath = (p: string | undefined) => (p && p.startsWith("/") && !p.startsWith("//") ? p : undefined);

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional(), mode: z.enum(["signin", "signup"]).optional() }),
  head: () => ({ meta: [
    { title: "Sign in — Company" }, { name: "description", content: "Sign in or create your Company account." },
    { property: "og:title", content: "Sign in — Company" }, { property: "og:description", content: "Sign in or create your Company account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  if (!import.meta.env['VITE_SUPABASE_URL'] || !import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']) {
    return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-12 text-[20px]">
      <a href="/"><img src="/company-logo.svg" alt="Company" width="170" /></a>
      <h1 className="font-display text-[34px]">Your Company account</h1>
      <p>This local copy is ready for the connected backend. Account sign-in is available in the existing Company workspace.</p>
      <a className="tap flex items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground" href="https://id-preview--3c945389-f27a-48e7-a926-16d604e90349.lovable.app/auth">Open connected Company</a>
      <Link to="/" className="underline">Back to Company</Link>
    </main>;
  }
  return <ConfiguredAuthPage />;
}

function ConfiguredAuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const after = safePath(search.redirect);

  const go = () => {
    if (after) window.location.assign(after); // same-origin path only
    else navigate({ to: "/onboarding" });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        go();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + (after ?? "/onboarding") } });
        if (error) throw error;
        if (data.session) go(); else setMsg("Check your email and tap the link to confirm your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg("If that email has an account, a reset link is on its way.");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong.");
    } finally { setBusy(false); }
  };
  const google = async () => {
    setErr(null);
    if (after) sessionStorage.setItem("company-after-auth", after);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if ("error" in r && r.error) setErr(r.error instanceof Error ? r.error.message : "Google sign-in didn't finish.");
    else if (!("redirected" in r && r.redirected)) { const p = sessionStorage.getItem("company-after-auth"); sessionStorage.removeItem("company-after-auth"); if (p) window.location.assign(p); else navigate({ to: "/onboarding" }); }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-5 py-8">
      <Link to="/" aria-label="Company home"><img src="/company-logo.svg" alt="Company" className="h-9 w-auto" /></Link>
      <main className="mt-8 w-full max-w-md space-y-5">
        <h1 className="font-display text-[34px] leading-tight">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1>
        {mode !== "forgot" && (
          <>
            <button className={btn.secondary} onClick={google} type="button">Continue with Google</button>
            <p className="text-center text-[17px] text-muted-foreground">or with email</p>
          </>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div><label className={label} htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></div>
          {mode !== "forgot" && <div><label className={label} htmlFor="pw">Password</label><input id="pw" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={input} /></div>}
          {err && <p role="alert" className="rounded-xl bg-alert-soft p-3 text-[18px] text-destructive">{err}</p>}
          {msg && <p role="status" className="rounded-xl bg-accent-soft p-3 text-[18px]">{msg}</p>}
          <button className={btn.primary} disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button>
        </form>
        <div className="flex flex-wrap justify-between gap-2">
          <button className={btn.ghost} onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "I already have an account" : "Create an account"}</button>
          {mode !== "forgot" && <button className={btn.ghost} onClick={() => setMode("forgot")}>Forgot password?</button>}
        </div>
      </main>
    </div>
  );
}
