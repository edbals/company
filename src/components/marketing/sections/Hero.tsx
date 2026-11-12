import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Car,
  Check,
  Lock,
  ShoppingBasket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DEMO_PATH } from "../content";
import { usePrefersReducedMotion, useStepPlayer } from "../hooks";
import { CompanyAvatar, Eyebrow, ExampleNote, PhoneFrame } from "../primitives";
import "./Hero.css";
import { Blob } from "./Decor";

interface PlanRow {
  Icon: LucideIcon;
  text: string;
}
interface HeroGoal {
  id: string;
  /** Completes "Company plans the …". */
  label: string;
  said: string;
  reply: string;
  planTitle: string;
  planWhen: string;
  rows: readonly PlanRow[];
}

const GOALS: readonly HeroGoal[] = [
  {
    id: "jazz",
    label: "jazz afternoon",
    said: "I’d love to hear some live jazz with my friend Walt on Thursday.",
    reply: "Lovely. Here’s a plan to look over.",
    planTitle: "Jazz at the Lakeside Café",
    planWhen: "Thursday · 2:00 pm",
    rows: [
      { Icon: Car, text: "Ride: your daughter Maya drives" },
      { Icon: Bell, text: "Your 2:00 reminder moves to 1:15" },
      { Icon: Users, text: "With your friend Walt" },
    ],
  },
  {
    id: "groceries",
    label: "grocery run",
    said: "I’m out of milk and bread.",
    reply: "Got it. Here’s how that could go.",
    planTitle: "Milk and bread",
    planWhen: "Needed by tomorrow",
    rows: [
      { Icon: Users, text: "Ask your daughter Maya" },
      { Icon: ShoppingBasket, text: "Or get them your own way" },
      { Icon: Lock, text: "Nothing is ordered yet" },
    ],
  },
  {
    id: "visit",
    label: "coffee with Walt",
    said: "I want to see my friend Walt next week.",
    reply: "Good idea. How about this?",
    planTitle: "Coffee with Walt",
    planWhen: "Tuesday · 10:30 am",
    rows: [
      { Icon: Car, text: "Ride: your own way" },
      { Icon: Bell, text: "Reminder at 9:45" },
      { Icon: Lock, text: "Not shared with family" },
    ],
  },
] as const;

const SPECIALISTS = ["Outings", "Rides", "Family circle"] as const;
const ROTATE_MS = 8000;
const STEP_MS = 1100;
/** Phone steps: 0 request, 1 reply + agents working, 2 plan, 3 waiting for a yes. */
const PHONE_STEPS = 4;

export function Hero({ introPlayed = false }: { introPlayed?: boolean }) {
  const [goalIndex, setGoalIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const reducedMotion = usePrefersReducedMotion();
  const { index: step, play, reset } = useStepPlayer(PHONE_STEPS, { stepMs: STEP_MS });
  const goal = GOALS[goalIndex] ?? GOALS[0]!;

  useEffect(() => {
    reset();
    play();
  }, [goalIndex, play, reset]);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(
      () => setGoalIndex((current) => (current + 1) % GOALS.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  return (
    <section
      className="hero m-container"
      aria-labelledby="hero-title"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="hero-copy">
        <Eyebrow>AI planning for older adults</Eyebrow>
        <h1 id="hero-title" className="m-h1 hero-title">
          <span className="hero-intro">
            Company <CompanyAvatar size="inline" mode={introPlayed ? "idle" : "greet"} /> plans the
          </span>{" "}
          <span className="hero-goal" key={goal.id}>
            {goal.label}.
          </span>{" "}
          <span className="hero-yes">You just say yes.</span>
        </h1>
        <p className="m-lead hero-lead">
          Say what you’d like to do. A team of AI agents works out the time, the ride and who to
          ask, then brings one clear plan back to you. Nothing happens until you agree.
        </p>
        <div className="hero-actions">
          <a className="m-button m-button--dark" href="#agents">
            Watch the agents work <ArrowDown size={19} aria-hidden />
          </a>
          <a className="m-button m-button--ghost" href={DEMO_PATH}>
            Try demo <ArrowUpRight size={19} aria-hidden />
          </a>
        </div>
        <a className="m-text-link hero-rationale" href="/rationale">
          Design Rationale <ArrowUpRight size={18} aria-hidden />
        </a>
      </div>

      <div className="hero-stage">
        <div className="hero-glow" aria-hidden />
        <Blob variant="a" className="hero-stage-blob" />
        <PhoneFrame
          label="Example: a request becomes a plan"
          who="Company"
          avatar={<CompanyAvatar size="sm" />}
        >
          {step >= 0 && (
            <p key={`${goal.id}-said`} className="hero-bubble hero-bubble--you m-rise">
              {goal.said}
            </p>
          )}
          {step >= 1 && (
            <p key={`${goal.id}-reply`} className="hero-bubble hero-bubble--company m-rise">
              {goal.reply}
            </p>
          )}
          {step >= 1 && (
            <ul
              key={`${goal.id}-agents`}
              className={`hero-agents m-rise ${step >= 2 ? "is-done" : ""}`}
              aria-label="Agents working on the plan"
            >
              {SPECIALISTS.map((name) => (
                <li key={name}>
                  <span className="hero-agent-dot" aria-hidden>
                    {step >= 2 && <Check size={13} aria-hidden />}
                  </span>
                  {name}
                </li>
              ))}
            </ul>
          )}
          {step >= 2 && (
            <div key={`${goal.id}-plan`} className="hero-plan m-rise">
              <p className="hero-plan-label">
                <CalendarDays size={17} aria-hidden /> Plan to review
              </p>
              <h2 className="m-serif hero-plan-title">{goal.planTitle}</h2>
              <p className="hero-plan-when">{goal.planWhen}</p>
              <ul>
                {goal.rows.map((row) => (
                  <li key={row.text}>
                    <row.Icon size={18} aria-hidden /> {row.text}
                  </li>
                ))}
              </ul>
              <p className={`hero-plan-yes ${step >= 3 ? "is-ready" : ""}`}>
                <Check size={18} aria-hidden /> Yes, go ahead
              </p>
            </div>
          )}
        </PhoneFrame>
        <ExampleNote>Example only. Nothing here is sent or booked.</ExampleNote>
      </div>
    </section>
  );
}
