import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./hooks";
import "./Intro.css";

interface IntroProps {
  onPlay?: () => void;
}

/** Client-only so the page remains available during SSR and hydration. */
export function Intro({ onPlay }: IntroProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [showing, setShowing] = useState(false);
  const decided = useRef(false);
  const finish = useCallback(() => setShowing(false), []);

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    // The shared hook updates in an effect; check the initial preference before showing.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Plays on every page load (by request), so there is no "seen" memory.
    onPlay?.();
    setShowing(true);
  }, [onPlay]);

  return showing && !reducedMotion ? <IntroSequence onFinish={finish} /> : null;
}

function IntroSequence({ onFinish }: { onFinish: () => void }) {
  const bear = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState("blank");
  const [skipping, setSkipping] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const skip = useRef<() => void>(() => {});

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timers.push(window.setTimeout(callback, delay));
    };
    const clearTimers = () => timers.forEach((timer) => window.clearTimeout(timer));
    let dismissed = false;
    skip.current = () => {
      if (dismissed) return;
      dismissed = true;
      clearTimers();
      setSkipping(true);
      schedule(onFinish, 200);
    };
    const onInteraction = () => skip.current();
    const events = ["click", "keydown", "wheel", "touchmove"] as const;
    for (const event of events) {
      window.addEventListener(event, onInteraction, { capture: true, passive: true });
    }

    schedule(() => setPhase("greeting"), 300);
    schedule(() => setTextVisible(true), 1600);
    schedule(() => setPhase("still"), 2300);
    schedule(() => {
      const target = document.querySelector("#hero-title .m-avatar");
      const element = bear.current;
      if (target && element) {
        const from = element.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        if (from.width > 0 && from.height > 0 && to.width > 0 && to.height > 0) {
          element.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
        }
      }
      setPhase("leaving");
    }, 3000);
    schedule(onFinish, 3600);

    return () => {
      clearTimers();
      for (const event of events) window.removeEventListener(event, onInteraction, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onFinish]);

  return (
    <div
      className={`intro-overlay intro-${phase}${skipping ? " intro-skipping" : ""}`}
      data-testid="company-intro"
    >
      <div aria-hidden="true">
        <div className="intro-bear" ref={bear}>
          <img className="intro-media" src="/avatar/company-poster.png" alt="" />
          {phase === "greeting" && !skipping && (
            <video
              className="intro-media"
              src="/avatar/company-greet.mp4"
              poster="/avatar/company-poster.png"
              autoPlay
              muted
              playsInline
              tabIndex={-1}
            />
          )}
        </div>
        <p className={`intro-title${textVisible ? " intro-title-visible" : ""}`}>
          AI planning for <span>older adults</span>
        </p>
      </div>
      <button className="intro-skip" type="button" onClick={() => skip.current()}>
        Skip
      </button>
    </div>
  );
}
