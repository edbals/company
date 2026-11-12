import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Chip, CompanyAvatar } from "../marketing/primitives";
import { SIGN_IN_PATH } from "../marketing/content";
import type { DemoAction, DemoState } from "./demo-state";

interface EndStepProps {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
}

export function WorkingStep({ state }: Pick<EndStepProps, "state">) {
  return (
    <>
      <p className="demo-bubble demo-bubble--you">{state.words}</p>
      <p className="demo-status" role="status">
        The helpers are working on it…
      </p>
    </>
  );
}

export function ErrorStep({ state, dispatch }: EndStepProps) {
  return (
    <>
      <p role="alert">{state.error}</p>
      <div className="demo-actions">
        <button className="m-button m-button--amber" onClick={() => dispatch({ type: "retry" })}>
          Try again
        </button>
        <button className="m-button m-button--ghost" onClick={() => dispatch({ type: "again" })}>
          Ask something else
        </button>
      </div>
    </>
  );
}

export function ReminderStep({ state, dispatch }: EndStepProps) {
  const outcome = state.result?.outcome;
  if (outcome?.kind !== "reminder") return null;
  const { helper } = state.profile;
  return (
    <>
      <p className="demo-bubble">{state.result?.reply}</p>
      <div className="demo-card">
        <Chip>Reminder</Chip>
        <h3 className="m-h3">{outcome.title}</h3>
        <p>{outcome.when}</p>
      </div>
      <div className="demo-actions">
        <button
          className="m-button m-button--amber"
          onClick={() => dispatch({ type: "reminder", yes: true })}
        >
          Yes, remind me
        </button>
        {outcome.helperRequest && helper && (
          <button
            className="m-button m-button--ghost"
            onClick={() => dispatch({ type: "askHelper" })}
          >
            Also ask {helper.name}
          </button>
        )}
        <button
          className="m-button m-button--ghost"
          onClick={() => dispatch({ type: "reminder", yes: false })}
        >
          No, thanks
        </button>
      </div>
    </>
  );
}

export function BlockedStep({ state, dispatch }: EndStepProps) {
  const outcome = state.result?.outcome;
  if (outcome?.kind !== "blocked") return null;
  return (
    <>
      <Chip Icon={ShieldCheck}>Rules, not AI</Chip>
      <p className="demo-bubble">{state.result?.reply}</p>
      <p>{outcome.reason}</p>
      <div className="demo-actions">
        <button
          className="m-button m-button--amber"
          onClick={() => dispatch({ type: "reminder", yes: true })}
        >
          {outcome.alternative}
        </button>
        <button
          className="m-button m-button--ghost"
          onClick={() => dispatch({ type: "reminder", yes: false })}
        >
          No, thanks
        </button>
      </div>
    </>
  );
}

function finishNote(state: DemoState): string {
  if (state.memory === "kept") return state.plan?.memory ? `Kept: ${state.plan.memory}` : "Kept.";
  if (state.memory === "skipped") return "Skipped. You choose what stays.";
  if (state.plan) return "Your plan is set, in this demo.";
  return state.reminder ? "That’s how a reminder would look." : "No problem. Your choice.";
}

export function FinishStep({ state, dispatch }: EndStepProps) {
  return (
    <>
      <CompanyAvatar size="lg" mode="greet" />
      <p>{finishNote(state)}</p>
      <p>A little help. You stay in charge.</p>
      <button className="m-button m-button--amber" onClick={() => dispatch({ type: "again" })}>
        Plan something else
      </button>
      <Link to={SIGN_IN_PATH} search={{}} className="m-button m-button--ghost">
        Sign in to use it for real
      </Link>
    </>
  );
}
