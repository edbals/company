// Server-only ElevenLabs helpers. The key never leaves the server.
const API = "https://api.elevenlabs.io";

export const PREFERRED = {
  company: { id: "OZ0L6eISlOejga3XjDFt", name: "Talia — Warm Soft Guide" },
  narrator: { id: "gOupLcAkjEnguROwi4oS", name: "Darian — Warm Grounded Storyteller" },
} as const;
export type VoiceRole = keyof typeof PREFERRED;
/** Premade voices any plan can use, chosen for the same warm, clear qualities. */
export const FALLBACK = {
  company: { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella — Professional, Bright, Warm" },
  narrator: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George — Warm, Captivating Storyteller" },
} as const;
const T = { discover: 8_000, tts: 15_000, stt: 20_000 };
const withDeadline = (ms: number, outer?: AbortSignal) => (outer ? AbortSignal.any([outer, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms));

const key = () => process.env["ELEVENLABS_API_KEY"] || null;
export const voiceConfigured = () => !!key();

type Resolved = { id: string; name: string; preferred: boolean };
let cache: { at: number; voices: Record<VoiceRole, Resolved> | null; error: string | null } | null = null;

async function voiceInfo(id: string): Promise<{ category: string } | null> {
  const r = await fetch(`${API}/v1/voices/${id}`, { headers: { "xi-api-key": key()! }, signal: withDeadline(T.discover) });
  if (!r.ok) return null;
  const j = (await r.json()) as { category?: string };
  return { category: j.category ?? "unknown" };
}
async function tier(): Promise<string> {
  const r = await fetch(`${API}/v1/user/subscription`, { headers: { "xi-api-key": key()! }, signal: withDeadline(T.discover) });
  if (!r.ok) return "unknown";
  return ((await r.json()) as { tier?: string }).tier ?? "unknown";
}

/** Uses the chosen voices when the account's plan allows them through the API; otherwise the warm premade fallbacks. Cached 10 minutes per worker. */
export async function resolveVoices(): Promise<{ voices: Record<VoiceRole, Resolved> | null; error: string | null }> {
  if (!key()) return { voices: null, error: "not_configured" };
  if (cache && Date.now() - cache.at < 600_000) return cache;
  try {
    const out = {} as Record<VoiceRole, Resolved>;
    for (const role of ["company", "narrator"] as VoiceRole[]) {
      // Fixed recordings and live replies must use the same voice. A plan upgrade must
      // not silently change the person's voice or trigger paid-library retries.
      const configuredId = process.env[role === "company" ? "COMPANY_VOICE_ID" : "NARRATOR_VOICE_ID"];
      const configuredName = process.env[role === "company" ? "COMPANY_VOICE_NAME" : "NARRATOR_VOICE_NAME"];
      out[role] = configuredId ? { id: configuredId, name: configuredName || "Selected voice", preferred: true } : { ...FALLBACK[role], preferred: false };
    }
    cache = { at: Date.now(), voices: out, error: null };
  } catch (e) {
    cache = { at: Date.now() - 540_000, voices: null, error: e instanceof Error ? e.message : "unavailable" };
  }
  return cache;
}

export async function synthesize(text: string, role: VoiceRole, signal?: AbortSignal): Promise<ArrayBuffer> {
  const { voices } = await resolveVoices();
  if (!voices) throw new Error("voice_unavailable");
  const call = (voiceId: string) => fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST", signal: withDeadline(T.tts, signal),
    headers: { "xi-api-key": key()!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true, speed: role === "company" ? 0.95 : 1 } }),
  });
  let r = await call(voices[role].id);
  if (!r.ok) throw new Error(`tts_failed_${r.status}`);
  return r.arrayBuffer();
}

/** Speech to text. The audio is sent once and never stored. */
export async function transcribe(audio: Blob, signal?: AbortSignal): Promise<string> {
  if (!key()) throw new Error("voice_unavailable");
  const fd = new FormData();
  fd.append("model_id", "scribe_v2");
  fd.append("language_code", "eng");
  fd.append("tag_audio_events", "false");
  const ext = /mp4|aac|m4a/.test(audio.type) ? "m4a" : /ogg/.test(audio.type) ? "ogg" : /wav/.test(audio.type) ? "wav" : "webm";
  fd.set("file", audio, `speech.${ext}`);
  const r = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key()! }, body: fd, signal: withDeadline(T.stt, signal) });
  if (!r.ok) throw new Error(`stt_failed_${r.status}`);
  const j = (await r.json()) as { text?: string };
  return (j.text ?? "").replace(/\s+/g, " ").trim();
}

export function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
