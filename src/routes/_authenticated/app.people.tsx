import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createInvite, getHousehold, revokeInvites, setMemberStatus } from "@/lib/app.functions";
import { btn, Chip, Empty, ErrorBox, Loading } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/people")({ component: People });

function People() {
  const fetchHh = useServerFn(getHousehold);
  const q = useQuery({ queryKey: ["household"], queryFn: () => fetchHh(), refetchInterval: 15_000 });
  const invite = useServerFn(createInvite);
  const setStatus = useServerFn(setMemberStatus);
  const revoke = useServerFn(revokeInvites);
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["household"] });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const members = q.data?.members ?? [];
  const link = code ? `${window.location.origin}/join?code=${encodeURIComponent(code)}` : "";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-[30px]">Your people</h1>
      <p className="text-[19px] text-muted-foreground">Family you approve see only what you share. They can answer your requests but can't book or change anything.</p>
      {members.length === 0 && <Empty>No family linked yet.</Empty>}
      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.user_id} className="card-soft space-y-3 p-4">
            <div className="flex items-center justify-between gap-2"><span className="font-display text-[24px]">{m.name || "Family member"}</span><Chip tone={m.status === "active" ? "ok" : "warn"}>{m.status === "active" ? "Linked" : "Waiting for your OK"}</Chip></div>
            {m.status === "pending" && <button className={btn.primary} onClick={async () => { await setStatus({ data: { userId: m.user_id, status: "active" } }); refresh(); toast("Linked."); }}>Yes, let them see what I share</button>}
            <button className={btn.secondary} onClick={async () => { if (!confirm(`Remove ${m.name || "this person"}? They'll lose access right away.`)) return; await setStatus({ data: { userId: m.user_id, status: "revoked" } }); refresh(); }}>{m.status === "pending" ? "Decline" : "Remove access"}</button>
          </li>
        ))}
      </ul>
      <section className="card-soft space-y-3 p-4">
        <h2 className="font-display text-[24px]">Invite family</h2>
        {code ? (
          <>
            <p>Give them this code. It works once and expires in 3 days.</p>
            <p className="select-all break-all rounded-xl bg-secondary p-3 font-mono text-[20px]">{code}</p>
            <button className={btn.secondary} onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied."))}>Copy invitation link</button>
          </>
        ) : (
          <button className={btn.primary} onClick={async () => { try { const r = await invite(); setCode(r.code); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't create a code"); } }}>Make an invitation code</button>
        )}
        {(q.data?.open_invites ?? 0) > 0 && <button className={btn.ghost} onClick={async () => { await revoke(); setCode(null); refresh(); toast("Unused codes cancelled."); }}>Cancel unused codes ({q.data!.open_invites})</button>}
      </section>
    </div>
  );
}
