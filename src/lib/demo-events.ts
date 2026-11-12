// Sample events and day/time reading for the public /demo planner. Pure; safe in the browser.
import { fmtDay, localDayNumber, partsIn } from "./plan-logic";

export interface SampleEvent {
  id: string;
  title: string;
  place: string;
  starts_at: string;
  ends_at: string;
  cost: number;
  tags: string[];
}

export const DAY_MS = 864e5;
const HOUR_MS = 36e5;
interface EventSeed {
  id: string;
  title: string;
  place: string;
  day: number;
  hour: number;
  hours: number;
  cost: number;
  tags: string[];
}
const seed = (
  id: string,
  title: string,
  place: string,
  [day, hour, hours, cost]: readonly [number, number, number, number],
  tags: string[],
): EventSeed => ({ id, title, place, day, hour, hours, cost, tags });

const EVENT_SEEDS: readonly EventSeed[] = [
  seed(
    "jazz",
    "Live jazz afternoon",
    "Lakeside Café",
    [3, 14, 2, 12],
    ["jazz", "music", "live music", "concert", "band"],
  ),
  seed(
    "market",
    "Saturday farmers market",
    "Riverside Square",
    [5, 10, 3, 0],
    ["market", "farmers market", "shopping", "food", "vegetables"],
  ),
  seed(
    "garden",
    "Garden club meet-up",
    "Community Garden",
    [2, 11, 2, 0],
    ["garden", "gardening", "plants", "flowers"],
  ),
  seed(
    "film",
    "Classic film matinee",
    "Rio Theatre",
    [4, 13, 2, 8],
    ["film", "films", "movie", "movies", "cinema"],
  ),
  seed(
    "library",
    "Local history talk",
    "Central Library",
    [6, 15, 1, 0],
    ["library", "history", "talk", "lecture", "books", "reading"],
  ),
  seed(
    "walk",
    "Gentle park walk group",
    "Stanley Park entrance",
    [1, 10, 1, 0],
    ["walk", "walks", "walking", "park", "outdoors", "nature"],
  ),
  seed(
    "cards",
    "Cards and coffee afternoon",
    "Seniors' Centre",
    [2, 14, 2, 3],
    ["cards", "bridge", "games", "coffee", "friends", "coffee with friends"],
  ),
  seed(
    "choir",
    "Community choir concert",
    "St. Andrew's Hall",
    [8, 19, 2, 10],
    ["choir", "singing", "sing", "concert", "music"],
  ),
  seed(
    "art",
    "Watercolour drop-in class",
    "Arts Centre",
    [9, 13, 2, 15],
    ["art", "painting", "watercolour", "drawing", "class"],
  ),
];

/** Sample local events over the next two weeks, dated from `now`. Never presented as live listings. */
export function sampleEvents(now: Date = new Date()): SampleEvent[] {
  const base = new Date(now);
  base.setUTCHours(0, 0, 0, 0);
  return EVENT_SEEDS.map((item) => {
    const start = new Date(base.getTime() + item.day * DAY_MS);
    start.setUTCHours(item.hour + 8); // Seeds are Pacific local hours; UTC is 8 hours ahead.
    const end = new Date(start.getTime() + item.hours * HOUR_MS);
    return {
      id: item.id,
      title: item.title,
      place: item.place,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      cost: item.cost,
      tags: item.tags,
    };
  });
}

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const SATURDAY = 6;

/** How many days from today (in the person's timezone) they asked for, or null if they named no day. */
export function requestedDayOffset(words: string, now: Date, tz: string): number | null {
  const text = words.toLowerCase();
  if (/\b(today|tonight|this afternoon|this evening|this morning)\b/.test(text)) return 0;
  if (/\btomorrow\b/.test(text)) return 1;
  const today = WEEKDAYS.indexOf(
    partsIn(now.toISOString(), tz).weekday.toLowerCase() as (typeof WEEKDAYS)[number],
  );
  if (today < 0) return null;
  const named = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}s?\\b`).test(text));
  if (named >= 0) return (named - today + 7) % 7 || 7;
  if (/\bweekend\b/.test(text)) return today === 0 || today === SATURDAY ? 0 : SATURDAY - today;
  return null;
}

/** Moves a sample event to the day the person asked for, keeping its time of day. */
export function onRequestedDay(
  event: SampleEvent,
  words: string,
  now: Date,
  tz: string,
): SampleEvent {
  return onDayOffset(event, requestedDayOffset(words, now, tz), now, tz);
}

export function onDayOffset(
  event: SampleEvent,
  offset: number | null,
  now: Date,
  tz: string,
): SampleEvent {
  if (offset === null) return event;
  const days = localDayNumber(now.toISOString(), tz) + offset - localDayNumber(event.starts_at, tz);
  if (!days) return event;
  const move = (iso: string) => new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
  return { ...event, starts_at: move(event.starts_at), ends_at: move(event.ends_at) };
}

const MINUTES_PER_DAY = 1440;
const LATEST_ASSUMED_PM = 7;
const TIME_PATTERN = /\b(at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?(?![\w:])/gi;

/** Minutes after midnight the person named ("2pm", "at 2", "10:30 am", "noon"), or null. Never guessed. */
export function requestedTime(words: string): number | null {
  if (/\bnoon\b/i.test(words)) return 12 * 60;
  for (const match of words.matchAll(TIME_PATTERN)) {
    const [, at, hourText, minuteText, meridiem] = match;
    if (!at && !meridiem) continue;
    const hour = Number(hourText);
    if (hour > 23 || (meridiem && (hour < 1 || hour > 12))) continue;
    const pm = meridiem
      ? meridiem.toLowerCase().startsWith("p")
      : hour === 12 || (hour >= 1 && hour <= LATEST_ASSUMED_PM);
    const hour24 = meridiem || hour <= 12 ? (hour % 12) + (pm ? 12 : 0) : hour;
    return hour24 * 60 + Number(minuteText ?? 0);
  }
  return null;
}

/** "2:00 pm", matching the app's time format. */
export function clockText(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(wrapped / 60);
  const minute = String(wrapped % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "am" : "pm"}`;
}

/** The day label for an offset from today, e.g. "Sunday, Nov 15". */
export function dayText(offset: number, now: Date, tz: string): string {
  return fmtDay(new Date(now.getTime() + offset * DAY_MS).toISOString(), tz);
}

/** When a personal plan happens, saying plainly what is not set instead of inventing it. */
export function whenText(offset: number | null, time: number | null, now: Date, tz: string) {
  const day = offset === null ? null : dayText(offset, now, tz);
  const clock = time === null ? null : clockText(time);
  if (day && clock) return `${day}, ${clock}`;
  if (day) return `${day}, time not set`;
  if (clock) return `Day not set, ${clock}`;
  return "Day and time not set";
}
