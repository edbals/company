import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { RefObject } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked the system for less motion. Safe during server render. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

interface InViewOptions {
  /** Share of the element that must be visible, 0 to 1. */
  threshold?: number;
  /** Keep reporting true after the first time it was seen. */
  once?: boolean;
}

/** Reports whether an element is on screen. Falls back to true where the browser can't tell. */
export function useInView<T extends Element>({
  threshold = 0.25,
  once = true,
}: InViewOptions = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, once]);
  return [ref, inView];
}

/** How far down the first screen an element may start and still count as already visible. */
const ABOVE_FOLD_RATIO = 0.9;
const REVEAL_THRESHOLD = 0.15;

/**
 * Scroll reveal that never hides content by default. On mount, an element that starts below the
 * fold is marked pending (hidden by CSS) until it scrolls into view. Server render, no-JS and
 * already-visible elements stay visible and never animate.
 */
export function useRevealOnScroll<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (element.getBoundingClientRect().top < window.innerHeight * ABOVE_FOLD_RATIO) return;
    setPending(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setPending(false);
        observer.disconnect();
      },
      { threshold: REVEAL_THRESHOLD },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, pending];
}

// ---------- step player ----------

export interface StepPlayerState {
  /** -1 before the first step, otherwise the index of the latest step shown. */
  index: number;
  playing: boolean;
}

export type StepPlayerAction =
  | { type: "play" }
  | { type: "tick" }
  | { type: "skip" }
  | { type: "jump"; index: number }
  | { type: "reset" };

export const STEP_PLAYER_IDLE: StepPlayerState = { index: -1, playing: false };

/**
 * Pure reducer for a sequence of `count` steps. The sequence pauses on any index listed in
 * `holdAt` (for example a step that waits for the visitor's decision) and on the last step.
 */
export function createStepReducer(count: number, holdAt: readonly number[] = []) {
  const last = count - 1;
  const stopsAt = (index: number) => index >= last || holdAt.includes(index);
  const nextStop = (from: number) => {
    for (let i = from + 1; i <= last; i += 1) if (stopsAt(i)) return i;
    return last;
  };
  return (state: StepPlayerState, action: StepPlayerAction): StepPlayerState => {
    if (count <= 0) return STEP_PLAYER_IDLE;
    switch (action.type) {
      case "reset":
        return STEP_PLAYER_IDLE;
      case "jump": {
        const index = Math.max(-1, Math.min(last, action.index));
        return { index, playing: false };
      }
      case "skip": {
        const from = state.index >= last ? -1 : state.index;
        return { index: nextStop(from), playing: false };
      }
      case "play": {
        const from = state.index >= last ? -1 : state.index;
        const index = from + 1;
        return { index, playing: !stopsAt(index) };
      }
      case "tick": {
        if (!state.playing) return state;
        const index = state.index + 1;
        return { index, playing: !stopsAt(index) };
      }
    }
  };
}

interface StepPlayerOptions {
  /** Delay before each next step, in milliseconds. */
  stepMs?: number | ((index: number) => number);
  holdAt?: readonly number[];
}

export interface StepPlayer extends StepPlayerState {
  /** True once the last step is showing. */
  done: boolean;
  /** Start, or continue past a hold. Restarts from the top when already done. */
  play: () => void;
  reset: () => void;
  jump: (index: number) => void;
}

const DEFAULT_STEP_MS = 900;

/**
 * Plays a fixed sequence of steps on a timer. With reduced motion, `play` jumps straight to the
 * next hold (or the end) so nothing animates but every state is still reachable.
 */
export function useStepPlayer(count: number, options: StepPlayerOptions = {}): StepPlayer {
  const { stepMs = DEFAULT_STEP_MS, holdAt } = options;
  const holdKey = (holdAt ?? []).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- holdKey captures holdAt by value
  const reducer = useMemo(() => createStepReducer(count, holdAt ?? []), [count, holdKey]);
  const [state, dispatch] = useReducer(reducer, STEP_PLAYER_IDLE);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!state.playing) return;
    const delay = typeof stepMs === "function" ? stepMs(state.index) : stepMs;
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), delay);
    return () => window.clearTimeout(timer);
  }, [state.playing, state.index, stepMs]);

  const play = useCallback(
    () => dispatch({ type: reducedMotion ? "skip" : "play" }),
    [reducedMotion],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const jump = useCallback((index: number) => dispatch({ type: "jump", index }), []);

  return { ...state, done: state.index >= count - 1, play, reset, jump };
}
