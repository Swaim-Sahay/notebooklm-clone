const { Groq } = require("groq-sdk");
const { GROQ_API_KEY } = require("../utils/env");

let client = null;
function getClient() {
  if (!client) client = new Groq({ apiKey: GROQ_API_KEY });
  return client;
}

const FAITH_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = [
  "You are a faithfulness judge for a RAG system.",
  "Given a question, a generated answer, and the source passages the answer",
  "was grounded in, judge whether every atomic claim in the answer is supported",
  "by the source passages.",
  "Return a JSON object with exactly these fields:",
  '  "score":  number from 0.0 to 1.0 (1.0 = every claim is supported, 0.0 = nothing is supported)',
  '  "unsupported": string[] (one short snippet per unsupported claim; empty if all supported)',
  "Output ONLY the JSON object, no prose, no code fences.",
].join("\n");

const PER_BLOCK_CHARS = 900;
const MAX_TOTAL_CHARS = 14000;

/**
 * Score how faithful the answer is to the retrieved context.
 *
 * @param {string} answer
 * @param {Array<{ fileName?: string, chunkIndex?: number, text?: string }>} sources
 * @returns {Promise<{ score: number, unsupported?: string[] } | null>}
 *          Returns null if scoring fails for any reason (network, parse, etc.)
 *          so the caller can omit the badge rather than showing bogus numbers.
 */
async function scoreFaithfulness(answer, sources) {
  const trimmedAnswer = (answer || "").trim();
  if (!trimmedAnswer) return null;
  if (!Array.isArray(sources) || !sources.length) return null;

  const blocks = sources.map((s, i) => {
    const t = (s.text || "").slice(0, PER_BLOCK_CHARS);
    const tag = s.fileName ? ` (${s.fileName}#${s.chunkIndex ?? i})` : "";
    return `[${i + 1}]${tag}\n${t}`;
  });
  let body = blocks.join("\n\n---\n\n");
  if (body.length > MAX_TOTAL_CHARS) body = `${body.slice(0, MAX_TOTAL_CHARS)}\n…(truncated)`;

  const userPrompt = `Question:\n${(sources._question || "").trim()}\n\nAnswer:\n${trimmedAnswer}\n\nContext passages:\n${body}`;

  try {
    const completion = await getClient().chat.completions.create({
      model: FAITH_MODEL,
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = (completion.choices?.[0]?.message?.content || "").trim();
    return parseFaithfulness(raw);
  } catch (err) {
    console.warn("[faith] failed:", err.message);
    return null;
  }
}

function parseFaithfulness(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const scoreNum = Number(obj.score);
    if (!Number.isFinite(scoreNum)) return null;
    const score = Math.max(0, Math.min(1, scoreNum));
    const unsupported = Array.isArray(obj.unsupported)
      ? obj.unsupported.filter((s) => typeof s === "string").slice(0, 5)
      : undefined;
    return unsupported ? { score, unsupported } : { score };
  } catch {
    return null;
  }
}

module.exports = { scoreFaithfulness };