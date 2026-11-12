import { useEffect, useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { SCENARIOS, buildRun } from "../agent-run";
import type { Run, RunStep, ScenarioId } from "../agent-run";
import { useStepPlayer } from "../hooks";
import { Band, ExampleNote, SectionHeading, Segmented } from "../primitives";
import { TraceList } from "./TracePanel";
import type { TraceView } from "./TracePanel";
import "./AgentsAtWork.css";

const STOPS = [
  "Joe says what he wants",
  "Helpers work together",
  "Rules check the plan",
  "Joe says yes or no",
] as const;
const UNDO_MS = 10_000;
const SCENARIO_OPTIONS = SCENARIOS.map((s) => ({ value: s.id, label: s.label }));
const VIEW_OPTIONS = [
  { value: "plain", label: "In words" },
  { value: "technical", label: "In code" },
] as const;

function stopFor(stepId: string): number {
  if (stepId === "checkin") return 0;
  if (["specialists", "routing", "coordinator"].includes(stepId)) return 1;
  if (stepId === "checks" || stepId === "blocked") return 2;
  return 3;
}

export type StopState = "idle" | "active" | "done" | "skipped" | "blocked";

/** Four story stages; skipped helpers never appear to have worked. */
export function stopStates(run: Run, index: number): StopState[] {
  const step = run.steps[index];
  if (!step) return STOPS.map(() => "idle");
  const current = stopFor(step.id);
  const blockedAt = run.steps.findIndex((s) => s.id === "blocked");
  return STOPS.map((_, i) => {
    if (i === 1 && run.skipped.includes("coordinator")) return "skipped";
    if (i === 2 && blockedAt !== -1 && index >= blockedAt) return "blocked";
    if (i < current || index === run.steps.length - 1) return "done";
    return i === current ? "active" : "idle";
  });
}

function AgentJob({ name, job }: { name: string; job: string }) {
  return (
    <p className="agents-job">
      <strong>{job}</strong>
      <span>{name}</span>
    </p>
  );
}

function Story({ run, index }: { run: Run; index: number }) {
  const states = stopStates(run, index);
  const skipsHelpers = run.skipped.includes("coordinator");
  return (
    <ol className="agents-story" aria-label="From Joe’s request to his decision">
      {STOPS.map((title, i) => (
        <li
          className="agents-stop"
          key={title}
          data-testid={`stop-${i}`}
          data-state={states[i]}
          aria-current={states[i] === "active" ? "step" : undefined}
        >
          <span className="agents-number" aria-hidden="true">
            {i + 1}
          </span>
          <h3>{i === 3 && run.decisionStep === null ? "Joe gets a clear answer" : title}</h3>
          {i === 0 && (
            <>
              <blockquote>“{run.scenario.said}”</blockquote>
              <AgentJob name="Check-in" job="Listens to Joe" />
            </>
          )}
          {i === 1 && (
            <>
              <p className="agents-stage-note">
                {skipsHelpers
                  ? "Not needed for this request."
                  : "These three work at the same time:"}
              </p>
              <div className="agents-parallel">
                <AgentJob name="Outings" job="Finds the show" />
                <AgentJob name="Rides" job="Finds a way there" />
                <AgentJob name="Family circle" job="Prepares a family request" />
              </div>
              <AgentJob name="Coordinator" job="Puts the plan together" />
            </>
          )}
          {i === 2 && (
            <>
              <p>Checks safety, cost and timing.</p>
              <strong className="agents-rule-label">Rules in code, not AI.</strong>
              {states[i] === "blocked" && <p>Stopped: Company can’t arrange medicine.</p>}
            </>
          )}
          {i === 3 && (
            <>
              <p>
                {run.decisionStep === null
                  ? "No plan to approve. Nothing sent."
                  : "Nothing booked or sent without Joe’s yes. Then 10 seconds to undo."}
              </p>
              <AgentJob
                name="Memory keeper"
                job={
                  run.skipped.includes("memory")
                    ? "Not needed for this request"
                    : "Asks what to remember"
                }
              />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

function progressCopy(step: RunStep | undefined, undone: boolean): { title: string; text: string } {
  switch (step?.id) {
    case "checkin":
      return {
        title: "First, listen to Joe.",
        text: "Check-in works out what he wants help with.",
      };
    case "specialists":
      return {
        title: "Three helpers work at once.",
        text: "A show, a way there and a family request — ready to put together.",
      };
    case "coordinator":
      return {
        title: "Put the suggestions into one plan.",
        text: "Coordinator uses only the options the helpers found.",
      };
    case "routing":
      return {
        title: "Keep a simple request simple.",
        text: "No outing to plan, so these four helpers aren’t needed.",
      };
    case "checks":
      return {
        title: "Check before asking Joe.",
        text: "Rules check what’s allowed, what it costs and whether the times work.",
      };
    case "blocked":
      return {
        title: "The medicine rule stops this request.",
        text: "Company can’t arrange medicines.",
      };
    case "told":
      return {
        title: "Stopped. Nothing ordered or sent.",
        text: "Company can’t arrange medicines. Please speak to your pharmacy.",
      };
    case "decision":
      return {
        title: undone ? "Joe’s yes was undone." : "The plan is ready. Joe decides.",
        text: "Try Joe’s yes below. This is only an example.",
      };
    case "lock":
      return {
        title: "Joe said yes. 10 seconds to undo.",
        text: "This example hasn’t booked or sent anything.",
      };
    case "memory":
      return {
        title: "Example complete. Joe stays in control.",
        text:
          step.screen.type === "memory" && step.screen.proposal
            ? `Memory keeper would ask: “Remember that ${step.screen.proposal.toLowerCase()}?” Joe can say no.`
            : "Memory keeper has nothing to remember from this errand.",
      };
    default:
      return {
        title: "See how Joe’s request becomes a plan.",
        text: "Start the example. It will stop for Joe’s yes.",
      };
  }
}

export function AgentsAtWork() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("jazz");
  const [view, setView] = useState<TraceView>("plain");
  const [undone, setUndone] = useState(false);
  const run = useMemo(() => buildRun(scenarioId), [scenarioId]);
  const holdAt = useMemo(
    () => [run.decisionStep, run.undoStep].filter((step): step is number => step !== null),
    [run],
  );
  const { index, done, play, reset, jump } = useStepPlayer(run.steps.length, {
    stepMs: 1500,
    holdAt,
  });

  // Undo lasts the full ten seconds, including when reduced motion skips the animation.
  useEffect(() => {
    if (index !== run.undoStep) return;
    const timer = window.setTimeout(() => jump(run.steps.length - 1), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [index, run, jump]);

  const chooseScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setUndone(false);
    reset();
  };
  const step = run.steps[index];
  const copy = progressCopy(step, undone);
  const awaitingYes = index === run.decisionStep;
  const canUndo = index === run.undoStep;
  const plan = awaitingYes && step?.screen.type === "plan" ? step.screen : null;
  const buttonLabel = done
    ? "Replay example"
    : index < 0
      ? "Start Joe’s example"
      : awaitingYes
        ? "Joe says yes (example)"
        : canUndo
          ? "Undo Joe’s yes"
          : "Show the result";
  const onAction = () => {
    if (canUndo && run.decisionStep !== null) {
      setUndone(true);
      jump(run.decisionStep);
    } else if (index >= 0 && !done && !awaitingYes) {
      jump(run.decisionStep ?? run.steps.length - 1);
    } else {
      setUndone(false);
      play();
    }
  };

  return (
    <Band id="agents" labelledBy="agents-title" stage className="agents">
      <SectionHeading
        id="agents-title"
        eyebrow="Watch the agents work"
        title="One request."
        accent="A plan Joe can say yes to."
        lead="Six AI agents turn Joe’s request into a plan, checked by rules and approved by Joe."
      />
      <Story run={run} index={index} />
      <div className="agents-result">
        <div className="agents-result-copy">
          <div role="status" aria-atomic="true">
            <h3>{copy.title}</h3>
            <p>{copy.text}</p>
          </div>
          {plan && (
            <div className="agents-plan" aria-label="Joe’s example plan">
              <h4>{plan.title}</h4>
              <p>{plan.when}</p>
              <ul>
                {plan.rows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button type="button" className="m-button m-button--amber" onClick={onAction}>
          {index < 0 && <Play size={20} aria-hidden="true" />}
          {done && <RotateCcw size={20} aria-hidden="true" />}
          {buttonLabel}
        </button>
      </div>
      <ExampleNote />
      <details className="agents-details">
        <summary>See how it works</summary>
        <p>Try another request, then start the example.</p>
        <Segmented
          label="Choose a request"
          options={SCENARIO_OPTIONS}
          value={scenarioId}
          onChange={chooseScenario}
        />
        <Segmented label="Trace detail" options={VIEW_OPTIONS} value={view} onChange={setView} />
        {index < 0 ? (
          <p>The steps will appear here when you start.</p>
        ) : (
          <TraceList run={run} index={index} view={view} />
        )}
      </details>
    </Band>
  );
}
