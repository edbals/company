import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getErrand } from "@/lib/app.functions";
import { errandChip, errandQuestion } from "@/lib/plan-logic";
import { DecisionQuestion } from "@/components/app/DecisionQuestion";
import { Chip, ErrorBox, Loading } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/app/errands/$errandId")({ component: ErrandPage });

function ErrandPage() {
  const { errandId } = Route.useParams();
  const fetchErrand = useServerFn(getErrand);
  const q = useQuery({ queryKey: ["errand", errandId], queryFn: () => fetchErrand({ data: { id: errandId } }), refetchInterval: 15_000 });
  const qc = useQueryClient();
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  const { errand, log, pending, familyName } = q.data;
  const qn = errandQuestion(errand.item, familyName);
  const chip = errandChip(errand.status);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["errand", errandId] }); qc.invalidateQueries({ queryKey: ["home"] }); };
  return (
    <div className="space-y-6">
      <Link to="/app" className="text-[18px] font-bold text-muted-foreground">← This week</Link>
      {errand.status === "waiting_elder" ? (
        <DecisionQuestion kind="errand" targetId={errand.id} text={qn.text} options={qn.options} rideLimit={0}
          initialPending={pending ? { id: pending.id, undo_until: pending.undo_until, option_id: pending.option_id } : null}
          onNotNow={() => history.back()} onDone={refresh} />
      ) : (
        <div className="flex items-start justify-between gap-3"><h1 className="font-display text-[30px] capitalize">{errand.item}</h1><Chip tone={chip.tone}>{chip.label}</Chip></div>
      )}
      <section>
        <h2 className="mb-2 text-[19px] font-bold uppercase tracking-wider text-muted-foreground">What happened</h2>
        <ol className="space-y-1.5 text-[18px]">{log.length ? log.map((l) => <li key={l.id}>{l.text}</li>) : <li className="text-muted-foreground">Nothing yet.</li>}</ol>
      </section>
    </div>
  );
}
