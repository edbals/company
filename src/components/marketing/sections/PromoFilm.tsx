import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Armchair, Clock, Music2, Pause, Play, ShieldCheck, UserRound } from "lucide-react";
import { useInView, usePrefersReducedMotion, useStepPlayer } from "../hooks";
import { ExampleNote } from "../primitives";
import { FILM_HELPERS, FILM_LIMITS, FILM_TASKS, PLAN_ROWS, PROMO_BEATS } from "../promo-script";
import type { Beat } from "../promo-script";
import "./PromoFilm.css";

const FIRST_BEAT = PROMO_BEATS[0]!;
const HOLDS = PROMO_BEATS.map((_, index) => index);
const order = (index: number): CSSProperties => ({ "--i": index }) as CSSProperties;

/** Keep the remaining duration when either the visitor or scrolling pauses the film. */
function useBeatClock(index: string, playing: boolean, duration: number, next: () => void) {
  const clock = useRef({ index, remaining: duration });
  useEffect(() => {
    if (clock.current.index !== index) clock.current = { index, remaining: duration };
    if (!playing) return;
    const started = Date.now();
    const timer = window.setTimeout(next, clock.current.remaining);
    return () => {
      window.clearTimeout(timer);
      clock.current.remaining = Math.max(0, clock.current.remaining - (Date.now() - started));
    };
  }, [index, playing, duration, next]);
}

function useFilmPlayer() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.5, once: false });
  const steps = useStepPlayer(PROMO_BEATS.length, { holdAt: HOLDS });
  const index = Math.max(0, steps.index);
  const beat = PROMO_BEATS[index] ?? FIRST_BEAT;
  const [intent, setIntent] = useState(false);
  const [still, setStill] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [revision, setRevision] = useState(0);
  const [finished, setFinished] = useState(false);
  const sceneKey = `${index}-${revision}`;
  const started = useRef(false);
  const playing = intent && inView && !reduced;
  useEffect(() => {
    if (reduced) setIntent(false);
    if (!inView || reduced || started.current) return;
    started.current = true;
    setStill(false);
    setIntent(true);
  }, [inView, reduced]);
  const next = useCallback(() => {
    if (index === PROMO_BEATS.length - 1) {
      setIntent(false);
      setFinished(true);
    } else steps.jump(index + 1);
  }, [index, steps.jump]);
  useBeatClock(sceneKey, playing, beat.holdMs, next);
  const jump = (target: number) => {
    started.current = true;
    setIntent(false);
    setStill(true);
    setFinished(false);
    setRevision((value) => value + 1);
    steps.jump(target);
    setAnnouncement(PROMO_BEATS[target]?.headline ?? "");
  };
  const toggle = () => {
    started.current = true;
    setStill(false);
    setIntent(!playing);
  };
  const replay = () => {
    jump(0);
    if (!reduced) {
      setStill(false);
      setIntent(true);
    }
  };
  return {
    ref,
    index,
    beat,
    sceneKey,
    finished,
    reduced,
    playing,
    still,
    announcement,
    jump,
    toggle,
    replay,
  };
}

