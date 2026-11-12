import { useReducer } from "react";
import { Check, Lock, RotateCcw, Send } from "lucide-react";
import { Band, ExampleNote, PhoneFrame, SectionHeading, Switch } from "../primitives";
import "./FamilyView.css";
import { Blob } from "./Decor";

type ShareKey = "plans" | "errands" | "outings";
type RequestStatus = "none" | "sent" | "yes" | "no";

interface FamilyState {
  shares: Readonly<Record<ShareKey, boolean>>;
  request: RequestStatus;
}
type FamilyAction =
  | { type: "share"; key: ShareKey; value: boolean }
  | { type: "send" }
  | { type: "answer"; answer: "yes" | "no" }
  | { type: "reset" };

export const INITIAL_FAMILY_STATE: FamilyState = {
  shares: { plans: true, errands: false, outings: false },
  request: "none",
};

export function familyReducer(state: FamilyState, action: FamilyAction): FamilyState {
  switch (action.type) {
    case "share":
      return { ...state, shares: { ...state.shares, [action.key]: action.value } };
    case "send":
      return state.request === "none" ? { ...state, request: "sent" } : state;
    case "answer":
      return state.request === "sent" ? { ...state, request: action.answer } : state;
    case "reset":
      return INITIAL_FAMILY_STATE;
  }
}

interface ShareRow {
  key: ShareKey;
  label: string;
  update: string;
}
const SHARE_ROWS: readonly ShareRow[] = [
  {
    key: "plans",
    label: "Share my plans",
    update: "Joe is planning: Jazz at the Lakeside Café, Thursday 2:00 pm",
  },
  { key: "errands", label: "Share my errands", update: "Joe needs milk and bread by tomorrow" },
  { key: "outings", label: "Share my outings", update: "Joe went to the jazz on Thursday" },
];
const LOCKED_ROWS: readonly string[] = ["My conversations", "What Company remembers"];

interface Point {
  title: string;
  body: string;
}
/** Rewritten with Gemini; all three are must-know for judges, most important first. */
const POINTS: readonly Point[] = [
  {
    title: "Joe’s plans, Joe’s choice",
    body: "Family can accept or decline a request. They can’t change Joe’s plans.",
  },
  {
    title: "Clear requests, one tap",
    body: "Family gets exactly what’s needed, when and where, and answers in one tap.",
  },
  {
    title: "Joe controls sharing",
    body: "Joe chooses what family sees. His conversations and memories stay private.",
  },
];

const JOE_STATUS: Readonly<Record<Exclude<RequestStatus, "none">, string>> = {
  sent: "Request sent to Maya",
  yes: "Maya said yes",
  no: "Maya can’t make it. Company will offer other options.",
};

type Dispatch = (action: FamilyAction) => void;

function JoePhone({ state, dispatch }: { state: FamilyState; dispatch: Dispatch }) {
  return (
    <PhoneFrame label="Joe’s phone" who="Joe">
      <h3 className="m-h3 family-phone-title">What family can see</h3>
      <ul className="family-rows">
        {SHARE_ROWS.map((row) => (
          <li key={row.key} className="family-row">
            <span>{row.label}</span>
            <Switch
              label={row.label}
              checked={state.shares[row.key]}
              onChange={(value) => dispatch({ type: "share", key: row.key, value })}
            />
          </li>
        ))}
        {LOCKED_ROWS.map((label) => (
          <li key={label} className="family-row family-row--locked">
            <span>
              {label}
              <small className="family-never">
                <Lock size={17} aria-hidden /> Never shared
              </small>
            </span>
          </li>
        ))}
      </ul>
      {state.request === "none" ? (
        <button
          type="button"
          className="m-button m-button--dark family-ask"
          onClick={() => dispatch({ type: "send" })}
        >
          <Send size={18} aria-hidden /> Ask Maya for a lift on Thursday
        </button>
      ) : (
        <p className="family-status" role="status">
          <Check size={18} aria-hidden /> {JOE_STATUS[state.request]}
        </p>
      )}
    </PhoneFrame>
  );
}

function RequestCard({ state, dispatch }: { state: FamilyState; dispatch: Dispatch }) {
  if (state.request === "none") return null;
  return (
    <div className="m-card m-card--paper family-request">
      <p>Joe asks: “Can you drive me on Thursday? Pick-up 1:30 pm.”</p>
      {state.request === "sent" ? (
        <div className="family-request-actions">
          <button
            type="button"
            className="m-button m-button--amber m-button--small"
            onClick={() => dispatch({ type: "answer", answer: "yes" })}
          >
            Yes, I can
          </button>
          <button
            type="button"
            className="m-button m-button--light m-button--small"
            onClick={() => dispatch({ type: "answer", answer: "no" })}
          >
            Can’t make it
          </button>
        </div>
      ) : (
        <p className="family-answer">
          {state.request === "yes" ? "You said yes." : "You said you can’t."}
        </p>
      )}
    </div>
  );
}

function MayaPhone({ state, dispatch }: { state: FamilyState; dispatch: Dispatch }) {
  const updates = SHARE_ROWS.filter((row) => state.shares[row.key]);
  return (
    <PhoneFrame label="Maya’s phone (Joe’s daughter)" who="Maya · his daughter">
      <h3 className="m-h3 family-phone-title">Joe’s updates</h3>
      <div data-testid="family-feed" aria-live="polite" className="family-feed">
        {updates.length === 0 ? (
          <p className="m-small family-empty">Nothing shared right now.</p>
        ) : (
          <ul className="family-rows">
            {updates.map((row) => (
              <li key={row.key} className="m-card m-card--paper family-update">
                {row.update}
              </li>
            ))}
          </ul>
        )}
        <RequestCard state={state} dispatch={dispatch} />
      </div>
    </PhoneFrame>
  );
}

export function FamilyView() {
  const [state, dispatch] = useReducer(familyReducer, INITIAL_FAMILY_STATE);
  return (
    <Band id="family" labelledBy="family-title" className="family">
      <SectionHeading
        id="family-title"
        eyebrow="For family"
        title="Family helps."
        accent="Joe stays in charge."
        lead="Joe’s daughter, Maya, sees only what he chooses to share, and gets one clear request instead of a week of worrying."
      />
      <div className="family-phones">
        <Blob variant="c" className="family-blob family-blob--maya" />
        <img
          className="family-portrait family-portrait--maya"
          src="/illustrations/maya.svg"
          alt=""
          aria-hidden="true"
          width="240"
          height="324"
        />
        <div className="family-joe">
          <JoePhone state={state} dispatch={dispatch} />
          <div className="family-joe-portrait" aria-hidden="true">
            <Blob variant="a" className="family-blob--joe" />
            <img src="/illustrations/joe.svg" alt="" width="240" height="324" />
          </div>
        </div>
        <span
          className={`family-connector ${state.request === "sent" ? "is-flowing" : ""}`}
          aria-hidden
        />
        <MayaPhone state={state} dispatch={dispatch} />
      </div>
      <div className="family-tools">
        <button
          type="button"
          className="m-button m-button--ghost"
          onClick={() => dispatch({ type: "reset" })}
        >
          <RotateCcw size={18} aria-hidden /> Reset example
        </button>
      </div>
      <ul className="family-points">
        {POINTS.map((point) => (
          <li key={point.title} className="m-card m-card--paper">
            <h3 className="m-h3">{point.title}</h3>
            <p className="m-body">{point.body}</p>
          </li>
        ))}
      </ul>
      <ExampleNote />
    </Band>
  );
}
