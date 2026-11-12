import { useEffect, useReducer, useRef } from "react";
import { DemoProfile } from "@/lib/demo-plan";
import { planDemo } from "@/lib/demo.functions";
import { demoReducer, initialState } from "./demo-state";
import type { DemoAction, DemoState } from "./demo-state";

const STORAGE_KEY = "company-demo-profile";
const ERROR_MESSAGE = "Sorry, I couldn’t reach the planner just now. Your words are still here.";

function readProfile(): DemoProfile | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? DemoProfile.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile: DemoProfile): void {
  try {
    if (profile.name) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows can block storage; the demo still works without it.
  }
}

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Vancouver";
  } catch {
    return "America/Vancouver";
  }
}

/** Demo state plus its side effects: the planner call, the undo countdown and the saved profile. */
export function useDemo(): [DemoState, (action: DemoAction) => void] {
  const [state, dispatch] = useReducer(demoReducer, null, () => initialState());
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const profile = readProfile();
    if (profile) dispatch({ type: "reset", profile });
  }, []);

  useEffect(() => {
    if (restored.current) writeProfile(state.profile);
  }, [state.profile]);

  useEffect(() => {
    if (state.screen !== "working") return;
    let live = true;
    planDemo({ data: { profile: state.profile, words: state.words, timezone: timezone() } })
      .then((result) => live && dispatch({ type: "resolved", result }))
      .catch(() => live && dispatch({ type: "failed", message: ERROR_MESSAGE }));
    return () => {
      live = false;
    };
  }, [state.screen, state.profile, state.words]);

  useEffect(() => {
    if (state.screen !== "undo" || state.seconds === 0) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearTimeout(timer);
  }, [state.screen, state.seconds]);

  return [state, dispatch];
}
