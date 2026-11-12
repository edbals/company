import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { acceptInvite, getMe } from "@/lib/app.functions";
import { btn } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/join")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({ meta: [{ title: "Join a household — Company" }, { name: "description", content: "Accept a family invitation." }] }),
  component: Join,
});

function Join() {
  const { code } = Route.useSearch();
  const accept = useServerFn(acceptInvite);
  const me = useServerFn(getMe);
  const [msg, setMsg] = useState("Checking your invitation…");
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      const p = await me();
      if (!p?.onboarded) { setMsg("First, finish setting up your account as family. Then open this link again."); return; }
      if (!code) { setMsg("This link has no code."); return; }
      try { await accept({ data: { code } }); if (live) { setOk(true); setMsg("Done. They'll need to say yes before you see anything they share."); } }
      catch (e) { if (live) setMsg(e instanceof Error ? e.message : "Couldn't accept the invitation."); }
    })();
    return () => { live = false; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className="mx-auto max-w-md space-y-5 px-5 py-12">
      <img src="/company-logo.svg" alt="Company" className="h-9 w-auto" />
      <p role="status" className="text-[22px]">{msg}</p>
      <Link to={ok ? "/family" : "/onboarding"} className={btn.primary}>{ok ? "Go to my family page" : "Continue"}</Link>
    </main>
  );
}
