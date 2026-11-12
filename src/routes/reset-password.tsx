import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { btn, input, label } from "@/components/app/kit";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Set a new password — Company" }, { name: "description", content: "Choose a new password for Company." },
    { property: "og:title", content: "Set a new password — Company" }, { property: "og:description", content: "Choose a new password for Company." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const isRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setErr(error.message); else navigate({ to: "/onboarding" });
  };
  return (
    <main className="mx-auto max-w-md space-y-5 px-5 py-12">
      <img src="/company-logo.svg" alt="Company" className="h-9 w-auto" />
      <h1 className="font-display text-[34px]">Set a new password</h1>
      {!isRecovery && <p className="text-[18px] text-muted-foreground">Open this page from the link in your reset email.</p>}
      <form onSubmit={submit} className="space-y-4">
        <div><label className={label} htmlFor="npw">New password</label><input id="npw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} className={input} /></div>
        {err && <p role="alert" className="text-[18px] text-destructive">{err}</p>}
        <button className={btn.primary}>Save password</button>
      </form>
    </main>
  );
}
