import { useCallback, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { SiteHeader } from "../marketing/SiteHeader";
import { CompanyAvatar, ExampleNote, Eyebrow, PhoneFrame } from "../marketing/primitives";
import { AskStep } from "./AskStep";
import { BehindScenes } from "./BehindScenes";
import { BlockedStep, ErrorStep, FinishStep, ReminderStep, WorkingStep } from "./EndSteps";
import { Onboarding } from "./Onboarding";
import { FamilyStep, MemoryStep, PlanStep, QuestionStep, UndoStep } from "./PlanSteps";
import { OptionsStep } from "./OptionsStep";
import { STAGES, firstName, stageOf } from "./demo-state";
import type { DemoAction, DemoState, Screen } from "./demo-state";
import { useDemo } from "./use-demo";
import "../marketing/landing.css";
import "./demo.css";

const HEADINGS: Readonly<Record<Screen, string>> = {
  name: "Nice to meet you",
  helper: "Your people",
  likes: "What you enjoy",
  ask: "Tell Company",
  working: "The team is on it",
  error: "That didn’t work",
  options: "Pick one",
  question: "One question",
  plan: "Your plan",
  undo: "Time to change your mind",
  family: "Their side",
  memory: "Remember?",
  reminder: "A little reminder",
  blocked: "Let’s keep this safe",
  finish: "That’s Company.",
};

interface ScreenProps {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
}

function CurrentStep({ state, dispatch }: ScreenProps) {
  const { plan } = state;
  switch (state.screen) {
    case "name":
    case "helper":
    case "likes":
      return <Onboarding state={state} dispatch={dispatch} />;
    case "ask":
      return <AskStep state={state} dispatch={dispatch} />;
    case "working":
      return <WorkingStep state={state} />;
    case "error":
      return <ErrorStep state={state} dispatch={dispatch} />;
    case "options":
      return <OptionsStep state={state} dispatch={dispatch} />;
    case "question":
      return <QuestionStep state={state} dispatch={dispatch} />;
    case "plan":
      return plan && <PlanStep state={state} plan={plan} dispatch={dispatch} />;
    case "undo":
      return <UndoStep state={state} dispatch={dispatch} />;
    case "family":
      return <FamilyStep state={state} dispatch={dispatch} />;
    case "memory":
      return plan && <MemoryStep plan={plan} dispatch={dispatch} />;
    case "reminder":
      return <ReminderStep state={state} dispatch={dispatch} />;
    case "blocked":
      return <BlockedStep state={state} dispatch={dispatch} />;
    case "finish":
      return <FinishStep state={state} dispatch={dispatch} />;
  }
}

interface PhoneProps extends ScreenProps {
  /** True once the visitor has pressed something; restoring a saved profile doesn't count. */
  hasActed: boolean;
}

function Phone({ state, dispatch, hasActed }: PhoneProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const helper = state.screen === "family" ? state.profile.helper : null;
  const owner = state.profile.name ? `${firstName(state.profile)}’s phone` : "Your phone";
  useEffect(() => {
    // Only move focus after the visitor acts, so the page doesn't jump past the intro on load.
    if (!hasActed) return;
    // Text screens put the cursor in their box; the others announce their heading.
    const field = heading.current?.parentElement?.querySelector<HTMLElement>("[data-autofocus]");
    (field ?? heading.current)?.focus();
  }, [state.screen, hasActed]);
  return (
    <PhoneFrame
      key={helper ? "helper" : "you"}
      label={helper ? `${helper.name}’s phone` : owner}
      who={helper ? `${helper.name}${helper.relation ? ` · ${helper.relation}` : ""}` : "Company"}
      avatar={helper ? undefined : <CompanyAvatar size="sm" />}
      className={helper ? "demo-phone demo-phone--maya" : "demo-phone"}
    >
      <ExampleNote>Nothing here is booked, sent or saved.</ExampleNote>
      <div key={state.screen} className="demo-step">
        <h2 ref={heading} tabIndex={-1} className="m-h3 demo-step-heading">
          {HEADINGS[state.screen]}
        </h2>
        <CurrentStep state={state} dispatch={dispatch} />
      </div>
    </PhoneFrame>
  );
}

export function DemoPage() {
  const [state, rawDispatch] = useDemo();
  const acted = useRef(false);
  const dispatch = useCallback(
    (action: DemoAction) => {
      acted.current = true;
      rawDispatch(action);
    },
    [rawDispatch],
  );
  const stage = stageOf(state.screen);
  const label = `Step ${stage + 1} of ${STAGES.length}: ${STAGES[stage]}`;
  return (
    <div className="marketing demo">
      <a className="m-skip" href="#demo-main">
        Skip to demo
      </a>
      <SiteHeader current="demo" />
      <main id="demo-main" className="m-container demo-main" tabIndex={-1}>
        <div className="demo-progress-row">
          <div className="demo-progress">
            <label htmlFor="demo-progress">{label}</label>
            <progress id="demo-progress" value={stage + 1} max={STAGES.length} />
          </div>
          <button
            className="m-button m-button--ghost"
            onClick={() => dispatch({ type: state.profile.name ? "again" : "reset" })}
          >
            <RotateCcw size={20} aria-hidden />
            Start over
          </button>
        </div>
        <div className="demo-intro">
          <Eyebrow>Try Company</Eyebrow>
          <h1 className="m-h2">Ask for anything. Watch it get planned.</h1>
          <p>Real AI planning with sample local events. Nothing is booked, sent or saved.</p>
        </div>
        <p className="m-visually-hidden" aria-live="polite" aria-atomic="true">
          {label}. {HEADINGS[state.screen]}
        </p>
        <div className="demo-layout">
          <Phone state={state} dispatch={dispatch} hasActed={acted.current} />
          <BehindScenes state={state} />
        </div>
      </main>
    </div>
  );
}
