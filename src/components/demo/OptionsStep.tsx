import { Chip } from "../marketing/primitives";
import type { DemoAction, DemoState } from "./demo-state";
import { PlanFacts, originLabel } from "./PlanSteps";

interface OptionsStepProps {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
}

/** Up to three plans to pick from; choosing one continues like a direct plan, with no new call. */
export function OptionsStep({ state, dispatch }: OptionsStepProps) {
  const outcome = state.result?.outcome;
  if (outcome?.kind !== "options") return null;
  return (
    <>
      <p className="demo-bubble">{state.result?.reply}</p>
      {outcome.options.map((plan, index) => (
        <div className="demo-card" key={`${index}-${plan.title}`}>
          <Chip amber>{originLabel(plan)}</Chip>
          <h3 className="m-h3">{plan.title}</h3>
          <ul>
            <PlanFacts plan={plan} />
          </ul>
          <button
            className="m-button m-button--amber"
            aria-label={`Choose this: ${plan.title}`}
            onClick={() => dispatch({ type: "choose", index })}
          >
            Choose this
          </button>
        </div>
      ))}
      <button className="m-button m-button--ghost" onClick={() => dispatch({ type: "again" })}>
        None of these
      </button>
    </>
  );
}
