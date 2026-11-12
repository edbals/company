import { describe, expect, it } from "vitest";
import { departureIso, findClash, keywordMatch, overLimit, rideQuestion, type PlanLike } from "./plan-logic";

const plan = (over: Partial<PlanLike> = {}): PlanLike => ({
  title: "Garden market", place: "Riverside", starts_at: "2026-11-14T14:00:00Z", ends_at: "2026-11-14T16:00:00Z",
  cost: 0, ride_quote: 0, pickup_at: "2026-11-14T13:30:00Z", status: "planning", ride_status: "none", ...over,
});

describe("ride question (real app)", () => {
  it("uses the event's own title and times, cheapest first, family first when linked", () => {
    const q = rideQuestion({ plan: plan(), tz: "UTC", rideLimit: 25, familyName: "Ana", reminders: [], recovering: false });
    expect(q.text).toContain("Garden market");
    expect(q.text).toContain("2:00 pm");
    expect(q.options[0]!.label).toBe("Ask Ana");
    expect(q.options[0]!.cost).toBe(0);
  });
  it("labels a $28 fare as $3 over a $25 limit", () => {
    const q = rideQuestion({ plan: plan({ ride_quote: 28 }), tz: "UTC", rideLimit: 25, familyName: null, reminders: [], recovering: true });
    const taxi = q.options.find((o) => o.id === "own_way")!;
    expect(taxi.overLimitBy).toBe(3);
    expect(overLimit(18, 25)).toBe(0);
  });
  it("moves a 2:00 reminder inside the outing to 15 minutes before departure", () => {
    const c = findClash(plan(), [{ id: "r", label: "x", at_time: "14:00:00" }], "UTC");
    expect(c?.to).toBe("13:15");
    expect(findClash(plan(), [{ id: "r", label: "x", at_time: "09:00:00" }], "UTC")).toBeNull();
  });
  it("recovery never offers 'no ride needed' and offers skip", () => {
    const q = rideQuestion({ plan: plan(), tz: "UTC", rideLimit: 25, familyName: "Ana", reminders: [], recovering: true });
    expect(q.options.map((o) => o.id)).toEqual(["family", "own_way", "skip"]);
  });
  it("home and phone plans do not ask for a ride or claim a verified cost", () => {
    for (const place of ["At home", "Online or phone"]) {
      const personal = plan({ place, event_id: null });
      const q = rideQuestion({ plan: personal, tz: "UTC", rideLimit: 25, familyName: "Ana", reminders: [], recovering: false });
      expect(q.options.map((o) => o.id)).toEqual(["no_ride", "not_now"]);
      expect(q.text).toContain("No travel is needed");
      expect(departureIso(personal)).toBe(personal.starts_at);
    }
    const elsewhere = rideQuestion({ plan: plan({ event_id: null }), tz: "UTC", rideLimit: 25, familyName: null, reminders: [], recovering: false });
    expect(elsewhere.text).toContain("cost not verified");
  });
});

describe("keyword fallback", () => {
  it("finds a wish and a need from plain words", () => {
    const r = keywordMatch("I'd love some live music. Oh, and I'm out of milk.", [{ id: "e1", title: "Jazz trio", tags: ["music", "jazz"] }]);
    expect(r.eventIds).toEqual(["e1"]);
    expect(r.needs).toEqual(["milk"]);
  });
});

describe("review regressions", () => {
  it("plain 'I need milk' is a need", () => {
    expect(keywordMatch("I need milk", []).needs).toEqual(["milk"]);
  });
  it("an explicit refusal proposes nothing", () => {
    expect(keywordMatch("I don't want jazz this week", [{ id: "e1", title: "Jazz trio", tags: ["jazz"] }]).eventIds).toEqual([]);
  });
  it("overnight outing (leave 23:30, end 01:00) catches a 00:30 reminder", () => {
    const p = plan({ starts_at: "2026-11-14T00:00:00Z", pickup_at: "2026-11-13T23:30:00Z", ends_at: "2026-11-14T01:00:00Z" });
    const c = findClash(p, [{ id: "r", label: "x", at_time: "00:30:00" }], "UTC");
    expect(c?.to).toBe("23:15");
    expect(findClash(p, [{ id: "r", label: "x", at_time: "12:00:00" }], "UTC")).toBeNull();
  });
  it("free 'no ride' comes before a paid taxi", () => {
    const q = rideQuestion({ plan: plan({ ride_quote: 18 }), tz: "UTC", rideLimit: 25, familyName: null, reminders: [], recovering: false });
    const ids = q.options.map((o) => o.id);
    expect(ids.indexOf("no_ride")).toBeLessThan(ids.indexOf("own_way"));
  });
  it("cents: $25.50 is 50 cents over a $25 limit", () => {
    expect(overLimit(25.5, 25)).toBe(0.5);
    expect(overLimit(25.1 + 0.2, 25)).toBe(0.3);
  });
});
