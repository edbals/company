// Shared facts about how Company works. Every line here matches the real code:
// agents in src/lib/agents.functions.ts and src/lib/planning-agents.server.ts,
// guardrails in src/lib/plan-logic.ts, src/lib/app.functions.ts and the database.
import {
  Brain,
  CalendarClock,
  Car,
  GitMerge,
  Lock,
  MessageCircle,
  Music2,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AgentId = "checkin" | "outings" | "rides" | "family" | "coordinator" | "memory";
export type GuardrailId = "safety" | "rules" | "decision" | "scheduler";

export interface AgentInfo {
  id: AgentId;
  name: string;
  /** One plain sentence on what this agent does. */
  role: string;
  Icon: LucideIcon;
}

export interface GuardrailInfo {
  id: GuardrailId;
  name: string;
  role: string;
  Icon: LucideIcon;
}

/** The six AI agents, in the order they act. Outings, Rides and Family circle run in parallel. */
export const AGENTS: readonly AgentInfo[] = [
  {
    id: "checkin",
    name: "Check-in",
    role: "Listens to what you say and works out what you'd like to do.",
    Icon: MessageCircle,
  },
  {
    id: "outings",
    name: "Outings",
    role: "Picks the event that best fits, only from ones already listed.",
    Icon: Music2,
  },
  {
    id: "rides",
    name: "Rides",
    role: "Works out how you'd get there: your own way, or a lift from family.",
    Icon: Car,
  },
  {
    id: "family",
    name: "Family circle",
    role: "Suggests involving family only when you asked for it.",
    Icon: Users,
  },
  {
    id: "coordinator",
    name: "Coordinator",
    role: "Combines the three suggestions into one plan. It can drop options, never add them.",
    Icon: GitMerge,
  },
  {
    id: "memory",
    name: "Memory keeper",
    role: "Offers up to three things worth remembering. You keep or skip each one.",
    Icon: Brain,
  },
] as const;

/** Checks that are ordinary code, not AI, so they behave the same every time. */
export const GUARDRAILS: readonly GuardrailInfo[] = [
  {
    id: "safety",
    name: "Safety filter",
    role: "Blocks medicine and money actions, and keeps health details out of memory.",
    Icon: ShieldCheck,
  },
  {
    id: "rules",
    name: "Plan rules",
    role: "Checks your ride limit and moves a reminder that would clash with the outing.",
    Icon: Scale,
  },
  {
    id: "decision",
    name: "Decision lock",
    role: "Nothing happens without your yes, and every yes has 10 seconds to undo.",
    Icon: Lock,
  },
  {
    id: "scheduler",
    name: "Scheduler",
    role: "Follows up when a ride request gets no reply, and clears old conversations.",
    Icon: CalendarClock,
  },
] as const;

export const SIGN_IN_PATH = "/auth";
/** The hands-on demo page (built last). */
export const DEMO_PATH = "/demo";

export interface AvatarMedia {
  /** Still frame for reduced motion and before video loads. */
  poster: string;
  /** Plays once as a greeting, then hands off to `idle`. */
  greet: string;
  /** Calm, seamless loop that can stay on screen for minutes. */
  idle: string;
}

/** Company's character. Set to null to fall back to the soft placeholder circle. */
export const COMPANY_AVATAR: AvatarMedia | null = {
  poster: "/avatar/company-poster.png",
  greet: "/avatar/company-greet.mp4",
  idle: "/avatar/company-idle.mp4",
};
