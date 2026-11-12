// Personas drafted by Gemini, corrected to match what Company actually does (no ride or ticket
// bookings; rides come from family or friends, with the person's approval).
// Portraits: Open Peeps by Pablo Stanley, CC0 (see public/illustrations/LICENSE.txt).

interface Persona {
  name: string;
  age: number;
  role: string;
  who: string;
  image: string;
  quote: string;
  loves: readonly string[];
  inTheWay: readonly string[];
  company: readonly string[];
  never: string;
}

const PERSONAS: readonly Persona[] = [
  {
    name: "Joe",
    age: 78,
    role: "Primary user",
    who: "A retired architect who wants to keep his jazz afternoons with Walt.",
    image: "/illustrations/joe.svg",
    quote: "I want to see the show, not spend an hour figuring out the parking.",
    loves: ["Live jazz with his friend Walt", "Lunch out on a whim", "Doing things his own way"],
    inTheWay: ["Lining up two people's schedules", "Sorting out a ride to the venue"],
    company: [
      "Finds a Thursday show and suggests asking Maya for a lift, only after Joe says yes",
      "Shares the plan with Maya only if Joe chooses to",
    ],
    never: "To feel he has to ask permission to enjoy an afternoon out.",
  },
  {
    name: "Maya",
    age: 46,
    role: "Family member",
    who: "A busy project manager and Joe’s daughter, two hours away.",
    image: "/illustrations/maya.svg",
    quote: "I love that Dad goes out; I just can't be his full-time travel agent.",
    loves: [
      "Seeing her dad thrive socially",
      "Focused time with her kids",
      "Simple family coordination",
    ],
    inTheWay: [
      "Worrying when she can't reach him",
      "The mental load of organising his weekends from afar",
    ],
    company: [
      "Sends updates only on what Joe chooses to share",
      "Asks her for specific help, like a lift on Thursday, that she can accept or decline",
    ],
    never: "To take away her father’s independence while trying to help.",
  },
  {
    name: "Elena",
    age: 71,
    role: "Primary user",
    who: "A master gardener who recently gave up her car, but not her green thumb.",
    image: "/illustrations/elena.svg",
    quote: "My calendar is full. I just need a reliable way to reach the greenhouse.",
    loves: [
      "Volunteering at the botanical garden",
      "Her book club",
      "Finding local farmers’ markets",
    ],
    inTheWay: ["Feeling like a burden when asking for rides", "Confusing transit apps"],
    company: [
      "Remembers, with her permission, that she volunteers on Wednesdays",
      "Suggests asking a friend or family member for a lift, and waits for her yes",
    ],
    never: "To have her schedule booked or changed without the final say.",
  },
] as const;

interface ListProps {
  label: string;
  items: readonly string[];
}
function List({ label, items }: ListProps) {
  return (
    <div className="why-persona-list">
      <p className="why-persona-label">{label}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PersonaCard({ persona }: { persona: Persona }) {
  return (
    <article className="why-persona" aria-labelledby={`persona-${persona.name}`}>
      <div className="why-persona-portrait">
        <img src={persona.image} alt="" width="240" height="324" loading="lazy" />
      </div>
      <div className="why-persona-body">
        <p className="why-persona-role">{persona.role}</p>
        <h3 id={`persona-${persona.name}`} className="why-persona-name m-serif">
          {persona.name}, {persona.age}
        </h3>
        <p className="why-persona-who">{persona.who}</p>
        <blockquote className="why-persona-quote m-serif">“{persona.quote}”</blockquote>
        <div className="why-persona-lists">
          <List label="Loves" items={persona.loves} />
          <List label="What gets in the way" items={persona.inTheWay} />
          <List label="What Company does" items={persona.company} />
        </div>
        <p className="why-persona-never">
          <strong>Never wants:</strong> {persona.never}
        </p>
      </div>
    </article>
  );
}

export function Personas() {
  return (
    <div className="why-personas-block">
      <div className="why-personas">
        {PERSONAS.map((persona) => (
          <PersonaCard key={persona.name} persona={persona} />
        ))}
      </div>
      <p className="why-persona-note">
        Personas are illustrative composites, not research participants. Illustrations: Open Peeps
        by Pablo Stanley (CC0).
      </p>
    </div>
  );
}
