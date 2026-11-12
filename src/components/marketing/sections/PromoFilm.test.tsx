import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FILM_CODE_CHECKS,
  FILM_HELPERS,
  FILM_LIMITS,
  FILM_TASKS,
  PROMO_BEATS,
  PLAN_ROWS,
} from "../promo-script";
import { stubReducedMotion } from "../test-utils";
import { PromoFilm } from "./PromoFilm";
import { readFileSync } from "node:fs";

let visibility: (ratio: number) => void;
beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void,
      ) {
        visibility = (ratio) => callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const chapter = (number: number) =>
  screen.getByRole("button", { name: new RegExp(`^Beat ${number}:`) });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("PromoFilm", () => {
  it("provides all eleven beats in order with scene details in its transcript", () => {
    render(<PromoFilm />);
    const transcript = screen.getByRole("list", { name: "Film transcript" });
    expect(transcript.tagName).toBe("OL");
    expect(transcript.children).toHaveLength(11);
    Array.from(transcript.children).forEach((item, i) => {
      const beat = PROMO_BEATS[i]!;
      expect(item.textContent).toContain(beat.headline);
      if (beat.sub) expect(item.textContent).toContain(beat.sub);
    });
    expect(within(transcript).getAllByRole("listitem")).toHaveLength(11);
    expect(transcript).toHaveTextContent("Joe, 78.");
    expect(transcript).toHaveTextContent("His daughter lives two hours away.");
    expect(transcript).toHaveTextContent("Maya becomes the planner. Again.");
    for (const beat of PROMO_BEATS) expect(transcript).toHaveTextContent(beat.description);
    for (const helper of FILM_HELPERS) {
      expect(transcript).toHaveTextContent(`${helper.agent}: ${helper.name}.`);
    }
    expect(transcript).toHaveTextContent(FILM_CODE_CHECKS);
    for (const row of PLAN_ROWS) expect(transcript).toHaveTextContent(row);
    expect(transcript).toHaveTextContent(FILM_LIMITS);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("makes the planning burden visible before Joe stays home", () => {
    const { container } = render(<PromoFilm />);
    const scene = () => container.querySelector(".film-scene")!;
    fireEvent.click(chapter(2));
    expect(scene().querySelectorAll(".film-task")).toHaveLength(5);
    for (const task of FILM_TASKS) expect(scene()).toHaveTextContent(task);
    fireEvent.click(chapter(3));
    expect(scene().querySelector(".film-pile--maya")).toBeTruthy();
    expect(scene()).toHaveTextContent("His daughter lives two hours away.");
    fireEvent.click(chapter(4));
    expect(scene()).toHaveTextContent("Joe stays home.");
    expect(scene().querySelector(".film-alone")).toBeTruthy();
    fireEvent.click(chapter(5));
    expect(scene()).toHaveTextContent("“Company, help me see jazz with Walt.”");
  });

  it("shows six agents together, then a distinct code check", () => {
    const { container } = render(<PromoFilm />);
    expect(FILM_HELPERS.map((helper) => helper.agent)).toEqual([
      "Check-in",
      "Outings",
      "Rides",
      "Family circle",
      "Coordinator",
      "Memory keeper",
    ]);
    fireEvent.click(chapter(6));
    const team = container.querySelector(".film-work")!;
    expect(team.querySelectorAll(".film-helper")).toHaveLength(6);
    expect(team.querySelectorAll(".film-working")).toHaveLength(6);
    for (const helper of FILM_HELPERS) {
      expect(team).toHaveTextContent(helper.agent);
      expect(team).toHaveTextContent(helper.name);
    }
    expect(team.textContent).not.toMatch(/booked|sent|confirmed/i);
    fireEvent.click(chapter(7));
    expect(container.querySelector(".film-work")).toBeNull();
    expect(container.querySelector(".film-checks")).toHaveTextContent("SafetyTiming");
    expect(container.querySelector(".film-headline")).toHaveTextContent("Code checks the plan.");
  });

  it("returns only Joe’s choices, keeps sharing private, and asks permission to remember", () => {
    const { container } = render(<PromoFilm />);
    const scene = () => container.querySelector(".film-scene")!;
    fireEvent.click(chapter(8));
    const card = container.querySelector(".film-plan")!;
    expect(card).toHaveTextContent("Suggested plan");
    expect(card).toHaveTextContent("Thursday jazz · 2pm");
    for (const row of PLAN_ROWS) expect(card).toHaveTextContent(row);
    expect(scene()).toHaveTextContent("Only the questions Joe must answer.");
    expect(card).toHaveTextContent("Yes to this plan");
    expect(card).toHaveTextContent("Change it");
    // The film illustrates choices; it cannot approve anything for Joe.
    expect(card.querySelector("button")).toBeNull();
    fireEvent.click(chapter(9));
    expect(scene()).toHaveTextContent("Maya gets one simple request.");
    expect(scene()).toHaveTextContent("In Company · after Joe’s yes");
    expect(scene()).toHaveTextContent("Family sees only what Joe shares.");
    fireEvent.click(chapter(10));
    expect(scene()).toHaveTextContent("Company remembers only with Joe’s permission.");
    expect(scene()).toHaveTextContent("Remember afternoon jazz?");
    fireEvent.click(chapter(11));
    expect(scene().querySelectorAll(".film-person")).toHaveLength(2);
    expect(scene().querySelector(".film-jazz--together")).toHaveTextContent("Joe");
    expect(scene()).toHaveTextContent("Walt");
  });

  it("pauses only progress animation and never schedules a text exit", () => {
    // JSDOM cannot play CSS animations: check the stylesheet contract as well as the clock.
    const filmStyles = readFileSync("src/components/marketing/sections/PromoFilm.css", "utf8");
    const pauseRules = Array.from(
      filmStyles
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .matchAll(/([^{}]+)\{[^{}]*animation-play-state:\s*paused[^{}]*\}/g),
    );
    expect(pauseRules).toHaveLength(1);
    expect(pauseRules[0]?.[1]?.trim()).toBe(
      '.film-stage[data-playing="false"] .film-fill--current',
    );
    expect(filmStyles).not.toMatch(/film-exit|--exit-delay/);
    const { container } = render(<PromoFilm />);
    act(() => visibility(1));
    advance(100);
    const scene = container.querySelector(".film-scene");
    const fill = container.querySelector(".film-fill--current");
    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    advance(10000);
    expect(container.querySelector(".film-stage")).toHaveAttribute("data-playing", "false");
    expect(container.querySelector(".film-stage")).toHaveAttribute("data-still", "false");
    expect(container.querySelector(".film-scene")).toBe(scene);
    expect(container.querySelector(".film-fill--current")).toBe(fill);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
  });

  it("toggles Play and Pause and preserves the remaining beat duration", () => {
    render(<PromoFilm />);
    // Manual navigation suppresses the first automatic start.
    fireEvent.click(chapter(1));
    act(() => visibility(1));
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    advance(700);
    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    advance(5000);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    advance(1099);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    advance(1);
    expect(chapter(2)).toHaveAttribute("aria-current", "step");
  });

  it("jumps to the payoff, announces only manual changes, and can replay", () => {
    const { container } = render(<PromoFilm />);
    fireEvent.click(chapter(11));
    expect(container.querySelector(".film-headline")).toHaveTextContent(
      "More afternoons doing what he loves.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("More afternoons doing what he loves.");
    fireEvent.click(screen.getByRole("button", { name: "Watch again" }));
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
  });

  it("restarts a selected beat from its full duration, including the current beat", () => {
    render(<PromoFilm />);
    act(() => visibility(1));
    advance(1500);
    fireEvent.click(chapter(1));
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    advance(1799);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    advance(1);
    expect(chapter(2)).toHaveAttribute("aria-current", "step");
  });

  it("can pause and resume the payoff without restarting the film", () => {
    render(<PromoFilm />);
    fireEvent.click(chapter(11));
    act(() => visibility(1));
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    advance(500);
    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    expect(chapter(11)).toHaveAttribute("aria-current", "step");
    advance(PROMO_BEATS[10]!.holdMs - 500);
    expect(screen.getByRole("button", { name: "Play film" })).toBeTruthy();
  });

  it("offers a calm, complete slideshow without autoplay for reduced motion", () => {
    stubReducedMotion(true);
    const { container } = render(<PromoFilm />);
    act(() => visibility(1));
    advance(30000);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Pause film" })).toBeNull();
    for (let i = 1; i < PROMO_BEATS.length; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(chapter(i + 1)).toHaveAttribute("aria-current", "step");
    }
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(container.querySelector(".film-headline")).toHaveTextContent(
      "Next time, less to explain.",
    );
    fireEvent.click(chapter(11));
    fireEvent.click(screen.getByRole("button", { name: "Watch again" }));
    advance(30000);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
  });

  it("starts at 50% visibility, pauses below it, resumes, and plays only once", () => {
    render(<PromoFilm />);
    act(() => visibility(0.49));
    advance(4000);
    expect(screen.getByRole("button", { name: "Play film" })).toBeTruthy();
    act(() => visibility(0.5));
    advance(700);
    act(() => visibility(0.2));
    advance(4000);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    act(() => visibility(0.8));
    advance(1100);
    expect(chapter(2)).toHaveAttribute("aria-current", "step");
    for (const beat of PROMO_BEATS.slice(1)) advance(beat.holdMs);
    expect(chapter(11)).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Play film" })).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("");
    act(() => visibility(0));
    act(() => visibility(1));
    advance(30000);
    expect(chapter(11)).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Play film" }));
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    advance(PROMO_BEATS[0]!.holdMs);
    expect(chapter(2)).toHaveAttribute("aria-current", "step");
  });

  it("respects a manual pause when scrolling away and back", () => {
    render(<PromoFilm />);
    act(() => visibility(1));
    fireEvent.click(screen.getByRole("button", { name: "Pause film" }));
    act(() => visibility(0));
    act(() => visibility(1));
    advance(4000);
    expect(chapter(1)).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Play film" })).toBeTruthy();
  });

  it("keeps controls accessible and the story within its copy and timing limits", () => {
    const { container } = render(<PromoFilm />);
    for (let i = 1; i <= PROMO_BEATS.length; i++) {
      fireEvent.click(chapter(i));
      expect(container.querySelector(".film-scene")).toHaveAttribute("aria-hidden", "true");
      expect(chapter(i).closest('[aria-hidden="true"]')).toBeNull();
      expect(container.textContent?.toLowerCase()).not.toMatch(/d[e]mo/);
    }
    expect(
      screen.getByText(
        `Illustrated example. Nothing is booked or sent without Joe’s yes. ${FILM_LIMITS}`,
      ),
    ).toBeTruthy();
    for (const beat of PROMO_BEATS) {
      expect(beat.headline.split(/\s+/).length).toBeLessThanOrEqual(7);
    }
    expect(PROMO_BEATS.reduce((total, beat) => total + beat.holdMs, 0)).toBe(25000);
  });
});
