// Voice for signed-in people: their own spoken replies and speech-to-text. Never cached publicly.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function userQuota(userId: string, kind: "tts" | "stt") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("take_voice_quota", { _bucket: `user-${kind}:${userId}`, _window_seconds: 86400, _limit: 300 });
  return !error && data === true;
}

/** Readiness only: whether a voice is connected and which voices were verified. Never the key. */
export const voiceStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveVoices, voiceConfigured } = await import("./voice.server");
  if (!voiceConfigured()) return { ready: false as const, reason: "setup_needed" as const, recorded: null, company: null, narrator: null };
  const { voices } = await resolveVoices();
  if (!voices) return { ready: false as const, reason: "unavailable" as const, recorded: null, company: null, narrator: null };
  const { VOICE_NAMES } = await import("./voice-assets.gen");
  return { ready: true as const, reason: null, recorded: VOICE_NAMES, company: { name: voices.company.name, preferred: voices.company.preferred }, narrator: { name: voices.narrator.name, preferred: voices.narrator.preferred } };
});

export const speakLine = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().trim().min(1).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await userQuota(context.userId, "tts"))) return { audio: null, busy: true };
    const { synthesize, toBase64 } = await import("./voice.server");
    try {
      const buf = await synthesize(data.text, "company");
      return { audio: toBase64(buf), busy: false };
    } catch {
      return { audio: null, busy: false };
    }
  });

/** About 60 seconds of compressed speech at most. Audio is passed through once and not stored. */
export const transcribeSpeech = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ audio: z.string().min(100).max(1_500_000), mime: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await userQuota(context.userId, "stt"))) return { text: null, busy: true };
    const { transcribe, fromBase64 } = await import("./voice.server");
    try {
      const text = await transcribe(new Blob([fromBase64(data.audio)], { type: data.mime }));
      return { text: text.slice(0, 400), busy: false };
    } catch {
      return { text: null, busy: false };
    }
  });
