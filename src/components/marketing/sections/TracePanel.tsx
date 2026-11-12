import { Cpu, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Run, RunStep, StepKind } from "../agent-run";

export type TraceView = "plain" | "technical";

const KIND_LABEL: Record<StepKind, { text: string; Icon: LucideIcon }> = {
  ai: { text: "AI agent", Icon: Sparkles },
  rule: { text: "Code rule", Icon: Cpu },
  human: { text: "Joe", Icon: UserRound },
};

interface KindTagProps {
  kind: StepKind;
}
function KindTag({ kind }: KindTagProps) {
  const { text, Icon } = KIND_LABEL[kind];
  return (
    <span className={`agents-kind agents-kind--${kind}`}>
      <Icon size={18} aria-hidden /> {text}
    </span>
  );
}

interface StepBodyProps {
  step: RunStep;
  view: TraceView;
}
function StepBody({ step, view }: StepBodyProps) {
  if (view === "technical") {
    return (
      <pre className="agents-code">
        <code>{step.technical}</code>
      </pre>
    );
  }
  return <p className="agents-plain">{step.plain}</p>;
}

interface TraceListProps {
  run: Run;
  index: number;
  view: TraceView;
}
/** Every step so far, newest last. */
export function TraceList({ run, index, view }: TraceListProps) {
  if (index < 0) return null;
  return (
    <ol className="agents-trace" aria-label="Steps so far">
      {run.steps.slice(0, index + 1).map((step, stepIndex) => (
        <li key={step.id} className={stepIndex === index ? "is-current" : ""}>
          <span className="agents-trace-number" aria-hidden>
            {stepIndex + 1}
          </span>
          <div>
            <p className="agents-trace-title">
              {step.title} <KindTag kind={step.kind} />
            </p>
            <StepBody step={step} view={view} />
          </div>
        </li>
      ))}
    </ol>
  );
}
