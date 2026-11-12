import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Keyboard } from "lucide-react";
import { toast } from "sonner";
import type { AgentDraft } from "@/lib/planning-agents.server";
import { endCheckin, rememberLive, talkLive } from "@/lib/agents.functions";
import { speakLine, transcribeSpeech } from "@/lib/voice.functions";
import { createErrand, createPlan, listEvents, saveFact } from "@/lib/app.functions";
import { fmtWhen } from "@/lib/plan-logic";
import { blobToBase64, usePlayer, useRecorder, useVoiceStatus } from "@/hooks/use-voice";
import { ListeningCaption, MicButton, SpeakerButtons, VoiceStatusNote } from "@/components/voice/VoiceControls";
import { audioUnlocked, firstTimeSpoken } from "@/lib/voice-client";
import { btn, input, newKey } from "@/components/app/kit";
import { cn } from "@/lib/utils";
import { PersonalPlanForm } from "@/components/app/PersonalPlanForm";

export const Route = createFileRoute("/_authenticated/app/talk")({ component: Talk });

type Line = { who: "you" | "company"; text: string; source?: "ai" | "ready" };
const AI_BUDGET_MS = 19000;

function Talk() {
  const { me } = Route.useRouteContext() as unknown as { me: { display_name: string; timezone: string; read_aloud: boolean } };
  const talk = useServerFn(talkLive);
  const remember = useServerFn(rememberLive);
  const keep = useServerFn(saveFact);
  const plan = useServerFn(createPlan);
  const errand = useServerFn(createErrand);
  const fetchEvents = useServerFn(listEvents);
  const events = useQuery({ queryKey: ["events", ""], queryFn: () => fetchEvents({ data: { q: "" } }) });
  const navigate = useNavigate();
  const say = useServerFn(speakLine);
  const hear = useServerFn(transcribeSpeech);
  const end = useServerFn(endCheckin);
  const player = usePlayer();
  const voice = useVoiceStatus();
  const first = me.display_name.split(" ")[0];
  const [lines, setLines] = useState<Line[]>([{ who: "company", text: `Morning, ${first}. How are you doing today?` }]);
  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [found, setFound] = useState<{ eventIds: string[]; needs: string[] }>({ eventIds: [], needs: [] });
  const [personalGoal, setPersonalGoal] = useState<string | null>(null);
  const [showPersonalForm, setShowPersonalForm] = useState(false);
  const [proposals, setProposals] = useState<{ kind: "person" | "like" | "routine"; text: string }[] | null>(null);
  const checkinId = useRef<string | null>(null);
  const latest = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; latest.current = null; player.stop(); if (checkinId.current) void end({ data: { checkinId: checkinId.current } }).catch(() => undefined); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const last = [...lines].reverse().find((l) => l.who === "company");
  // Personal replies are spoken through the signed-in voice service; nothing is cached publicly.
  const speak = (text: string) => {
    if (!voice?.ready || player.muted) return;
    void player.play(`app:${text}`, async () => {
      const r = await say({ data: { text } });
      return r.audio ? `data:audio/mpeg;base64,${r.audio}` : null;
    });
  };
  useEffect(() => {
    if (!me.read_aloud || !last || !voice?.ready || player.muted || !audioUnlocked()) return;
    if (firstTimeSpoken(`app:${lines.length}:${last.text}`)) speak(last.text);
  }, [last?.text, voice?.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const mic = useRecorder({
    transcribe: voice?.ready ? async (blob) => {
      if (blob.size > 1_100_000) return null;
      const r = await hear({ data: { audio: await blobToBase64(blob), mime: blob.type || "audio/webm" } });
      return r.text;
    } : null,
    onFinal: (t) => { setDraft(t); setTyping(true); },
  });

  const send = async (text: string) => {
    const words = text.trim();
    if (!words || thinking) return;
    const requestId = newKey();
    latest.current = requestId;
    mic.cancel(); player.stop();
    setDraft(""); setThinking(true);
    setAgentDraft(null);
    setFound({ eventIds: [], needs: [] });
    setPersonalGoal(null); setShowPersonalForm(false);
    setLines((l) => [...l, { who: "you", text: words }]);
    const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), AI_BUDGET_MS + 1500));
    try {
      const res = await Promise.race([talk({ data: { checkinId: checkinId.current, words, requestId } }), timeout]);
      if (!alive.current || latest.current !== requestId) return; // stale
      if (res === "timeout") { setLines((l) => [...l, { who: "company", text: "Sorry, I'm slow just now. You can browse what's on, or start a personal plan.", source: "ready" }]); setPersonalGoal(words); return; }
      checkinId.current = res.checkinId ?? null;
      setLines((l) => [...l, { who: "company", text: res.reply, source: res.source }]);
      setAgentDraft("draft" in res ? res.draft ?? null : null);
      setFound({ eventIds: res.eventIds, needs: res.needs });
      if (!res.eventIds.length && !res.needs.length && !/^(not today|no thanks|nothing|hi|hello|hey|good morning|thanks|thank you)[.! ]*$/i.test(words)) setPersonalGoal(words);
    } catch {
      if (latest.current === requestId) setLines((l) => [...l, { who: "company", text: "I couldn't reach the service. Your words weren't lost; please try again.", source: "ready" }]);
    } finally { if (latest.current === requestId) setThinking(false); }
  };

  const finish = async () => {
    latest.current = null;
    mic.cancel(); player.stop();
    if (!checkinId.current) { navigate({ to: "/app" }); return; }
    setThinking(true);
    const id = checkinId.current;
    checkinId.current = null;
    try { const r = await remember({ data: { checkinId: id } }); setProposals(r.proposals); if (!r.proposals.length) navigate({ to: "/app" }); }
    catch { void end({ data: { checkinId: id } }).catch(() => undefined); navigate({ to: "/app" }); } finally { setThinking(false); }
  };

  const matched = found.eventIds.flatMap((id) => (events.data ?? []).filter((event) => event.id === id));
  const familySuggestion = agentDraft && { ride: "Ask family for a ride", invite: "Invite family", update: "Share a plan update with family", none: null }[agentDraft.family];

  if (proposals) return (
    <section className="space-y-4">
      <h1 className="font-display text-[30px]">Should Company remember these?</h1>
      <p className="text-[19px] text-muted-foreground">Only what you keep is saved. You can change or forget it any time.</p>
      {proposals.map((p, i) => (
        <div key={p.text} className="card-soft space-y-3 p-4">
          <p className="text-[22px]">“{p.text}”</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.primary} onClick={async () => { await keep({ data: { kind: p.kind, text: p.text, source: "You agreed after a chat" } }); setProposals((x) => x!.filter((_, j) => j !== i)); toast("Saved."); }}>Keep</button>
            <button className={btn.secondary} onClick={() => setProposals((x) => x!.filter((_, j) => j !== i))}>Don't keep</button>
          </div>
        </div>
      ))}
      <button className={btn.ghost} onClick={() => navigate({ to: "/app" })}>Done</button>
    </section>
  );

  return (
    <div className="space-y-5">
      <div aria-live="polite">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[17px] font-bold text-agent-checkin">Company</span>
          {last?.source === "ai" && <span className="rounded-full bg-primary px-2 py-px text-[12px] font-bold uppercase tracking-wider text-primary-foreground">AI</span>}
          {last?.source === "ready" && <span className="rounded-full border border-border px-2 py-px text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Ready reply</span>}
          <SpeakerButtons onReplay={() => last && speak(last.text)} muted={player.muted} onMute={player.setMuted} playing={!!player.playing} loading={!!player.loading} disabled={!voice?.ready || !last} />
        </div>
        <p className="font-display text-[30px] leading-snug">{last?.text}</p>
      </div>
      {lines.filter((l) => l.who === "you").slice(-1).map((l) => <p key={l.text} className="rounded-2xl bg-secondary px-4 py-3"><span className="block text-[16px] font-bold text-muted-foreground">You said</span>“{l.text}”</p>)}
      {thinking && <p role="status" className="text-muted-foreground animate-pulse">Company is thinking…</p>}

      {agentDraft && (agentDraft.ride !== "undecided" || familySuggestion) && (
        <section className="card-soft p-4" aria-label="Suggestions for your plan">
          <h2 className="font-bold">Ideas for your plan</h2>
          {agentDraft.ride === "own_way" && <p>Make your own way there.</p>}
          {agentDraft.ride === "family" && familySuggestion !== "Ask family for a ride" && <p>Ask family for a ride.</p>}
          {familySuggestion && <p>{familySuggestion}.</p>}
          <p className="text-muted-foreground">Nothing has been shared.</p>
        </section>
      )}
      {(matched.length > 0 || found.needs.length > 0) && (
        <section className="space-y-3">
          {matched.map((e) => (
            <button key={e.id} className="card-soft block w-full p-4 text-left" onClick={async () => { const r = await plan({ data: { eventId: e.id } }); navigate({ to: "/app/plans/$planId", params: { planId: r.id } }); }}>
              <span className="block font-display text-[24px]">{e.title}</span>
              <span className="block text-[18px] text-muted-foreground">{fmtWhen(e, me.timezone)} · {e.place}</span>
              <span className="mt-1 block text-[18px] font-bold text-agent-coordinator">{e.id === agentDraft?.eventId ? "Suggested · Plan this →" : "Plan this →"}</span>
            </button>
          ))}
          {found.needs.map((n) => (
            <button key={n} className={btn.secondary} onClick={async () => { const r = await errand({ data: { item: n, need_by: null } }); navigate({ to: "/app/errands/$errandId", params: { errandId: r.id } }); }}>Sort out the {n}</button>
          ))}
        </section>
      )}
      {personalGoal && !showPersonalForm && <button className={btn.secondary} onClick={() => setShowPersonalForm(true)}>Start a personal plan from this</button>}
      {personalGoal && showPersonalForm && <PersonalPlanForm initialTitle={personalGoal} onCancel={() => setShowPersonalForm(false)} />}

      <ListeningCaption state={mic.state} interim={mic.interim} />
      {mic.state === "error" && mic.error && <p role="alert" className="rounded-2xl bg-alert-soft px-4 py-3 text-[19px]">{mic.error}</p>}
      {(typing || draft) && mic.state !== "listening" && mic.state !== "transcribing" && (
        <label className="block">
          <span className="mb-1 block text-[16px] font-bold text-muted-foreground">Your words — change anything before sending</span>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} aria-label="Your answer" className={input + " py-3"} placeholder="Type here" />
        </label>
      )}
      <div className="flex items-center gap-3">
        <MicButton state={mic.state} onStart={() => void mic.start()} onStop={() => void mic.stop()} disabled={!mic.supported || thinking} />
        <button aria-label={typing ? "Hide keyboard" : "Type instead"} onClick={() => setTyping((t) => !t)} className="tap flex w-14 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground"><Keyboard className="size-6" /></button>
      </div>
      {!mic.supported && <p className="text-[17px] text-muted-foreground">The microphone isn't available in this browser. Use the keyboard instead.</p>}
      <VoiceStatusNote ready={voice ? voice.ready : null} reason={voice?.reason ?? null} />
      {draft.trim() && <button className={btn.primary} disabled={thinking} onClick={() => send(draft)}>Send</button>}
      <div className="flex flex-wrap gap-2">
        <button className={btn.ghost} onClick={() => send("Not today.")}>Not today</button>
        <button className={btn.ghost} onClick={finish}>I'm done</button>
      </div>
    </div>
  );
}
