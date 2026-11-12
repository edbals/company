// Small, text-light pieces of the real app, drawn in HTML/CSS. Everything here is decorative
// (aria-hidden): the page's own sentences carry the meaning. Styled to match the landing page.
import { Check, CalendarDays, Car, Lock, Mic, Undo2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { CompanyAvatar } from "../primitives";

function Mock({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`why-mock ${className}`.trim()} aria-hidden>
      {children}
    </div>
  );
}

function Bubble({ me = false, children }: { me?: boolean; children: ReactNode }) {
  return <p className={`why-bubble ${me ? "why-bubble--me" : ""}`.trim()}>{children}</p>;
}

function PlanCard({ ready = false }: { ready?: boolean }) {
  return (
    <div className="why-plan">
      <p className="why-plan-kicker">
        <CalendarDays size={17} aria-hidden /> Plan to review
      </p>
      <p className="why-plan-title m-serif">Jazz with Walt</p>
      <p className="why-plan-line">Thursday, 2 pm</p>
      <p className="why-plan-line">
        <Car size={17} aria-hidden /> Lift from Maya, if she says yes
      </p>
      {ready && (
        <p className="why-yes">
          <Check size={18} aria-hidden /> Yes, go ahead
        </p>
      )}
    </div>
  );
}

const JOBS = [
  "Find a show",
  "Check dates",
  "Ask for a lift",
  "Parking?",
  "Call Walt",
  "Doors open?",
  "Check weather",
  "Message Maya",
  "Lunch spot",
  "Times",
  "Directions",
] as const;

/** 1. Eleven small jobs, then one calm plan. */
export function JobsToPlan() {
  return (
    <Mock className="why-jobs">
      <div className="why-jobs-pile">
        {JOBS.map((job, i) => (
          <span
            key={job}
            className="why-job"
            style={{ "--tilt": `${((i * 7) % 9) - 4}deg` } as CSSProperties}
          >
            {job}
          </span>
        ))}
      </div>
      <span className="why-jobs-arrow">→</span>
      <PlanCard ready />
    </Mock>
  );
}

function MiniPhone({
  who,
  avatar,
  children,
}: {
  who: string;
  avatar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="why-phone">
      <div className="why-phone-who">
        {avatar ?? <span className="why-phone-initial">{who.charAt(0)}</span>}
        {who}
      </div>
      <div className="why-phone-body">{children}</div>
    </div>
  );
}

/** 2. Joe's phone: talks to Company. */
export function JoePhone() {
  return (
    <Mock>
      <MiniPhone who="Company" avatar={<CompanyAvatar size="sm" />}>
        <Bubble me>Jazz with Walt on Thursday?</Bubble>
        <Bubble>I found a show. Shall I ask Maya for a lift?</Bubble>
        <p className="why-phone-mic">
          <Mic size={18} aria-hidden /> Tap to talk
        </p>
      </MiniPhone>
    </Mock>
  );
}

/** 2. Maya's phone: only what Joe chose to share. */
export function MayaPhone() {
  return (
    <Mock>
      <MiniPhone who="Maya">
        <Bubble>Dad is going out Thursday. Can you give him a lift?</Bubble>
        <div className="why-reply">
          <span className="why-reply-yes">Yes</span>
          <span className="why-reply-no">Not this time</span>
        </div>
      </MiniPhone>
    </Mock>
  );
}

/** 3. The three steps as the app flow. */
export function StepTell() {
  return (
    <Mock className="why-flow-card">
      <Bubble me>Jazz with Walt on Thursday?</Bubble>
      <Bubble>On it.</Bubble>
    </Mock>
  );
}
export function StepPlan() {
  return (
    <Mock className="why-flow-card">
      <PlanCard />
    </Mock>
  );
}
export function StepDecide() {
  return (
    <Mock className="why-flow-card why-flow-card--center">
      <p className="why-yes why-yes--big">
        <Check size={22} aria-hidden /> Yes, go ahead
      </p>
      <p className="why-undo">
        <Undo2 size={17} aria-hidden /> Change my mind
      </p>
    </Mock>
  );
}

/** 4. One small glyph per interaction choice. */
function GlyphBigButtons() {
  return (
    <>
      <p className="why-big-q">Which day suits you?</p>
      <div className="why-big-row">
        <span className="why-big-btn">Thursday</span>
        <span className="why-big-btn">Friday</span>
      </div>
    </>
  );
}
function GlyphYesUndo() {
  return (
    <>
      <p className="why-yes why-yes--big">
        <Check size={22} aria-hidden /> Yes, go ahead
      </p>
      <p className="why-undo">
        <Undo2 size={17} aria-hidden /> Undo
      </p>
    </>
  );
}
function GlyphPrivacy() {
  return (
    <div className="why-toggle-row">
      <Lock size={20} aria-hidden />
      <span>Share with Maya</span>
      <span className="why-toggle" />
    </div>
  );
}
function GlyphRide() {
  return (
    <div className="why-ride">
      <p className="why-ride-head">
        <Car size={18} aria-hidden /> Ride cancelled
      </p>
      <div className="why-big-row">
        <span className="why-big-btn">Ask Walt</span>
        <span className="why-big-btn">New time</span>
      </div>
    </div>
  );
}
const STOPS = ["Listen", "Specialists", "Combine", "Check", "You decide"] as const;
function GlyphAgents() {
  return (
    <ol className="why-stops">
      {STOPS.map((stop, i) => (
        <li key={stop} className={i === STOPS.length - 1 ? "is-last" : ""}>
          <span className="why-stop-dot" />
          {stop}
        </li>
      ))}
    </ol>
  );
}

const GLYPHS = [GlyphBigButtons, GlyphYesUndo, GlyphPrivacy, GlyphRide, GlyphAgents] as const;
export function ChoiceGlyph({ index }: { index: number }) {
  const Glyph = GLYPHS[index];
  if (!Glyph) return null;
  return (
    <Mock className="why-glyph">
      <Glyph />
    </Mock>
  );
}

/** 5. The bear says goodbye to the day. */
export function BearSendOff() {
  return (
    <Mock className="why-sendoff">
      <CompanyAvatar size="lg" className="why-finale-bear" />
      <p className="why-bubble why-sendoff-bubble">Have a lovely afternoon.</p>
    </Mock>
  );
}
