import { LINE_AUDIO } from "./voice-assets.gen";
// Browser-side voice: one shared audio player (no overlapping playback, cancellable) and helpers
// that fetch speech from the app's own endpoints. There is no browser speech-synthesis fallback.

export type PlayResult = "ended" | "cancelled" | "error" | "unavailable";
type Listener = (s: PlayerState) => void;
export interface PlayerState { playing: string | null; loading: string | null; error: string | null }

let audio: HTMLAudioElement | null = null;
let token = 0;
let ctrl: AbortController | null = null;
let state: PlayerState = { playing: null, loading: null, error: null };
const listeners = new Set<Listener>();
const set = (p: Partial<PlayerState>) => { state = { ...state, ...p }; listeners.forEach((l) => l(state)); };
export const subscribePlayer = (l: Listener) => { listeners.add(l); l(state); return () => { listeners.delete(l); }; };
export const playerState = () => state;

/** Stops anything playing or loading. Always call before listening so the mic never records the app. */
export function stopAudio() {
  token++;
  ctrl?.abort(); ctrl = null;
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  set({ playing: null, loading: null });
}

/** Plays one clip identified by `key`. Starting another clip cancels this one. */
export async function play(key: string, load: (signal: AbortSignal) => Promise<Blob | string | null>): Promise<PlayResult> {
  stopAudio();
  const my = ++token;
  ctrl = new AbortController();
  set({ loading: key, error: null });
  let src: string | null = null;
  try {
    const signal = ctrl.signal;
    // A stalled request must never block the next clip: cancelling resolves straight away.
    const got = await Promise.race([load(signal), new Promise<null>((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }))]);
    if (my !== token) return "cancelled";
    if (!got) { set({ loading: null, error: "unavailable" }); return "unavailable"; }
    src = typeof got === "string" ? got : URL.createObjectURL(got);
    audio ??= new Audio();
    const a = audio;
    a.src = src;
    set({ loading: null, playing: key });
    const result = await new Promise<PlayResult>((resolve) => {
      const done = (r: PlayResult) => { a.onended = null; a.onerror = null; a.onpause = null; resolve(r); };
      a.onended = () => done("ended");
      a.onerror = () => done("error");
      a.onpause = () => { if (!a.ended) done("cancelled"); };
      a.play().catch(() => done("error"));
    });
    if (my === token) set({ playing: null, error: result === "error" ? "playback" : null });
    return result;
  } catch (e) {
    if (my !== token || (e instanceof DOMException && e.name === "AbortError")) return "cancelled";
    set({ loading: null, playing: null, error: "unavailable" });
    return "error";
  } finally {
    if (src && src.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(src!), 60_000);
  }
}

export const hasFixedAudio = (text: string) => !!LINE_AUDIO[text];

export const MUTE_KEY = "company-voice-muted";

const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
// Audio only starts after the visitor has tapped or pressed a key on the page.
let unlocked = false;
if (typeof window !== "undefined") {
  const on = () => {
    unlocked = true;
    // Play a silent clip inside the tap itself so mobile Safari lets this same element play later replies.
    try { audio ??= new Audio(); audio.src = SILENT; void audio.play().then(() => audio?.pause(), () => { /* still blocked: playback errors are shown */ }); } catch { /* ignore */ }
    window.removeEventListener("pointerdown", on, true); window.removeEventListener("keydown", on, true);
  };
  window.addEventListener("pointerdown", on, true);
  window.addEventListener("keydown", on, true);
}
export const audioUnlocked = () => unlocked;

// Each line is read aloud at most once, even if a phone remounts when switching views.
const spoken = new Set<string>();
export function firstTimeSpoken(key: string) {
  if (spoken.has(key)) return false;
  spoken.add(key);
  if (spoken.size > 300) spoken.delete(spoken.values().next().value as string);
  return true;
}
export const resetSpoken = () => spoken.clear();
