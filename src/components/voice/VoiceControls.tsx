import { Loader2, Mic, Square, Volume2, VolumeX } from "lucide-react";
import type { RecState } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";

/** Big tap-to-talk button. Tap once to start, tap again to stop. */
export function MicButton(props: { state: RecState; onStart: () => void; onStop: () => void; disabled?: boolean; className?: string }) {
  const { state } = props;
  const label = state === "listening" ? "Tap to stop" : state === "starting" ? "Starting the mic…" : state === "transcribing" ? "Writing down your words…" : "Tap to talk";
  return (
    <button type="button" disabled={props.disabled || state === "transcribing"}
      aria-pressed={state === "listening"}
      onClick={() => (state === "listening" || state === "starting" ? props.onStop() : props.onStart())}
      className={cn("flex min-h-20 flex-1 select-none items-center justify-center gap-3 rounded-full px-5 text-[22px] font-bold shadow-soft transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60",
        state === "listening" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground", props.className)}>
      {state === "listening" ? <Square className="size-7" aria-hidden /> : state === "transcribing" || state === "starting" ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <Mic className="size-8" aria-hidden />}
      {label}
    </button>
  );
}

/** Live words while listening; the final words become an editable draft owned by the caller. */
export function ListeningCaption({ state, interim }: { state: RecState; interim: string }) {
  if (state !== "listening" && state !== "transcribing") return null;
  return (
    <p aria-live="polite" className="min-h-14 rounded-2xl border-2 border-dashed border-accent px-4 py-3 text-[20px]">
      <span className="mb-1 flex items-center gap-2 text-[15px] font-bold uppercase tracking-wider text-agent-checkin">
        <span className={cn("size-2.5 rounded-full bg-destructive", state === "listening" && "animate-pulse")} aria-hidden />
        {state === "listening" ? "Listening" : "Writing it down"}
      </span>
      {interim || (state === "listening" ? "Go ahead, I'm listening…" : "One moment…")}
    </p>
  );
}

export function VoiceStatusNote({ ready, reason }: { ready: boolean | null; reason?: string | null }) {
  if (ready !== false) return null;
  return (
    <p className="rounded-xl border border-border bg-card px-3 py-2 text-[16px] text-muted-foreground" role="note">
      <b className="text-foreground">Voice setup needed.</b> {reason === "unavailable" ? "The voice service isn't answering right now." : "Spoken replies aren't connected yet."} Everything is shown as text.
    </p>
  );
}

export function SpeakerButtons(props: { onReplay: () => void; muted: boolean; onMute: (m: boolean) => void; playing: boolean; loading: boolean; disabled?: boolean }) {
  return (
    <div className="ml-auto flex items-center gap-1">
      <button type="button" onClick={props.onReplay} disabled={props.disabled || props.muted}
        aria-label={props.playing ? "Playing" : "Hear it again"}
        className="flex size-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-40">
        {props.loading ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Volume2 className={cn("size-6", props.playing && "text-agent-checkin")} aria-hidden />}
      </button>
      <button type="button" onClick={() => props.onMute(!props.muted)} aria-pressed={props.muted} aria-label={props.muted ? "Turn sound on" : "Mute"}
        className="flex size-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        {props.muted ? <VolumeX className="size-6" aria-hidden /> : <span className="text-[13px] font-bold">Mute</span>}
      </button>
    </div>
  );
}
