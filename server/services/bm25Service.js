const fs = require("fs/promises");
const path = require("path");

// In-process BM25 index, keyed by chunk id `${fileId}_${chunkIndex}`.
// State is persisted to data/bm25-index.json so a server restart doesn't lose it.

const DATA_DIR = path.join(__dirname, "..", "data");
const BM25_FILE = path.join(DATA_DIR, "bm25-index.json");

// In-memory state.
//   docs: Array<{ id, fileId, chunkIndex, text, tf, length }>
//   df:   Map<string, number>   term -> document frequency
//   avgdl: number
//   totalDocs: number
//   fileChunkCounts: Map<fileId, number>  for stale detection
let state = {
  docs: [],
  df: {},
  avgdl: 0,
  totalDocs: 0,
  fileChunkCounts: {},
};

const K1 = 1.5;
const B = 0.75;

// ----- tokenization -----

// Stopwords: a small English list. Keeps the index small and stops common
// function words from dominating.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with", "but", "not", "they", "their", "them", "we", "our",
  "you", "your", "i", "he", "she", "his", "her", "about", "into", "than", "then",
  "so", "if", "do", "does", "did", "done", "been", "being", "am", "any", "all",
  "can", "could", "should", "would", "may", "might", "must", "shall", "will",
  "just", "more", "most", "some", "such", "no", "nor", "only", "own", "same",
  "too", "very", "s", "t", "d", "ll", "m", "o", "re", "ve", "y",
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOPWORDS.has(t));
}

function termFreqs(tokens) {
  const tf = Object.create(null);
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

// ----- index ops -----

function recomputeStats() {
  const totalLen = state.docs.reduce((s, d) => s + d.length, 0);
  state.totalDocs = state.docs.length;
  state.avgdl = state.totalDocs ? totalLen / state.totalDocs : 0;
}

function addChunks(fileId, chunks) {
  if (!fileId || !Array.isArray(chunks) || !chunks.length) return;
  // If the file is already in the index (e.g. re-upload), drop the old entries first.
  removeFile(fileId);

  for (let i = 0; i < chunks.length; i += 1) {
    const text = chunks[i] || "";
    const tokens = tokenize(text);
    const tf = termFreqs(tokens);
    const id = `${fileId}_${i}`;
    state.docs.push({
      id,
      fileId,
      chunkIndex: i,
      text,
      tf,
      length: tokens.length,
    });
    for (const term of Object.keys(tf)) {
      state.df[term] = (state.df[term] || 0) + 1;
    }
  }
  state.fileChunkCounts[fileId] = chunks.length;
  recomputeStats();
}

function removeFile(fileId) {
  if (!fileId) return;
  // Remove docs for this file, then rebuild df.
  const before = state.docs.length;
  state.docs = state.docs.filter((d) => d.fileId !== fileId);
  if (state.docs.length !== before) {
    state.df = {};
    for (const d of state.docs) {
      for (const term of Object.keys(d.tf)) {
        state.df[term] = (state.df[term] || 0) + 1;
      }
    }
    recomputeStats();
  }
  delete state.fileChunkCounts[fileId];
}

function hasFile(fileId) {
  return Boolean(state.fileChunkCounts[fileId]);
}

function listIndexedFileIds() {
  return Object.keys(state.fileChunkCounts);
}

function chunkCount(fileId) {
  return state.fileChunkCounts[fileId] || 0;
}

/**
 * BM25 score for a single document given a query's term frequencies.
 */
function bm25Score(doc, qTf) {
  const N = state.totalDocs;
  const dl = doc.length || 1;
  const norm = 1 - B + B * (dl / (state.avgdl || 1));
  let score = 0;
  for (const term of Object.keys(qTf)) {
    const df = state.df[term];
    if (!df) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const f = doc.tf[term] || 0;
    if (!f) continue;
    score += idf * ((f * (K1 + 1)) / (f + K1 * norm));
  }
  return score;
}

/**
 * @param {string} query
 * @param {string[]} fileIds
 * @param {number} topK
 * @returns {Array<{ id, fileId, chunkIndex, text, score }>}
 */
function search(query, fileIds, topK = 20) {
  const idSet = new Set(fileIds || []);
  const qTokens = tokenize(query);
  if (!qTokens.length || !state.docs.length) return [];
  const qTf = termFreqs(qTokens);

  const scored = [];
  for (const doc of state.docs) {
    if (!idSet.has(doc.fileId)) continue;
    const score = bm25Score(doc, qTf);
    if (score > 0) scored.push(doc);
  }
  scored.sort((a, b) => {
    const sb = bm25Score(b, qTf);
    const sa = bm25Score(a, qTf);
    return sb - sa;
  });

  return scored.slice(0, topK).map((d) => ({
    id: d.id,
    fileId: d.fileId,
    chunkIndex: d.chunkIndex,
    text: d.text,
    score: bm25Score(d, qTf),
  }));
}

// ----- persistence -----

async function save() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Persist a serializable form (no need to keep tf/df in dense form).
  const out = {
    docs: state.docs.map((d) => ({
      id: d.id,
      fileId: d.fileId,
      chunkIndex: d.chunkIndex,
      text: d.text,
      length: d.length,
      tf: d.tf,
    })),
    df: state.df,
    avgdl: state.avgdl,
    totalDocs: state.totalDocs,
    fileChunkCounts: state.fileChunkCounts,
  };
  await fs.writeFile(BM25_FILE, JSON.stringify(out), "utf8");
}

async function loadFromDisk() {
  try {
    const raw = await fs.readFile(BM25_FILE, "utf8");
    const parsed = JSON.parse(raw);
    state = {
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      df: parsed.df || {},
      avgdl: typeof parsed.avgdl === "number" ? parsed.avgdl : 0,
      totalDocs: typeof parsed.totalDocs === "number" ? parsed.totalDocs : 0,
      fileChunkCounts: parsed.fileChunkCounts || {},
    };
    // Backfill avgdl if missing.
    if (!state.avgdl && state.docs.length) {
      const totalLen = state.docs.reduce((s, d) => s + (d.length || 0), 0);
      state.avgdl = totalLen / state.docs.length;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[bm25] failed to load index:", err.message);
    }
    // Reset on any failure to load.
    state = {
      docs: [],
      df: {},
      avgdl: 0,
      totalDocs: 0,
      fileChunkCounts: {},
    };
  }
}

module.exports = {
  addChunks,
  removeFile,
  search,
  hasFile,
  listIndexedFileIds,
  chunkCount,
  save,
  loadFromDisk,
};