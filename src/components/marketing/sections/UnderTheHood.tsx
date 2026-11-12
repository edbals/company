import { Band, Eyebrow } from "../primitives";
import "./UnderTheHood.css";

const CHOICES = [
  { title: "Specialists", body: "— Outings, Rides and Family circle — work at the same time." },
  { title: "The Coordinator", body: "discards anything the specialists didn’t suggest." },
  {
    title: "Rules",
    body: "block medicine and money requests, and take over if the AI fails; each person has an hourly limit on AI use.",
  },
  {
    title: "Consent",
    body: "is recorded on our server, with the cost checked again and 10 seconds to undo.",
  },
  {
    title: "Private by default",
    body: "— each person sees only their own data; family never sees chats or memory.",
  },
] as const;

const STACK = [
  "TypeScript",
  "React 19",
  "TanStack Start",
  "Supabase Postgres",
  "Zod",
  "Vitest",
  "ElevenLabs",
] as const;

export function UnderTheHood() {
  return (
    <Band id="tech" labelledBy="tech-title" stage className="tech">
      <div className="tech-heading">
        <Eyebrow dot={false}>Under the hood</Eyebrow>
        <h2 id="tech-title" className="m-h2">
          Built so the AI can help, and can’t overstep.
        </h2>
        <p className="m-lead">
          Six AI agents with narrow jobs, checked by ordinary code. Nothing happens until a person
          says yes.
        </p>
      </div>
      <div className="tech-choices-group">
        <h3 id="tech-choices-title" className="m-h3">
          Five engineering choices
        </h3>
        <ol className="tech-choices" aria-labelledby="tech-choices-title">
          {CHOICES.map((choice) => (
            <li key={choice.title}>
              <strong>{choice.title}</strong> {choice.body}
            </li>
          ))}
        </ol>
      </div>
      <p className="m-small tech-stack">{STACK.join(" · ")}</p>
      <p className="m-small tech-honest">
        Not connected yet: ride and delivery providers, outside messages and live event search.
        Company says so in the app instead of pretending.
      </p>
    </Band>
  );
}
