import { useEffect, useState } from "react";
import { Check, Circle, ShieldCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENTS } from "../marketing/content";
import { usePrefersReducedMotion } from "../marketing/hooks";
import type { AgentStepId, TraceStep } from "@/lib/demo-plan";
import type { DemoState } from "./demo-state";

interface Helper {
  id: AgentStepId;
  name: string;
  role: string;
  Icon: LucideIcon;
}
const SAFETY: Helper = {
  id: "safety",
  name: "Safety checks",
  role: "Checks cost, timing and what Company may never do.",
  Icon: ShieldCheck,
};
const HELPERS: readonly Helper[] = [
  ...AGENTS.filter((agent) => agent.id !== "memory"),
  SAFETY,
  ...AGENTS.filter((agent) => agent.id === "memory"),
];
/** While waiting for the server: Check-in, then the three specialists together, then the rest. */
const WAVES: readonly (readonly AgentStepId[])[] = [
  ["checkin"],
  ["outings", "rides", "family"],
  ["coordinator"],
  ["safety"],
];
const WAVE_MS = 900;

type Status = "Waiting" | "Working" | "Done" | "Not needed" | "Stopped";
const FROM_TRACE: Readonly<Record<TraceStep["status"], Status>> = {
  done: "Done",
  skipped: "Not needed",
  blocked: "Stopped",
};

function useWave(active: boolean): number {
  const reduced = usePrefersReducedMotion();
  const [wave, setWave] = useState(0);
  useEffect(() => {
    setWave(0);
    if (!active || reduced) return;
    const timer = window.setInterval(
      () => setWave((current) => Math.min(current + 1, WAVES.length - 1)),
      WAVE_MS,
    );
    return () => window.clearInterval(timer);
  }, [active, reduced]);
  return wave;
}

function statusOf(
  id: AgentStepId,
  state: DemoState,
  wave: number,
): { status: Status; line: string | null } {
  if (state.screen === "working") {
    const index = WAVES.findIndex((ids) => ids.includes(id));
    if (index < 0) return { status: "Waiting", line: null };
    return { status: index <= wave ? "Working" : "Waiting", line: null };
  }
  const step = state.result?.steps.find((item) => item.agent === id);
  if (!step) return { status: "Waiting", line: null };
  return { status: FROM_TRACE[step.status], line: step.line };
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "Done") return <Check size={22} aria-hidden />;
  if (status === "Stopped") return <X size={22} aria-hidden />;
  return <Circle size={18} aria-hidden />;
}

export function BehindScenes({ state }: { state: DemoState }) {
  const [open, setOpen] = useState(false);
  const wave = useWave(state.screen === "working");
  const source = state.result?.source;
  return (
    <aside className="demo-behind" aria-labelledby="demo-behind-title" data-open={open}>
      <h2 id="demo-behind-title" className="m-h3">
        Behind the scenes
      </h2>
      <button
        type="button"
        className="demo-behind-toggle"
        aria-expanded={open}
        aria-controls="demo-helper-list"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide the helpers" : "What are the helpers doing?"}
      </button>
      <div id="demo-helper-list" className="demo-behind-body">
        <p className="demo-panel-note">
          {source === "ready"
            ? "Quick plan (AI resting): a simple keyword planner answered."
            : source === "rules"
              ? "Stopped by fixed rules before any AI was asked."
              : "Six AI agents and fixed safety rules."}
        </p>
        <ul className="demo-helpers">
          {HELPERS.map(({ id, name, role, Icon }) => {
            const { status, line } = statusOf(id, state, wave);
            return (
              <li key={id} data-status={status}>
                <Icon size={24} aria-hidden />
                <div>
                  <strong>{name}</strong>
                  {id === "safety" && <span className="demo-rule">Rules, not AI</span>}
                  <p>{line ?? role}</p>
                  <span className="demo-helper-status">{status}</span>
                </div>
                <StatusIcon status={status} />
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
