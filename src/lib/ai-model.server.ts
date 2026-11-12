// Server-only: one bounded model call, returning parsed JSON. Uses Claude directly when
// ANTHROPIC_API_KEY or GEMINI_API_KEY is set (Vercel hosting); otherwise the Lovable AI gateway.
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

const GEMINI_MODEL = "gemini-3.8-flash";
/** Gemini can think before answering, so it gets a little more time than the default budget. */
const GEMINI_MIN_BUDGET_MS = 12000;
const GEMINI_MAX_TOKENS = 8192;

async function askGemini(key: string, instructions: string, payload: unknown, signal: AbortSignal): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
      // Gemini spends output tokens on thinking first, so leave room for the answer too.
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: GEMINI_MAX_TOKENS },
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
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
  const usesGemini = !process.env["ANTHROPIC_API_KEY"] && !!process.env["GEMINI_API_KEY"];
  const timer = setTimeout(() => ctrl.abort(), usesGemini ? Math.max(budgetMs, GEMINI_MIN_BUDGET_MS) : budgetMs);
  try {
    const claude = process.env["ANTHROPIC_API_KEY"];
    if (claude) return await askClaude(claude, instructions, payload, ctrl.signal);
    const gemini = process.env["GEMINI_API_KEY"];
    if (gemini) return await askGemini(gemini, instructions, payload, ctrl.signal);
    return await askLovable(instructions, payload, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}
