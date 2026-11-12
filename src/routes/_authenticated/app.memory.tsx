import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { correctFact, forgetFact, listFacts, saveFact } from "@/lib/app.functions";
import { btn, Empty, ErrorBox, input, Loading } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/memory")({ component: Memory });
const GROUPS = [["person", "People"], ["like", "Likes"], ["routine", "Routines"], ["limit", "Limits"]] as const;

function Memory() {
  const fetchFacts = useServerFn(listFacts);
  const q = useQuery({ queryKey: ["facts"], queryFn: () => fetchFacts() });
  const qc = useQueryClient();
  const correct = useServerFn(correctFact);
  const forget = useServerFn(forgetFact);
  const add = useServerFn(saveFact);
  const [edit, setEdit] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [newText, setNewText] = useState("");
  const [kind, setKind] = useState<"person" | "like" | "routine" | "limit">("like");
  const refresh = () => qc.invalidateQueries({ queryKey: ["facts"] });
  const run = async (f: () => Promise<unknown>) => { try { await f(); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); } };
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const facts = q.data ?? [];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-[30px]">What Company remembers</h1>
      <p className="text-[19px] text-muted-foreground">Only what you agree to is kept. Health, food and sleep are never stored. Your family can't see this page.</p>
      {facts.length === 0 && <Empty>Nothing yet. Things you choose to keep after a chat appear here.</Empty>}
      {GROUPS.map(([k, title]) => {
        const items = facts.filter((f) => f.kind === k);
        if (!items.length) return null;
        return (
          <section key={k}>
            <h2 className="mb-2 text-[19px] font-bold uppercase tracking-wider text-agent-memory">{title}</h2>
            <ul className="space-y-2">
              {items.map((f) => (
                <li key={f.id} className="card-soft p-4">
                  <p>{f.text}</p>
                  <p className="text-[16px] text-muted-foreground">{f.source}, {new Date(f.created_at).toLocaleDateString()}{f.corrected_from ? " · corrected" : ""}</p>
                  {edit === f.id ? (
                    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); void run(() => correct({ data: { id: f.id, text } })).then(() => setEdit(null)); }}>
                      <label htmlFor={`c-${f.id}`} className="sr-only">Correction</label>
                      <input id={`c-${f.id}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} className={input} />
                      <div className="grid grid-cols-2 gap-2"><button className={btn.primary}>Save</button><button type="button" className={btn.secondary} onClick={() => setEdit(null)}>Cancel</button></div>
                    </form>
                  ) : (
                    <div className="mt-1 flex gap-2">
                      <button className="tap rounded-xl px-3 text-[19px] font-bold text-agent-coordinator" onClick={() => { setEdit(f.id); setText(f.text); }}>Change</button>
                      <button className="tap rounded-xl px-3 text-[19px] font-bold text-muted-foreground" onClick={() => run(() => forget({ data: { id: f.id } }))}>Forget</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <form className="card-soft space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); void run(() => add({ data: { kind, text: newText } })).then(() => setNewText("")); }}>
        <h2 className="font-display text-[24px]">Tell Company something</h2>
        <label htmlFor="nk" className="sr-only">Kind</label>
        <select id="nk" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}>{GROUPS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <label htmlFor="nt" className="sr-only">What to remember</label>
        <input id="nt" value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="e.g. I don't like the diner anymore" className={input} maxLength={160} />
        <button className={btn.primary} disabled={newText.trim().length < 3}>Remember this</button>
      </form>
    </div>
  );
}
