// Design rationale page. Every sentence is the team's own, word for word. The only edit is that
// some whole sentences were removed; nothing is reworded. Only layout and styling live here.
import { ArrowLeft } from "lucide-react";
import "../landing.css";
import "./rationale.css";
import { CompanyAvatar, Reveal, Wordmark } from "../primitives";
import { Scribble } from "./Decor";
import {
  BearSendOff,
  ChoiceGlyph,
  JoePhone,
  JobsToPlan,
  MayaPhone,
  StepDecide,
  StepPlan,
  StepTell,
} from "./Mocks";
import { Personas } from "./Personas";
import { SiteHeader } from "../SiteHeader";

interface SectionHeadProps {
  number: string;
  id: string;
  title: string;
}
function SectionHead({ number, id, title }: SectionHeadProps) {
  return (
    <div className="why-head">
      <h2 id={id} className="m-h2 why-title">
        <span className="m-visually-hidden">{number}. </span>
        {title}
      </h2>
    </div>
  );
}

function Underlined({ children }: { children: string }) {
  return (
    <span className="why-underlined">
      {children}
      <Scribble className="why-scribble" />
    </span>
  );
}

function Problem() {
  return (
    <section className="m-band why-band why-problem" aria-labelledby="why-1">
      <div className="m-container why-stack">
        <SectionHead
          number="1"
          id="why-1"
          title="The Problem: When Small Obstacles Get in the Way of Living"
        />
        <Reveal className="why-problem-copy">
          <p className="why-lead m-serif">
            An afternoon listening to jazz might mean finding a show, arranging a ride, checking
            schedules, and asking someone for help.
          </p>
          <p className="m-body why-problem-aside">
            Together, they can be enough to make staying home feel easier than going out.
          </p>
        </Reveal>
        <Reveal className="why-problem-visual">
          <JobsToPlan />
        </Reveal>
        <Reveal>
          <blockquote className="why-pull why-pull--field">
            We believe getting older shouldn't mean having to choose between doing what you love and
            maintaining your <Underlined>independence.</Underlined>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

function Users() {
  return (
    <section className="m-band m-band--stage why-band why-users" aria-labelledby="why-2">
      <div className="m-container why-stack">
        <SectionHead
          number="2"
          id="why-2"
          title="Our Target Users: Independence for Older Adults, Peace of Mind for Families"
        />
        <Reveal className="why-users-intro">
          <p className="m-body why-users-body">
            Much of the technology designed for older adults focuses on what might go wrong: missed
            medication, falls, emergencies, or keeping family informed.
          </p>
          <blockquote className="why-pull why-pull--dark">
            Instead of asking what an older adult needs help with, what if we simply asked what
            they'd love to do?
          </blockquote>
        </Reveal>
        <Reveal className="why-pair">
          <div className="why-voice">
            <p className="why-voice-label">Older adults</p>
            <p>
              Our primary users are older adults who want to continue enjoying their lives, but face
              growing difficulties in making everyday plans. They want the freedom to make their own
              decisions without feeling like a burden.
            </p>
            <JoePhone />
          </div>
          <div className="why-voice why-voice--second">
            <p className="why-voice-label">Families</p>
            <p>
              They want to know their loved ones are doing well and be there when needed, without
              becoming responsible for organising every part of their lives.
            </p>
            <MayaPhone />
          </div>
        </Reveal>
        <Personas />
      </div>
    </section>
  );
}

const STEPS = ["Tell Company.", "Company makes a plan.", "You decide."] as const;
const STEP_VISUALS = [<StepTell key="t" />, <StepPlan key="p" />, <StepDecide key="d" />] as const;

function Solution() {
  return (
    <section className="m-band why-band why-solution" aria-labelledby="why-3">
      <div className="m-container why-stack">
        <SectionHead number="3" id="why-3" title="Our Solution: Make the Complicated Feel Simple" />
        <Reveal className="why-solution-lead">
          <p className="why-lead m-serif">
            Company is an AI companion that helps older adults turn everyday wishes into plans they
            can actually follow through on.
          </p>
        </Reveal>
        <Reveal className="why-journey">
          <p className="m-body why-journey-intro">
            We designed the experience around three steps:{" "}
            <span className="m-visually-hidden">{STEPS.join(" ")}</span>
          </p>
          <ol className="why-steps" aria-hidden>
            {STEPS.map((step, i) => (
              <li key={step} className="why-step">
                {STEP_VISUALS[i]}
                <span className="why-step-caption">
                  <span className="why-step-number">{i + 1}</span>
                  <span className="why-step-text">{step}</span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal className="why-solution-copy">
          <p className="m-body">
            People can speak or type naturally, without learning complicated commands or navigating
            multiple apps. Behind one conversation, specialised AI agents work together to find
            events, figure out transportation, check schedules, and coordinate with others when
            needed.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

interface Choice {
  lead: string;
  rest: string;
}
const CHOICES: readonly Choice[] = [
  {
    lead: "Conversation over complexity.",
    rest: "Voice interaction, large controls, familiar language, and one question at a time make the experience easier to navigate.",
  },
  {
    lead: "Human control at every step.",
    rest: "Company separates planning from taking action. Important decisions require clear approval, with costs and consequences explained beforehand.",
  },
  {
    lead: "Privacy by choice.",
    rest: "People decide what their family can see and what Company remembers.",
  },
  {
    lead: "Help that adapts.",
    rest: "When something changes, such as a cancelled ride, Company helps find alternatives instead of leaving the person to start over.",
  },
  {
    lead: "Complexity beneath the surface.",
    rest: "Specialised AI agents handle the coordination, while users see a simple experience.",
  },
] as const;

function Choices() {
  return (
    <section className="m-band m-band--stage why-band why-choices-band" aria-labelledby="why-4">
      <div className="m-container why-stack">
        <SectionHead
          number="4"
          id="why-4"
          title="Key Interaction Choices: Help Without Taking Over"
        />
        <Reveal>
          <ul className="why-choices">
            {CHOICES.map((choice, i) => (
              <li key={choice.lead} className="why-choice">
                <ChoiceGlyph index={i} />
                <p className="why-choice-text">
                  <strong>{choice.lead}</strong> <span>{choice.rest}</span>
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal>
          <p className="why-motto m-serif">The AI does the legwork. The person stays in charge.</p>
        </Reveal>
      </div>
    </section>
  );
}

function Outcome() {
  return (
    <section className="m-band why-band why-outcome" aria-labelledby="why-5">
      <div className="m-container why-stack">
        <SectionHead number="5" id="why-5" title="The Outcome: More Life, Less Logistics" />
        <Reveal className="why-outcome-lead">
          <p className="why-lead m-serif">
            We're building something that makes it easier to say yes to life. Another afternoon with
            friends. Another concert. Another reason to get out of the house.
          </p>
        </Reveal>
        <div className="why-finale">
          <BearSendOff />
          <p className="why-finale-text m-serif">
            Because the best thing technology can do isn't give us more to manage. It's make more
            room for living.
          </p>
        </div>
      </div>
    </section>
  );
}

export function RationalePage() {
  return (
    <div className="marketing why">
      <a className="m-skip" href="#main-content">
        Skip to content
      </a>
      <SiteHeader current="rationale" />
      <main id="main-content" tabIndex={-1}>
        <section className="m-container why-hero" aria-labelledby="why-title">
          <div className="why-hero-art">
            <span className="why-hero-disc" aria-hidden />
            <CompanyAvatar size="lg" className="why-hero-avatar" />
          </div>
          <h1 id="why-title" className="m-h1 why-hero-title">
            Why We're Building Company
          </h1>
          <p className="why-hero-sub">
            <span className="why-hero-tagline">
              AI Planning for <Underlined>Older Adults</Underlined>
            </span>
          </p>
        </section>
        <Problem />
        <Users />
        <Solution />
        <Choices />
        <Outcome />
      </main>
      <footer className="m-footer">
        <div className="m-container">
          <a href="/" aria-label="Company home">
            <Wordmark reverse />
          </a>
          <nav aria-label="Footer">
            <a href="/">
              <ArrowLeft size={16} aria-hidden /> Back to Company
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
