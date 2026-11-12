import { ChevronDown } from "lucide-react";
import { Band, Eyebrow } from "../primitives";
import "./Faq.css";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "What can I do in Company today?",
    answer:
      "Sign in, say what you’d like to do, and review the plan Company builds. You can browse listed activities, add your own plans, set reminders, save preferences and ask family for help inside Company.",
  },
  {
    question: "Can Company book rides or send messages?",
    answer:
      "Not yet. Today it creates plans and requests inside Company. Ride and delivery providers, outside messages and bookings are planned, and the examples on this page are illustrative.",
  },
  {
    question: "What can my family see?",
    answer:
      "Your sharing settings control plan, errand and outing updates. A request for help is a separate choice. Conversations and saved preferences are never in the family view.",
  },
  {
    question: "Do I have to use my voice?",
    answer:
      "No. You can speak, type or use the answer buttons. Spoken replies also appear as text, and sound is optional.",
  },
  {
    question: "Where do activity suggestions come from?",
    answer:
      "From activities stored in Company and events you enter yourself. Live web search is planned.",
  },
  {
    question: "What if I need urgent help?",
    answer:
      "Contact your local emergency services directly. Company is not an emergency service, and you should not rely on it to place a call or alert someone.",
  },
];

export function Faq() {
  return (
    <Band id="faq" labelledBy="faq-title" className="faq">
      <div className="faq-layout">
        <div className="faq-head">
          <Eyebrow>A few things you might be wondering</Eyebrow>
          <h2 id="faq-title" className="m-h2">
            Good questions.
          </h2>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="faq-item">
              <summary className="faq-summary">
                <span>{item.question}</span>
                <ChevronDown size={24} aria-hidden className="faq-chevron" />
              </summary>
              <p className="m-body faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Band>
  );
}
