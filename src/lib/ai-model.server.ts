// Server-only: one bounded model call, returning parsed JSON. Uses Claude directly when
// ANTHROPIC_API_KEY is set (Vercel hosting); otherwise the Lovable AI gateway.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const CLAUDE_MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 600;

function outputText(res: unknown): string {
  const r = res as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  for (const item of r.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text" && c.text) return c.text;
  return "";
}

/** Pulls the first JSON object out of a reply, tolerating code fences or a leading sentence. */
function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model reply had no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

async function askClaude(key: string, instructions: string, payload: unknown, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: `${instructions}\nReply with one JSON object only, no other text.`,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude request failed: ${res.status}`);
  const body = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parseJson(text);
}

async function askLovable(instructions: string, payload: unknown, signal: AbortSignal): Promise<unknown> {
  const { generateResponse } = await import("@lovable.dev/ai-gateway");
  const res = await generateResponse(
    {
      model: "openai/gpt-6-astra",
      instructions,
      input: [{ role: "user", content: `Return JSON only.\n${JSON.stringify(payload)}` }],
      text: { format: { type: "json_object" } },
      reasoning: { effort: "low" },
    },
    { signal, maxRetries: 0 },
  );
  return JSON.parse(outputText(res));
}

export async function askModel(instructions: string, payload: unknown, budgetMs = 5500): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budgetMs);
  try {
    const key = process.env['ANTHROPIC_API_KEY'];
    return key ? await askClaude(key, instructions, payload, ctrl.signal) : await askLovable(instructions, payload, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}
