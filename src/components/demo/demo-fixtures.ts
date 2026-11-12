// Hand-written planner results for the demo tests, so they don't depend on src/lib internals.
import type { DemoPlan, DemoResult } from "@/lib/demo-contract";

export const SAMPLE_PLAN: DemoPlan = {
  kind: "plan",
  origin: "sample",
  title: "Live jazz afternoon",
  when: "Thursday, 2:00 PM",
  place: "The Blue Door Cafe",
  cost: "$12",
  ride: "undecided",
  helperRequest: "Hi Maya, could you drive Dad to jazz on Thursday at 2?",
  memory: "Joe enjoys live jazz afternoon.",
  notice: null,
};

export const PERSONAL_PLAN: DemoPlan = {
  ...SAMPLE_PLAN,
  origin: "personal",
  title: "Walk with Walt",
  place: null,
  cost: "Free",
  ride: "own_way",
  helperRequest: null,
  memory: null,
  notice: "Taxi booking is not connected.",
};

const STEPS: DemoResult["steps"] = [{ agent: "checkin", status: "done", line: "Understood." }];

export const planResult = (plan: DemoPlan, source: DemoResult["source"] = "ai"): DemoResult => ({
  source,
  reply: "Here is a plan.",
  steps: STEPS,
  outcome: plan,
});

export const optionsResult: DemoResult = {
  source: "ai",
  reply: "Two ideas for you.",
  steps: STEPS,
  outcome: {
    kind: "options",
    options: [SAMPLE_PLAN, { ...SAMPLE_PLAN, title: "Garden concert", place: "Rose Park" }],
  },
};

export const reminderResult: DemoResult = {
  source: "ai",
  reply: "I can remind you.",
  steps: STEPS,
  outcome: {
    kind: "reminder",
    title: "Buy milk",
    when: "Tomorrow, 9:00 AM",
    helperRequest: "Hi Maya, Dad is out of milk.",
  },
};

export const blockedResult: DemoResult = {
  source: "rules",
  reply: "I can’t order medicine.",
  steps: STEPS,
  outcome: {
    kind: "blocked",
    reason: "Medicine needs a pharmacist.",
    alternative: "Remind me to call",
  },
};

export const chatResult: DemoResult = {
  source: "ai",
  reply: "Hi Joe. What would you like to do this week?",
  steps: STEPS,
  outcome: { kind: "chat" },
};
