import { useEffect, useReducer } from "react";
import { Check, Lock, RotateCcw, ShieldOff, Trash2 } from "lucide-react";
import { Band, ExampleNote, SectionHeading } from "../primitives";
import "./SecondBrain.css";

type FactKind = "person" | "like" | "routine" | "limit";
type ProposalId = "jazz" | "routine";
type Decision = "pending" | "kept" | "skipped" | "forgotten";

interface Fact {
  id: string;
  kind: FactKind;
  text: string;
  fromChat: boolean;
}
interface Proposal {
  id: ProposalId;
  kind: FactKind;
  kindLabel: string;
  text: string;
}
export interface BrainState {
  revealed: boolean;
  decisions: Readonly<Record<ProposalId, Decision>>;
  facts: readonly Fact[];
  lastForgotten: ForgottenNotice | null;
}
export interface ForgottenNotice {
  seq: number;
  text: string;
  kind: FactKind;
  index: number;
}
export type BrainAction =
  | { type: "reveal" }
  | { type: "keep"; id: ProposalId }
  | { type: "skip"; id: ProposalId }
  | { type: "forget"; id: string }
  | { type: "clearForgotten"; seq: number }
  | { type: "reset" };

const PROPOSALS: readonly Proposal[] = [
  { id: "jazz", kind: "like", kindLabel: "Likes", text: "You love live jazz" },
  {
    id: "routine",
    kind: "routine",
    kindLabel: "Routines",
    text: "Afternoons work better than evenings",
  },
];

const SEED_FACTS: readonly Fact[] = [
  { id: "walt", kind: "person", text: "Walt is a friend who likes jazz", fromChat: false },
  { id: "gardening", kind: "like", text: "You enjoy gardening", fromChat: false },
  { id: "rides", kind: "limit", text: "Rides up to $25", fromChat: false },
];

const DRAWERS: readonly { kind: FactKind; label: string }[] = [
  { kind: "person", label: "People" },
  { kind: "like", label: "Likes" },
  { kind: "routine", label: "Routines" },
  { kind: "limit", label: "Limits" },
];

const FORGOTTEN_MESSAGE =
  "Forgotten everywhere: memory, activity log, conversation, setup interests";
const FORGOTTEN_MS = 6000;

export const INITIAL_BRAIN: BrainState = {
  revealed: false,
  decisions: { jazz: "pending", routine: "pending" },
  facts: SEED_FACTS,
  lastForgotten: null,
};

function decide(state: BrainState, id: ProposalId, decision: "kept" | "skipped"): BrainState {
  if (state.decisions[id] !== "pending") return state;
  const proposal = PROPOSALS.find((p) => p.id === id);
  if (!proposal) return state;
  const facts =
    decision === "kept"
      ? [...state.facts, { id, kind: proposal.kind, text: proposal.text, fromChat: true }]
      : state.facts;
  return { ...state, facts, decisions: { ...state.decisions, [id]: decision } };
}

function forget(state: BrainState, id: string): BrainState {
  const fact = state.facts.find((f) => f.id === id);
  if (!fact) return state;
  const isProposal = PROPOSALS.some((p) => p.id === id);
  const index = state.facts.filter((f) => f.kind === fact.kind).findIndex((f) => f.id === id);
  const seq = (state.lastForgotten?.seq ?? 0) + 1;
  return {
    ...state,
    facts: state.facts.filter((f) => f.id !== id),
    decisions: isProposal
      ? { ...state.decisions, [id as ProposalId]: "forgotten" }
      : state.decisions,
    lastForgotten: { seq, text: fact.text, kind: fact.kind, index },
  };
}

export function brainReducer(state: BrainState, action: BrainAction): BrainState {
  switch (action.type) {
    case "reveal":
      return { ...state, revealed: true };
    case "keep":
      return decide(state, action.id, "kept");
    case "skip":
      return decide(state, action.id, "skipped");
    case "forget":
      return forget(state, action.id);
    case "clearForgotten":
      return state.lastForgotten?.seq === action.seq ? { ...state, lastForgotten: null } : state;
    case "reset":
      return INITIAL_BRAIN;
  }
}

