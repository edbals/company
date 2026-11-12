// Server-only: the public /demo's AI budget. One planning run spends one unit from the visitor's
// hourly and the site's daily budget; the visitor is identified only by a salted hash of their IP.
const PER_VISITOR_PER_HOUR = 12;
const GLOBAL_PER_DAY = 500;
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;
async function hashIp(ip: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`company-demo:${ip}`),
  );
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Spends one planning run from the visitor's hourly and the site's daily budget. Failure means no AI. */
export async function takeDemoQuota(ip: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const take = async (bucket: string, limit: number, window: number) => {
      const { data, error } = await supabaseAdmin.rpc("take_voice_quota", {
        _bucket: bucket,
        _limit: limit,
        _window_seconds: window,
      });
      if (error) console.error("demo quota check failed:", error.message);
      return !error && data === true;
    };
    if (!(await take(`demo:ip:${await hashIp(ip)}`, PER_VISITOR_PER_HOUR, HOUR_SECONDS)))
      return false;
    return await take("demo:global", GLOBAL_PER_DAY, DAY_SECONDS);
  } catch (err) {
    console.error("demo quota unavailable:", err instanceof Error ? err.name : "error");
    return false;
  }
}
