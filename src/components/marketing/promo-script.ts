export interface Beat {
  id: string;
  headline: string;
  sub?: string;
  accent?: string[];
  holdMs: number;
  scene:
    | "wish"
    | "pile"
    | "maya"
    | "home"
    | "ask"
    | "team"
    | "checks"
    | "plan"
    | "family"
    | "memory"
    | "payoff";
  description: string;
}

export const FILM_TASKS = [
  "Find jazz",
  "Find a lift",
  "Check with Walt",
  "Ask Maya",
  "Reminders clash",
] as const;

export const FILM_HELPERS = [
  { agent: "Check-in", name: "Asks how Joe feels" },
  { agent: "Outings", name: "Finds live jazz" },
  { agent: "Rides", name: "Weighs ride options" },
  { agent: "Family circle", name: "Prepares family requests" },
  { agent: "Coordinator", name: "Fits everything together" },
  { agent: "Memory keeper", name: "Keeps what Joe allows" },
] as const;

export const FILM_CODE_CHECKS = "Code checks safety and timing.";
export const PLAN_ROWS = [
  "Ask Maya for a lift?",
  "Invite Walt yourself?",
  "Move the clashing reminder?",
] as const;
export const FILM_LIMITS = "Ride and delivery providers and outside messages: Not connected.";

export const PROMO_BEATS: readonly Beat[] = [
  {
    id: "wish",
    headline: "An afternoon of jazz with Walt.",
    sub: "Joe, 78. Live jazz. His favourite company.",
    accent: ["jazz", "Walt."],
    holdMs: 1800,
    scene: "wish",
    description: "Joe’s wish: Jazz with Walt on Thursday afternoon.",
  },
  {
    id: "pile",
    headline: "First, a pile of little jobs.",
    holdMs: 2200,
    scene: "pile",
    description: FILM_TASKS.join(". ") + ". The tasks pile up between Joe and the music.",
  },
  {
    id: "maya",
    headline: "Maya becomes the planner. Again.",
    sub: "His daughter lives two hours away.",
    holdMs: 1800,
    scene: "maya",
    description: "The pile lands with Maya: a week of back-and-forth texts.",
  },
  {
    id: "home",
    headline: "Joe stays home.",
    holdMs: 1200,
    scene: "home",
    description: "Joe sits alone. The afternoon of jazz slips away.",
  },
  {
    id: "ask",
    headline: "“Company, help me see jazz with Walt.”",
    sub: "One sentence starts the plan.",
    accent: ["Company,"],
    holdMs: 1800,
    scene: "ask",
    description: "Joe asks Company, his AI planning companion, for help.",
  },
  {
    id: "team",
    headline: "Six AI helpers. All working together.",
    holdMs: 4000,
    scene: "team",
    description:
      "Six specialist AI agents work at the same time. " +
      FILM_HELPERS.map((helper) => `${helper.agent}: ${helper.name}.`).join(" "),
  },
  {
    id: "checks",
    headline: "Code checks the plan.",
    sub: "Safety. Timing. Reminder clashes.",
    holdMs: 1600,
    scene: "checks",
    description: FILM_CODE_CHECKS + " Code, not the AI, checks for conflicts.",
  },
  {
    id: "plan",
    headline: "One plan. Joe has the final say.",
    sub: "Only the questions Joe must answer.",
    accent: ["Joe"],
    holdMs: 3400,
    scene: "plan",
    description:
      "Suggested plan: Thursday jazz at 2pm. " +
      PLAN_ROWS.join(" ") +
      " Joe can say yes or change the plan. Nothing is booked or sent without his yes.",
  },
  {
    id: "family",
    headline: "Maya gets one simple request.",
    sub: "Family sees only what Joe shares.",
    holdMs: 2200,
    scene: "family",
    description:
      "In Company, after Joe approves: Maya, could you help with a lift? One request replaces a week of texts. No outside message is sent.",
  },
  {
    id: "memory",
    headline: "Next time, less to explain.",
    sub: "Company remembers only with Joe’s permission.",
    holdMs: 2000,
    scene: "memory",
    description:
      "Company asks: Remember that you like afternoon jazz? Joe chooses whether to save it.",
  },
  {
    id: "payoff",
    headline: "More afternoons doing what he loves.",
    sub: "Joe. Walt. Live jazz.",
    accent: ["More afternoons"],
    holdMs: 3000,
    scene: "payoff",
    description:
      "The hoped-for afternoon: Joe and Walt together at the jazz. Any transport is arranged separately. " +
      FILM_LIMITS,
  },
];
