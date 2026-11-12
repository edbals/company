import { Check, Lock } from "lucide-react";
import { Chip } from "../marketing/primitives";
import type { DemoPlan } from "@/lib/demo-contract";
import { planReply } from "@/lib/demo-plan";
import { helperRequestOf } from "./demo-state";
import type { DemoAction, DemoState } from "./demo-state";

interface PlanStepProps {
  state: DemoState;
  plan: DemoPlan;
  dispatch: (action: DemoAction) => void;
}

function rideRow(state: DemoState): string {
  const helper = state.profile.helper?.name;
  if (state.ride === "family" && helper) return `Ride: ask ${helper}, if they say yes`;
  if (state.ride === "own_way") return "Ride: your own way";
  return "Ride: not decided. Other rides: Not connected";
}

export function originLabel(plan: DemoPlan): string {
  return plan.origin === "personal" ? "Your plan" : "Sample event";
}

/** When, place (only if there is one) and cost; shared by the plan card and the option cards. */
export function PlanFacts({ plan }: { plan: DemoPlan }) {
  return (
    <>
      <li>{plan.when}</li>
      {plan.place && (
        <li>
          {plan.place}
          {plan.origin === "sample" ? " (sample event)" : ""}
        </li>
      )}
      <li>Cost: {plan.cost}</li>
    </>
  );
}

export function PlanCard({ state, plan }: Omit<PlanStepProps, "dispatch">) {
  return (
    <>
      <div className="demo-card">
        <Chip amber>{originLabel(plan)}</Chip>
        <h3 className="m-h3">{plan.title}</h3>
        <ul>
          <PlanFacts plan={plan} />
          <li>{rideRow(state)}</li>
        </ul>
      </div>
      {plan.notice && (
        <p className="demo-notice" role="note">
          {plan.notice}
        </p>
      )}
    </>
  );
}

/** Company's words for the plan on screen, derived from that plan so text and card always agree. */
function PlanReply({ state }: { state: DemoState }) {
  return state.plan ? <p className="demo-bubble">{planReply(state.plan, state.profile)}</p> : null;
}

export function QuestionStep({ state, dispatch }: Omit<PlanStepProps, "plan">) {
  const helper = state.profile.helper?.name ?? "someone";
  return (
    <>
      <PlanReply state={state} />
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
      {state.ride !== "undecided" || !plan.helperRequest ? <PlanReply state={state} /> : null}
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

export function FamilyStep({ state, dispatch }: Omit<PlanStepProps, "plan">) {
  const helper = state.profile.helper?.name ?? "Your helper";
  return (
    <>
      <div className="demo-card demo-request">
        <p>{helperRequestOf(state)}</p>
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
