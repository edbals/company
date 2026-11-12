import { useCallback, useEffect, useRef, useState } from "react";
import { MUTE_KEY, play, stopAudio, subscribePlayer, type PlayerState } from "@/lib/voice-client";
import { voiceStatus } from "@/lib/voice.functions";

// ---------- readiness ----------
export type VoiceReadiness = Awaited<ReturnType<typeof voiceStatus>> | null;
let statusPromise: Promise<VoiceReadiness> | null = null;
let statusAt = 0;
/** Readiness is re-checked every minute while not ready (and on focus), so a new connection shows up without a reload. */
export function useVoiceStatus() {
  const [s, setS] = useState<VoiceReadiness>(null);
  useEffect(() => {
    let live = true;
    const load = (force = false) => {
      if (force || !statusPromise || Date.now() - statusAt > 60_000) {
        statusAt = Date.now();
        statusPromise = voiceStatus().catch(() => ({ ready: false as const, reason: "unavailable" as const, recorded: null, company: null, narrator: null }));
      }
      void statusPromise.then((v) => { if (live) setS(v); });
    };
    load();
    const t = setInterval(() => { if (!s?.ready) load(); }, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { live = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

// ---------- player ----------
export function usePlayer() {
  const [st, setSt] = useState<PlayerState>({ playing: null, loading: null, error: null });
  const [muted, setMutedState] = useState(false);
  useEffect(() => subscribePlayer(setSt), []);
  useEffect(() => { try { setMutedState(localStorage.getItem(MUTE_KEY) === "1"); } catch { /* preference only */ } }, []);
  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* preference only */ }
    if (m) stopAudio();
  }, []);
  return { ...st, muted, setMuted, play, stop: stopAudio };
}

// ---------- recorder ----------
type Rec = { start(): void; stop(): void; abort(): void; interimResults: boolean; continuous: boolean; lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type RecState = "idle" | "starting" | "listening" | "transcribing" | "error";
const MAX_MS = 60_000;

/**
 * Tap to start, tap to stop. Live words come from the browser where it can; the final words come from
 * `transcribe` (server speech-to-text) and fall back to the browser's own final result. The final text is
 * handed to `onFinal` for the person to edit and send. Nothing is sent automatically.
 */
export function useRecorder(opts: { transcribe: ((audio: Blob) => Promise<string | null>) | null; onFinal: (text: string) => void }) {
  const [state, setState] = useState<RecState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const run = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const rec = useRef<Rec | null>(null);
  const recText = useRef("");
  const recEnded = useRef<Promise<void> | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(opts); optsRef.current = opts;
  const stateRef = useRef(state); stateRef.current = state;

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && (typeof MediaRecorder !== "undefined" || !!getRecognition()));
  }, []);

  const release = useCallback(() => {
    if (cap.current) { clearTimeout(cap.current); cap.current = null; }
    try { rec.current?.abort(); } catch { /* already stopped */ }
    rec.current = null;
    if (mr.current && mr.current.state !== "inactive") { mr.current.ondataavailable = null; mr.current.onstop = null; try { mr.current.stop(); } catch { /* ignore */ } }
    mr.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const cancel = useCallback(() => { run.current++; release(); setInterim(""); setState("idle"); }, [release]);
  useEffect(() => () => { run.current++; release(); }, [release]);

  const fail = (msg: string) => { release(); setError(msg); setState("error"); };

  const start = useCallback(async () => {
    if (stateRef.current === "starting" || stateRef.current === "listening" || stateRef.current === "transcribing") return;
    stopAudio(); // never record Company's own voice
    const my = ++run.current;
    setError(null); setInterim(""); recText.current = ""; chunks.current = [];
    setState("starting");
    if (!navigator.mediaDevices?.getUserMedia) return fail("Voice isn't available in this browser. Please type instead.");
    let s: MediaStream;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) {
      if (my !== run.current) return;
      const name = e instanceof DOMException ? e.name : "";
      return fail(name === "NotAllowedError" || name === "SecurityError" ? "The microphone is blocked. Allow it in your browser, or type instead."
        : name === "NotFoundError" ? "No microphone was found. Please type instead." : "The microphone couldn't start. Please try again or type.");
    }
    if (my !== run.current) { s.getTracks().forEach((t) => t.stop()); return; }
    stream.current = s;
    s.getTracks().forEach((t) => { t.onended = () => { if (my === run.current && stateRef.current === "listening") void stopRef.current(); }; });
    if (typeof MediaRecorder !== "undefined") {
      try {
        const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t));
        const m = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
        m.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
        m.start(250);
        mr.current = m;
      } catch { mr.current = null; }
    }
    const R = getRecognition();
    if (R) {
      const r = new R();
      r.lang = "en-US"; r.interimResults = true; r.continuous = true;
      r.onresult = (ev) => {
        if (my !== run.current) return; // a cancelled recording's late words never touch the new one
        let t = "";
        for (let i = 0; i < ev.results.length; i++) t += ev.results[i]?.[0]?.transcript ?? "";
        recText.current = t.trim();
        setInterim(recText.current);
      };
      recEnded.current = new Promise<void>((resolve) => { r.onend = () => resolve(); r.onerror = () => resolve(); });
      try { r.start(); rec.current = r; } catch { rec.current = null; recEnded.current = null; }
    }
    if (!mr.current && !rec.current) return fail("Voice isn't available in this browser. Please type instead.");
    cap.current = setTimeout(() => { if (my === run.current) void stopRef.current(); }, MAX_MS);
    setState("listening");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(async () => {
    if (stateRef.current === "starting") { cancel(); return; }
    if (stateRef.current !== "listening") return;
    const my = run.current;
    setState("transcribing");
    if (cap.current) { clearTimeout(cap.current); cap.current = null; }
    const m = mr.current;
    const blobP = new Promise<Blob | null>((resolve) => {
      if (!m || m.state === "inactive") return resolve(null);
      m.onstop = () => resolve(chunks.current.length ? new Blob(chunks.current, { type: (m.mimeType || "audio/webm").split(";")[0] ?? "audio/webm" }) : null);
      try { m.stop(); } catch { resolve(null); }
    });
    try { rec.current?.stop(); } catch { /* ignore */ }
    const blob = await blobP;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null; mr.current = null;
    // Wait (briefly) for the browser's final words rather than returning stale interim text.
    if (recEnded.current) await Promise.race([recEnded.current, new Promise((r) => setTimeout(r, 1500))]);
    rec.current = null;
    if (my !== run.current) return;
    let text: string | null = null;
    const t = optsRef.current.transcribe;
    if (t && blob && blob.size > 1500) {
      try { text = await Promise.race([t(blob), new Promise<null>((r) => setTimeout(() => r(null), 25_000))]); } catch { text = null; }
    }
    if (my !== run.current) return;
    if (!text) text = recText.current || null;
    setInterim("");
    if (!text) return fail(blob && blob.size > 1500 ? "I couldn't make out the words. Please try again, or type." : "I didn't hear anything. Please try again, or type.");
    setState("idle");
    optsRef.current.onFinal(text);
  }, [cancel]);
  const stopRef = useRef(stop); stopRef.current = stop;

  return { state, interim, error, supported, start, stop, cancel, clearError: () => { setError(null); setState("idle"); } };
}

export const blobToBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});
