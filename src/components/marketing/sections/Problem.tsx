import { ArrowRight, ExternalLink } from "lucide-react";
import { Band, Reveal, SectionHeading } from "../primitives";
import { PromoFilm } from "./PromoFilm";
import "./Problem.css";
import { Scribble } from "./Decor";

interface Insight {
  who: string;
  context: string;
  portrait: string;
  message: string;
}
/** First-person examples that make each person's obstacle concrete. */
const INSIGHTS: readonly Insight[] = [
  {
    who: "Joe",
    context: "78, loves live jazz",
    portrait: "/illustrations/joe.svg",
    message:
      "I’d love to hear some jazz with Walt. But I don’t know where to find a show, and I’d need a ride. Maybe next week.",
  },
  {
    who: "Maya",
    context: "Joe’s daughter, two hours away",
    portrait: "/illustrations/maya.svg",
    message:
      "I’d love to help Dad see Walt. I’m texting Walt and looking for a ride for Dad, but I’m two hours away. I can’t sort it out today.",
  },
  {
    who: "Joe",
    context: "on today’s apps",
    portrait: "/illustrations/joe.svg",
    message:
      "I found a show, but I need another app to find a ride. My family’s making plans in the chat. I just wanted jazz with Walt. I’ll leave it for now.",
  },
];

interface Change {
  topic: string;
  before: string;
  now: string;
}
/** Before → after: the payoff of the messages above, in the same words. */
const CHANGES: readonly Change[] = [
  { topic: "Planning", before: "eleven little jobs", now: "one sentence" },
  { topic: "Family", before: "Maya plans everything", now: "Maya answers one question" },
  { topic: "The outing", before: "“maybe next week”", now: "Thursday, 2pm, with Walt" },
];

interface Study {
  figure: string;
  text: string;
  source: string;
  href: string;
}
const STUDIES: readonly Study[] = [
  {
    figure: "28%",
    text: "of U.S. adults age 50+ with close friends wanted more contact with them.",
    source: "University of Michigan poll, 2024",
    href: "https://ihpi.umich.edu/national-poll-healthy-aging/national-findings/value-friendships-we-age",
  },
  {
    figure: "20%",
    text: "of Michigan adults age 50+ said finding local social or recreational activities was difficult.",
    source: "Michigan Poll on Healthy Aging, 2026",
    href: "https://ihpi.umich.edu/national-poll-healthy-aging/michigan-findings/growing-older-michigan",
  },
  {
    figure: "50 interviews",
    text: "In a qualitative study, older participants described concern about complicating their adult children’s busy lives.",
    source: "Cahill et al., 2009",
    href: "https://pubmed.ncbi.nlm.nih.gov/19474397/",
  },
];

function Insights() {
  return (
    <div className="problem-insights">
      {INSIGHTS.map((item) => (
        <figure key={item.message} className="problem-insight">
          <figcaption className="problem-insight-who">
            <img src={item.portrait} alt="" width="48" height="48" loading="lazy" />
            <span>
              <strong>{item.who}</strong> · {item.context}
            </span>
          </figcaption>
          <blockquote className="problem-bubble">“{item.message}”</blockquote>
        </figure>
      ))}
    </div>
  );
}

function ValueBlock() {
  return (
    <div className="problem-value">
      <h3 className="m-h3">What changes for Joe</h3>
      <ul className="problem-changes">
        {CHANGES.map((change) => (
          <li key={change.topic} className="problem-change">
            <p className="problem-change-before">
              <span className="problem-change-label">Before</span>
              <s>{change.before}</s>
            </p>
            <ArrowRight className="problem-change-arrow" size={24} aria-hidden />
            <p className="problem-change-now">
              <span className="problem-change-label">Now</span>
              <strong>{change.now}</strong>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Research() {
  return (
    <details className="problem-research">
      <summary>Research behind the idea</summary>
      <div className="problem-research-body">
        <p className="m-body">
          Research shows different parts of this problem. These are not measured outcomes from
          Company.
        </p>
        <ul className="problem-studies">
          {STUDIES.map((study) => (
            <li key={study.source} className="problem-study">
              <p className="problem-figure m-serif">{study.figure}</p>
              <p className="m-body">{study.text}</p>
              <a href={study.href} target="_blank" rel="noreferrer" className="problem-source">
                {study.source}
                <ExternalLink size={16} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <p className="m-small">
          These studies cover different populations and situations. The Michigan result is regional;
          the interview study describes experiences and does not estimate prevalence.
        </p>
      </div>
    </details>
  );
}

export function Problem() {
  return (
    <Band id="why" labelledBy="why-title" className="problem">
      <SectionHeading
        id="why-title"
        eyebrow="The problem"
        title="Wanting to go is easy."
        accent="Getting there is the hard part."
        lead="Joe, 78, would love to hear live jazz with his friend Walt on Thursday. His daughter, Maya, lives two hours away. Between him and the music sit eleven small jobs. Each one is small. Together, they’re enough to make him stay home."
      />
      <Reveal>
        <PromoFilm />
      </Reveal>
      <Insights />
      <div className="problem-pull-wrap">
        <p className="problem-pull m-serif">He’s ready to go. The planning stops him.</p>
        <Scribble className="problem-scribble" />
      </div>
      <ValueBlock />
      <Research />
    </Band>
  );
}