function nextTimeSentence(decisions: BrainState["decisions"]): string {
  const jazz = decisions.jazz === "kept";
  const routine = decisions.routine === "kept";
  if (jazz && routine) return "Company starts with afternoon jazz.";
  if (routine) return "Company starts with afternoon options.";
  if (jazz) return "Company looks for live jazz first.";
  return "Company asks what time works.";
}

const DECISION_LABEL: Record<Decision, string> = {
  pending: "",
  kept: "Saved",
  skipped: "Skipped",
  forgotten: "Forgotten",
};
const STEPS: readonly string[] = ["Chat", "Choose", "Memory"];

type Dispatch = (action: BrainAction) => void;
interface DispatchProps {
  dispatch: Dispatch;
}

function isAllDecided(state: BrainState): boolean {
  return PROPOSALS.every((p) => state.decisions[p.id] !== "pending");
}

function currentStep(state: BrainState): number {
  if (!state.revealed) return 1;
  return isAllDecided(state) ? 3 : 2;
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="brain-steps" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className="brain-steps-item"
          data-state={i + 1 < step ? "done" : i + 1 === step ? "current" : "todo"}
          aria-current={i + 1 === step ? "step" : undefined}
        >
          <span className="brain-steps-num">{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function Chat({ revealed, dispatch }: DispatchProps & { revealed: boolean }) {
  return (
    <div className="brain-chat">
      <p className="brain-bubble brain-bubble--you">
        <span className="brain-who">Joe</span>
        The jazz was wonderful. Afternoons suit me much better than evenings.
      </p>
      <p className="brain-bubble brain-bubble--co">
        <span className="brain-who">Company</span>I’m glad. Would you like me to remember anything
        from today?
      </p>
      {!revealed && (
        <button
          type="button"
          className="m-button m-button--amber"
          onClick={() => dispatch({ type: "reveal" })}
        >
          See what Company would remember
        </button>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  decision,
  dispatch,
}: DispatchProps & { proposal: Proposal; decision: Decision }) {
  return (
    <li className="brain-proposal" data-decision={decision}>
      <span className="brain-kind">{proposal.kindLabel}</span>
      <p className="brain-proposal-text">{proposal.text}</p>
      {decision === "pending" ? (
        <div className="brain-actions">
          <button
            type="button"
            className="m-button m-button--small m-button--amber"
            aria-label={`Keep: ${proposal.text}`}
            onClick={() => dispatch({ type: "keep", id: proposal.id })}
          >
            Keep
          </button>
          <button
            type="button"
            className="m-button m-button--small m-button--ghost"
            aria-label={`Skip: ${proposal.text}`}
            onClick={() => dispatch({ type: "skip", id: proposal.id })}
          >
            Skip
          </button>
        </div>
      ) : (
        <p className="brain-decision">
          {decision === "kept" && <Check size={20} aria-hidden />}
          {DECISION_LABEL[decision]}
        </p>
      )}
    </li>
  );
}

function Choose({ state, dispatch }: DispatchProps & { state: BrainState }) {
  return (
    <div className="brain-choose">
      {isAllDecided(state) ? (
        <p className="brain-deleted">Conversation deleted — only what Joe kept is saved.</p>
      ) : (
        <p className="brain-summary">Chat: Joe talked about jazz and afternoons.</p>
      )}
      <p className="brain-lead-in">Company would remember:</p>
      <ul className="brain-proposal-list">
        {PROPOSALS.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            decision={state.decisions[p.id]}
            dispatch={dispatch}
          />
        ))}
      </ul>
    </div>
  );
}

function ForgottenNoticeRow() {
  return (
    <li className="brain-forgotten" role="status" aria-live="polite">
      <Check size={20} aria-hidden />
      {FORGOTTEN_MESSAGE}
    </li>
  );
}

function FactRow({
  fact,
  canForget,
  dispatch,
}: DispatchProps & { fact: Fact; canForget: boolean }) {
  return (
    <li className={fact.fromChat ? "brain-fact brain-fact--new" : "brain-fact"}>
      <span className="brain-fact-text">{fact.text}</span>
      {canForget && (
        <button
          type="button"
          className="brain-forget"
          aria-label={`Forget: ${fact.text}`}
          onClick={() => dispatch({ type: "forget", id: fact.id })}
        >
          <Trash2 size={18} aria-hidden />
          Forget
        </button>
      )}
    </li>
  );
}

function Drawer({
  label,
  kind,
  facts,
  canForget,
  notice,
  dispatch,
}: DispatchProps & {
  label: string;
  kind: FactKind;
  facts: readonly Fact[];
  canForget: boolean;
  notice: ForgottenNotice | null;
}) {
  const titleId = `brain-drawer-${label.toLowerCase()}`;
  const noticeIndex = notice && notice.kind === kind ? notice.index : -1;
  const rows = facts.map((fact) => (
    <FactRow key={fact.id} fact={fact} canForget={canForget} dispatch={dispatch} />
  ));
  const withNotice =
    noticeIndex < 0
      ? rows
      : [...rows.slice(0, noticeIndex), <ForgottenNoticeRow key="notice" />, ...rows.slice(noticeIndex)];
  return (
    <section className="brain-drawer" aria-labelledby={titleId}>
      <h4 id={titleId} className="brain-drawer-title">
        {label}
      </h4>
      {facts.length === 0 && <p className="brain-empty">Nothing yet</p>}
      {withNotice.length > 0 && <ul className="brain-facts">{withNotice}</ul>}
    </section>
  );
}

function Memory({ state, dispatch }: DispatchProps & { state: BrainState }) {
  return (
    <div className="brain-memory">
      <h3 className="brain-memory-title">What Company remembers</h3>
      {DRAWERS.map((d) => (
        <Drawer
          key={d.kind}
          label={d.label}
          kind={d.kind}
          facts={state.facts.filter((f) => f.kind === d.kind)}
          canForget={state.revealed}
          notice={state.lastForgotten}
          dispatch={dispatch}
        />
      ))}
    </div>
  );
}

function NextTime({ decisions }: { decisions: BrainState["decisions"] }) {
  return (
    <div className="brain-next" aria-live="polite">
      <p className="brain-next-label">Next time</p>
      <p className="brain-next-text m-serif">{nextTimeSentence(decisions)}</p>
    </div>
  );
}

function Promises() {
  return (
    <ul className="brain-promises">
      <li>
        <ShieldOff size={22} aria-hidden />
        Never kept: health, food, sleep, money.
      </li>
      <li>
        <Lock size={22} aria-hidden />
        Family can’t see this.
      </li>
    </ul>
  );
}

function useForgottenTimeout(notice: ForgottenNotice | null, dispatch: Dispatch) {
  const seq = notice?.seq;
  useEffect(() => {
    if (seq === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: "clearForgotten", seq }), FORGOTTEN_MS);
    return () => window.clearTimeout(timer);
  }, [seq, dispatch]);
}

