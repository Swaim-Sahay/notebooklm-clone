const { Groq } = require("groq-sdk");
const { GROQ_API_KEY } = require("../utils/env");

let client = null;
function getClient() {
  if (!client) client = new Groq({ apiKey: GROQ_API_KEY });
  return client;
}

const RERANK_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = [
  "You are a relevance scorer for a retrieval system.",
  "Given a query and a numbered list of candidate passages, return a JSON array",
  "of integers, one score per candidate in the SAME ORDER, where each score is",
  "from 0 to 10 (10 = directly answers the query, 0 = irrelevant).",
  'Output ONLY the JSON array, no prose, no code fences. Example: [9, 3, 7, 0, 5]',
].join("\n");

/**
 * Truncate text to keep the prompt under reasonable token limits.
 * Each chunk is bounded; the whole batch is bounded by MAX_TOTAL_CHARS.
 */
const PER_CHUNK_CHARS = 700;
const MAX_TOTAL_CHARS = 12000;

function truncate(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/**
 * @param {string} query
 * @param {Array<{ id: string, fileId: string, chunkIndex: number, text: string }>} candidates
 * @param {number} topN
 * @returns {Promise<Array<{ ...candidate, rerankerScore: number }>>}
 */
async function rerank(query, candidates, topN = 6) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  const trimmedQ = (query || "").trim();

  // Truncate each chunk; if total exceeds budget, drop the tail.
  const limited = candidates.map((c) => ({
    ...c,
    text: truncate(c.text || "", PER_CHUNK_CHARS),
  }));
  let totalChars = limited.reduce((s, c) => s + c.text.length, 0);
  while (totalChars > MAX_TOTAL_CHARS && limited.length > 1) {
    const dropped = limited.pop();
    totalChars -= dropped.text.length;
  }

  const blocks = limited.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
  const userPrompt = `Query: ${trimmedQ}\n\nCandidates:\n${blocks}`;

  /** @type {number[]} */
  let scores;
  try {
    const completion = await getClient().chat.completions.create({
      model: RERANK_MODEL,
      temperature: 0,
      max_tokens: 256,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = (completion.choices?.[0]?.message?.content || "").trim();
    const parsed = parseScoreArray(raw);
    if (!parsed || parsed.length !== limited.length) {
      throw new Error(
        `parse mismatch: expected ${limited.length} scores, got ${parsed?.length}`
      );
    }
    scores = parsed.map((s) => Math.max(0, Math.min(10, Number(s) || 0)));
  } catch (err) {
    console.warn(
      "[rerank] failed, preserving original order:",
      err.message
    );
    return candidates.slice(0, topN).map((c, i) => ({
      ...c,
      rerankerScore: 1 - i / Math.max(candidates.length, 1),
    }));
  }

  // Attach scores, sort desc, take topN.
  const scored = limited.map((c, i) => ({
    ...c,
    rerankerScore: scores[i] / 10, // normalize to 0-1 for the UI
  }));
  scored.sort((a, b) => b.rerankerScore - a.rerankerScore);
  return scored.slice(0, topN);
}

/**
 * Parse a JSON array of numbers from model output. Tolerant of code fences and
 * trailing prose. Returns null if it cannot find a plausible array.
 */
function parseScoreArray(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const match = cleaned.match(/\[[^\]]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr.map((v) => Number(v));
  } catch {
    return null;
  }
}

module.exports = { rerank };