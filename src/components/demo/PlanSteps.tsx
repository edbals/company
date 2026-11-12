import { Check, Lock } from "lucide-react";
import { Chip } from "../marketing/primitives";
import type { DemoOutcome } from "@/lib/demo-plan";
import type { DemoAction, DemoState } from "./demo-state";

type PlanOutcome = Extract<DemoOutcome, { kind: "plan" }>;

interface PlanStepProps {
  state: DemoState;
  plan: PlanOutcome;
  dispatch: (action: DemoAction) => void;
}

function rideRow(state: DemoState): string {
  const helper = state.profile.helper?.name;
  if (state.ride === "family" && helper) return `Ride: ask ${helper}, if they say yes`;
  if (state.ride === "own_way") return "Ride: your own way";
  return "Ride: not decided. Other rides: Not connected";
}

export function PlanCard({ state, plan }: Omit<PlanStepProps, "dispatch">) {
  return (
    <div className="demo-card">
      <Chip amber>Suggested plan</Chip>
      <h3 className="m-h3">{plan.title}</h3>
      <ul>
        <li>{plan.when}</li>
        <li>{plan.place} (sample event)</li>
        <li>Cost: {plan.cost}</li>
        <li>{rideRow(state)}</li>
      </ul>
    </div>
  );
}

export function QuestionStep({ state, dispatch }: Omit<PlanStepProps, "plan">) {
  const helper = state.profile.helper?.name ?? "someone";
  return (
    <>
      <p className="demo-bubble">{state.result?.reply}</p>
      <p>One question: should I ask {helper} to drive you?</p>
      <div className="demo-actions">
        <button
          className="m-button m-button--amber"
          onClick={() => dispatch({ type: "ride", ride: "family" })}
        >
          Yes, ask {helper}
        </button>
        <button
          className="m-button m-button--ghost"
          onClick={() => dispatch({ type: "ride", ride: "own_way" })}
        >
          No, I’ll get there myself
        </button>
      </div>
    </>
  );
}

export function PlanStep({ state, plan, dispatch }: PlanStepProps) {
  return (
    <>
      {state.ride !== "undecided" || !plan.helperRequest ? (
        <p className="demo-bubble">{state.result?.reply}</p>
      ) : null}
      <PlanCard state={state} plan={plan} />
      <div className="demo-actions">
        <button className="m-button m-button--amber" onClick={() => dispatch({ type: "confirm" })}>
          Yes, go ahead
        </button>
        <button className="m-button m-button--ghost" onClick={() => dispatch({ type: "again" })}>
          No, try something else
        </button>
      </div>
    </>
  );
}

export function UndoStep({ state, dispatch }: Omit<PlanStepProps, "plan">) {
  const open = state.seconds > 0;
  return (
    <>
      <Chip Icon={Check}>Saved in this demo only</Chip>
      <p>{open ? `You have ${state.seconds} seconds to change your mind.` : "It’s settled."}</p>
      {open ? (
        <button className="m-button m-button--ghost" onClick={() => dispatch({ type: "undo" })}>
          Undo
        </button>
      ) : (
        <button className="m-button m-button--amber" onClick={() => dispatch({ type: "next" })}>
          Next
        </button>
      )}
      <p className="demo-status" role="status">
        {open ? "" : "Undo time is over."}
      </p>
    </>
  );
}

export function FamilyStep({ state, plan, dispatch }: PlanStepProps) {
  const helper = state.profile.helper?.name ?? "Your helper";
  return (
    <>
      <div className="demo-card demo-request">
        <p>{plan.helperRequest}</p>
        {state.accepted ? (
          <p className="demo-status" role="status">
            <Check size={22} aria-hidden /> {helper} said yes.
          </p>
        ) : (
          <button className="m-button m-button--amber" onClick={() => dispatch({ type: "accept" })}>
            Accept
          </button>
        )}
      </div>
      <p className="demo-privacy">
        <Lock size={20} aria-hidden /> {helper} sees this one request, not the chat.
      </p>
      {state.accepted && (
        <button className="m-button m-button--amber" onClick={() => dispatch({ type: "next" })}>
          Next
        </button>
      )}
    </>
  );
}

export function MemoryStep({ plan, dispatch }: Omit<PlanStepProps, "state">) {
  return (
    <>
      <p>The Memory keeper asks:</p>
      <div className="demo-card demo-memory">
        <h3 className="m-h3">Keep this for next time?</h3>
        <p>{plan.memory}</p>
        <div className="demo-memory-actions">
          <button
            className="m-button m-button--amber"
            onClick={() => dispatch({ type: "memory", choice: "kept" })}
          >
            Keep
          </button>
          <button
            className="m-button m-button--ghost"
            onClick={() => dispatch({ type: "memory", choice: "skipped" })}
          >
            Skip
          </button>
        </div>
      </div>
      <p className="demo-privacy">
        <Lock size={20} aria-hidden /> Only you choose what Company remembers.
      </p>
    </>
  );
}
