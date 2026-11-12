// Reads the person's own words for the /demo planner: what they asked for, which turn it was in,
// and the plain details they stated (title, place). Pure; never guesses a day or time.
import type { DemoInput, DemoTurn } from "./demo-contract";
import { WEEKDAYS } from "./demo-events";
import { UNSAFE_PATTERN } from "./safety";

export const MEDICINE =
  /\b(pill|pills|medic\w*|prescri\w*|dose|dosage|tablet\w*|insulin|blood pressure|pharmac\w*)\b/i;
export const RIDE_WORDS = /\b(drive|driving|ride|lift|pick me up|pickup|pick-up|take me)\b/i;
export const OWN_WAY =
  /\b(myself|my own|on my own|walk there|bus|i'?ll get there|i'?ll take a (taxi|cab))\b/i;
/** Asking Company to book a car: never possible, so the honest alternatives are offered instead. */
export const BOOK_RIDE =
  /\b(book|call|order|get|send|arrange)\b[^.?!]*\b(taxi|cab|uber|lyft|car service|limo)\b/i;
export const OPEN_ENDED =
  /\b(something|anything|any ideas|ideas?|bored|nothing to do|what (should|can) i do|get out of the house|go out\s*[.!?]*$)\b/i;
export const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you)[.! ]*$/i;
const YES = /^(yes|yeah|yep|sure|ok|okay|please|sounds good|that'?d be (great|lovely|nice))\b/i;
export const ACTIVITY =
  /\b(go|going|visit\w*|see|seeing|meet\w*|play\w*|watch\w*|attend\w*|join\w*|have|having|take|trip|travel\w*|lunch|dinner|brunch|coffee|tea|party|birthday|bowling|swim\w*|golf\w*|church|appointment|concert|wedding|picnic|fish\w*|airport|station)\b/i;

const LEADS: readonly RegExp[] = [
  /^(hi|hello|hey|please|so|well|ok|okay|oh)\b[,!.]?\s*/i,
  /^(can|could|would|will) you\s+(please\s+)?/i,
  /^(help|plan|arrange|book|get|take)\s+me\s+(to\s+)?/i,
  /^(i'?d|i would)\s+(really\s+)?(like|love)\s+(to\s+)?/i,
  /^i\s*('m|am)\s+(planning|going|hoping|thinking of|wanting)\s+(to\s+)?/i,
  /^i\s+(really\s+)?(want|wanna|need|hope|plan)\s+(to\s+)?/i,
  /^let'?s\s+/i,
  /^remind me to\s+/i,
  /^(a|an)\s+(taxi|cab|uber|lyft)\s*/i,
];
const DAY_WORDS = new RegExp(
  `\\b(on\\s+)?(this\\s+|next\\s+)?(${WEEKDAYS.join("|")})s?\\b|\\b(today|tonight|tomorrow|this (afternoon|evening|morning|weekend|week)|next week|at noon|noon)\\b`,
  "gi",
);
const TIME_WORDS =
  /\b(at\s+\d{1,2}(:[0-5]\d)?\s*(a\.?m\.?|p\.?m\.?)?|\d{1,2}(:[0-5]\d)?\s*(a\.?m\.?|p\.?m\.?))(?![\w:])/gi;
const TITLE_MAX = 60;
const MONTHS =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;
const PLACE =
  /\b(?:(?:at|in|to)\s+(the\s+[a-z][a-z' ]{1,30}?)|(?:at|in)\s+([A-Z][\w']+(?:\s+[A-Z][\w']+)*))(?=\s+(?:on|at|this|next|tomorrow|today|tonight|with|for|by|and)\b|\s*[.,!?]|\s*$)/;

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function stripLeads(text: string): string {
  let current = text.trim();
  for (let pass = 0; pass < LEADS.length; pass += 1) {
    const next = LEADS.reduce((acc, lead) => acc.replace(lead, ""), current).trim();
    if (next === current) break;
    current = next;
  }
  return current;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trim();
}

/** A short neutral title in the person's own words, e.g. "Go bowling with grandkids". */
export function titleFrom(words: string): string | null {
  const text = stripLeads(words.replace(/’/g, "'"))
    .replace(DAY_WORDS, " ")
    .replace(TIME_WORDS, " ")
    .replace(/\b(my|me)\s+/gi, "")
    .replace(/\b(please|for me)\b/gi, " ")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2 || !/[a-z]/i.test(text)) return null;
  return upperFirst(clip(text, TITLE_MAX));
}

/** A place only when the person named one ("in the hospital", "at Blue Cup"). */
export function placeFrom(words: string): string | null {
  const match = PLACE.exec(words);
  const found = (match?.[1] ?? match?.[2])?.trim();
  if (!found || MONTHS.test(found)) return null;
  if (WEEKDAYS.some((day) => found.toLowerCase().startsWith(day))) return null;
  return upperFirst(clip(found, TITLE_MAX));
}

/** A trip title for a ride-booking request, e.g. "Trip to the airport". */
export function tripTitle(words: string): string {
  const place = placeFrom(words);
  return place ? `Trip to ${place.charAt(0).toLowerCase()}${place.slice(1)}` : "Your trip";
}

export const isUnsafeText = (text: string) => UNSAFE_PATTERN.test(text) || MEDICINE.test(text);

/** Drops any earlier turn that mentions medicine or money, so it never reaches a model or a plan. */
export function cleanHistory(history: readonly DemoTurn[]): DemoTurn[] {
  return history.filter((turn) => !isUnsafeText(turn.text));
}

/** "yes please", "Saturday at 2": an answer to Company's last question rather than a new request. */
export function isFollowUp(words: string): boolean {
  return YES.test(words.trim()) || titleFrom(words) === null || /^no\b/i.test(words.trim());
}

export interface RequestText {
  /** What the person asked for (an earlier turn when this one is only an answer). */
  base: string;
  /** This turn's words, read first for day, time and ride. */
  detail: string;
  /** Company's last question, if any. */
  lastQuestion: string | null;
}

export function requestText(input: Pick<DemoInput, "words" | "history">): RequestText {
  const history = cleanHistory(input.history);
  const lastQuestion = [...history].reverse().find((turn) => turn.who === "company")?.text ?? null;
  const earlier = [...history]
    .reverse()
    .find((turn) => turn.who === "person" && !isFollowUp(turn.text) && !GREETING.test(turn.text));
  const base = isFollowUp(input.words) && earlier ? earlier.text : input.words;
  return { base, detail: input.words, lastQuestion };
}

/** Said yes to Company's question about a lift. */
export function saidYesToRide(request: RequestText): boolean {
  return (
    request.detail !== request.base &&
    YES.test(request.detail.trim()) &&
    !!request.lastQuestion &&
    RIDE_WORDS.test(request.lastQuestion)
  );
}