function Headline({ beat }: { beat: Beat }) {
  const words = beat.headline.split(" ");
  let offset = 0;
  const ranges = (beat.accent ?? []).map((accent) => {
    const start = beat.headline.indexOf(accent);
    return { start, end: start + accent.length };
  });
  return (
    <div className="film-copy">
      <h3 className="film-headline">
        {words.map((word, i) => {
          const accent = ranges.some(
            ({ start, end }) => offset + word.length > start && offset < end,
          );
          offset += word.length + 1;
          return (
            <span key={i} className={`film-word${accent ? " film-accent" : ""}`} style={order(i)}>
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </h3>
      {beat.sub && <p className="film-sub">{beat.sub}</p>}
    </div>
  );
}

function TaskPile({ withMaya = false }: { withMaya?: boolean }) {
  return (
    <div className={`film-pile${withMaya ? " film-pile--maya" : ""}`}>
      {FILM_TASKS.map((task, i) => (
        <span className="film-task" key={task} style={order(i)}>
          {task}
        </span>
      ))}
      {withMaya && (
        <div className="film-person">
          <UserRound size={36} />
          <strong>Maya</strong>
        </div>
      )}
    </div>
  );
}

function JazzScene({ together = false }: { together?: boolean }) {
  return (
    <div className={`film-jazz${together ? " film-jazz--together" : ""}`}>
      <div className="film-marquee">
        <Music2 size={28} />
        <span>LIVE JAZZ</span>
        <Music2 size={28} />
      </div>
      <div className="film-friends">
        <div className="film-person">
          <UserRound size={48} />
          <strong>Joe</strong>
        </div>
        <span className="film-music">♪ ♫ ♪</span>
        <div className="film-person">
          <UserRound size={48} />
          <strong>Walt</strong>
        </div>
      </div>
    </div>
  );
}

function Scene({ scene }: { scene: Beat["scene"] }) {
  switch (scene) {
    case "wish":
      return <JazzScene />;
    case "pile":
      return <TaskPile />;
    case "maya":
      return <TaskPile withMaya />;
    case "home":
      return (
        <div className="film-alone">
          <Armchair size={96} strokeWidth={1.2} />
          <span>Joe</span>
        </div>
      );
    case "ask":
      return (
        <div className="film-listening">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      );
    case "team":
      return (
        <div className="film-work">
          {FILM_HELPERS.map((helper) => (
            <div key={helper.agent} className="film-helper">
              <span className="film-working" />
              <strong>{helper.agent}</strong>
              <span>{helper.name}</span>
            </div>
          ))}
        </div>
      );
    case "checks":
      return (
        <div className="film-checks">
          <span>
            <ShieldCheck size={32} />
            Safety
          </span>
          <span>
            <Clock size={32} />
            Timing
          </span>
          <p>2pm reminder → move before jazz?</p>
        </div>
      );
    case "plan":
      return (
        <div className="film-plan">
          <p className="film-card-label">Suggested plan</p>
          <strong className="film-plan-title">Thursday jazz · 2pm</strong>
          <ul>
            {PLAN_ROWS.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <div className="film-choices">
            <span>Yes to this plan</span>
            <span>Change it</span>
          </div>
        </div>
      );
    case "family":
      return (
        <div className="film-request">
          <p className="film-card-label">In Company · after Joe’s yes</p>
          <strong>Maya, could you help with a lift?</strong>
          <span className="film-request-count">1 request</span>
        </div>
      );
    case "memory":
      return (
        <div className="film-memory">
          <Music2 size={36} />
          <strong>Remember afternoon jazz?</strong>
          <span>Only if Joe says yes.</span>
        </div>
      );
    case "payoff":
      return <JazzScene together />;
  }
}

type Player = ReturnType<typeof useFilmPlayer>;

function Controls({ player }: { player: Player }) {
  const { index, playing, reduced, jump, toggle, replay } = player;
  return (
    <div className="film-controls">
      <div className="film-actions">
        {reduced ? (
          <>
            <button type="button" disabled={index === 0} onClick={() => jump(index - 1)}>
              Previous
            </button>
            <button
              type="button"
              disabled={index === PROMO_BEATS.length - 1}
              onClick={() => jump(index + 1)}
            >
              Next
            </button>
          </>
        ) : (
          <button
            type="button"
            className="film-play"
            aria-label={playing ? "Pause film" : "Play film"}
            onClick={player.finished ? replay : toggle}
          >
            {playing ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
          </button>
        )}
        {index === PROMO_BEATS.length - 1 && (
          <button type="button" onClick={replay}>
            Watch again
          </button>
        )}
      </div>
      <div
        className="film-progress"
        role="group"
        aria-label="Film chapters"
        style={{ "--beat-count": PROMO_BEATS.length } as CSSProperties}
      >
        {PROMO_BEATS.map((beat, i) => (
          <button
            key={beat.id}
            type="button"
            aria-label={`Beat ${i + 1}: ${beat.headline}`}
            aria-current={i === index ? "step" : undefined}
            onClick={() => jump(i)}
            className={i < index ? "film-complete" : ""}
          >
            <span className="film-track">
              <span
                key={`${player.sceneKey}-${i}`}
                className={i === index ? "film-fill film-fill--current" : "film-fill"}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Transcript() {
  return (
    <ol className="m-visually-hidden" aria-label="Film transcript">
      {PROMO_BEATS.map((beat) => (
        <li key={beat.id}>
          {beat.headline}
          {beat.sub && ` ${beat.sub}`} {beat.description}
        </li>
      ))}
    </ol>
  );
}

export function PromoFilm() {
  const player = useFilmPlayer();
  const { ref, beat, playing, reduced, still, announcement } = player;
  return (
    <div className="film">
      <div
        ref={ref}
        className="film-stage"
        data-playing={playing}
        data-still={still || reduced}
        data-reduced={reduced}
        style={
          {
            "--duration": `${beat.holdMs}ms`,
          } as CSSProperties
        }
      >
        <div
          key={player.sceneKey}
          className={`film-scene film-scene--${beat.scene}`}
          aria-hidden="true"
        >
          <Headline beat={beat} />
          <Scene scene={beat.scene} />
        </div>
        <Controls player={player} />
      </div>
      <Transcript />
      <p className="m-visually-hidden" role="status" aria-atomic="true">
        {announcement}
      </p>
      <ExampleNote>
        Illustrated example. Nothing is booked or sent without Joe’s yes. {FILM_LIMITS}
      </ExampleNote>
    </div>
  );
}