export function SecondBrain() {
  const [state, dispatch] = useReducer(brainReducer, INITIAL_BRAIN);
  useForgottenTimeout(state.lastForgotten, dispatch);
  return (
    <Band id="second-brain" labelledBy="second-brain-title" stage className="brain">
      <SectionHeading
        id="second-brain-title"
        eyebrow="The second brain"
        title="It remembers what matters to you."
        accent="Only what you agree to keep."
        lead="Company keeps a small, private memory so the next plan fits you better. You approve every item, you can forget any of them, and family never sees it."
      />
      <div className="brain-card">
        <StepIndicator step={currentStep(state)} />
        <div className="brain-stage">
          {state.revealed ? (
            <Choose state={state} dispatch={dispatch} />
          ) : (
            <Chat revealed={state.revealed} dispatch={dispatch} />
          )}
        </div>
        <Memory state={state} dispatch={dispatch} />
        <NextTime decisions={state.decisions} />
        <button
          type="button"
          className="m-button m-button--ghost m-button--small brain-reset"
          onClick={() => dispatch({ type: "reset" })}
        >
          <RotateCcw size={20} aria-hidden />
          Start over
        </button>
      </div>
      <Promises />
      <p className="m-small brain-tech">
        How it works: after a chat, the Memory keeper agent proposes up to three facts. A safety
        filter drops common health, food, sleep and money details before you see it, and the raw
        conversation is deleted once you choose.
      </p>
      <ExampleNote>Example only. These controls don’t change an account.</ExampleNote>
    </Band>
  );
}
