const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { embedDocuments } = require("./embeddingsService");

// Tunables — kept as named constants so they are easy to find and tweak.
const SIMILARITY_THRESHOLD = 0.55;   // merge sentences whose cosine sim >= this
const UNIT_MAX_CHARS = 1200;         // never let a merged unit exceed this length
const FINAL_CHUNK_SIZE = 800;
const FINAL_CHUNK_OVERLAP = 150;
const MIN_SENTENCES_FOR_SEMANTIC = 4;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: FINAL_CHUNK_SIZE,
  chunkOverlap: FINAL_CHUNK_OVERLAP,
});

// A small stop-list for sentence terminators we don't want to split on.
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
  "vs", "etc", "e.g", "i.e", "fig", "approx",
]);

/**
 * Split raw text into sentence-shaped candidates.
 * We err on the side of fewer, longer sentences (so semantic merging has room to work)
 * rather than aggressive sentence splitting.
 * @param {string} text
 */
function splitSentences(text) {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  // Walk char-by-char. Break on [?.!] followed by whitespace + uppercase/digit/quote,
  // unless we're inside an abbreviation or a number like "3.14".
  const sentences = [];
  let buffer = "";
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    buffer += ch;
    const last = ch;
    if (last === "." || last === "?" || last === "!") {
      // Look back: if buffer ends with an abbreviation token, don't break.
      const tail = buffer.trim().split(/\s+/).pop() || "";
      const tailCore = tail.replace(/[.?!\"]$/, "").toLowerCase();
      if (ABBREVIATIONS.has(tailCore)) continue;
      // Look ahead: require whitespace + capital/digit/quote (or end-of-text).
      const next = cleaned[i + 1];
      const after = cleaned[i + 2];
      if (next === undefined) {
        sentences.push(buffer.trim());
        buffer = "";
      } else if ((next === " " || next === "\n") && after && /[A-Z0-9"'\(]/.test(after)) {
        sentences.push(buffer.trim());
        buffer = "";
      }
    }
  }
  if (buffer.trim()) sentences.push(buffer.trim());

  return sentences.filter((s) => s.length > 0);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  // Both sides are L2-normalized (embedDocuments uses normalize: true),
  // so dot product == cosine similarity.
  return dot;
}

/**
 * Group sentences into "semantic units" by greedy merging while adjacent sentence
 * cosine similarity is high and the unit stays under UNIT_MAX_CHARS.
 * @param {string[]} sentences
 * @param {number[][]} embeddings  (length-normalized)
 */
function mergeBySimilarity(sentences, embeddings) {
  const units = [];
  let curSentences = [sentences[0]];
  let curLen = sentences[0].length;

  for (let i = 1; i < sentences.length; i += 1) {
    const sim = cosine(embeddings[i - 1], embeddings[i]);
    const nextLen = sentences[i].length;
    const mergedLen = curLen + 1 + nextLen;

    if (sim >= SIMILARITY_THRESHOLD && mergedLen <= UNIT_MAX_CHARS) {
      curSentences.push(sentences[i]);
      curLen = mergedLen;
    } else {
      units.push(curSentences.join(" "));
      curSentences = [sentences[i]];
      curLen = nextLen;
    }
  }
  if (curSentences.length) units.push(curSentences.join(" "));
  return units;
}

/**
 * Semantic chunking. Splits text into sentences, embeds each, merges adjacent
 * sentences whose embedding similarity is above threshold (so each merged unit
 * stays on-topic), then runs RecursiveCharacterTextSplitter over the joined
 * units to enforce a length ceiling.
 *
 * Falls back to a plain recursive split for very short inputs.
 *
 * @param {string} text
 * @returns {Promise<string[]>}
 */
async function chunkTextSemantic(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  const sentences = splitSentences(trimmed);
  if (sentences.length < MIN_SENTENCES_FOR_SEMANTIC) {
    return (await splitter.splitText(trimmed)).map((c) => c.trim()).filter(Boolean);
  }

  let embeddings;
  try {
    embeddings = await embedDocuments(sentences);
  } catch (err) {
    console.warn("[semanticChunk] embedding failed, falling back to recursive split:", err.message);
    return (await splitter.splitText(trimmed)).map((c) => c.trim()).filter(Boolean);
  }

  const units = mergeBySimilarity(sentences, embeddings);
  const joined = units.join("\n\n");
  const chunks = await splitter.splitText(joined);
  return chunks.map((c) => c.trim()).filter(Boolean);
}

module.exports = {
  chunkTextSemantic,
  splitSentences,
  mergeBySimilarity,
  SIMILARITY_THRESHOLD,
  UNIT_MAX_CHARS,
  FINAL_CHUNK_SIZE,
  FINAL_CHUNK_OVERLAP,
};