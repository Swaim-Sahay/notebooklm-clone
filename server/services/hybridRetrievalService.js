const { queryByFileIds } = require("./pineconeService");
const bm25Service = require("./bm25Service");

const DEFAULT_DENSE_TOPK = 40;
const DEFAULT_BM25_TOPK = 40;
const DEFAULT_CANDIDATE_POOL = 16;
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion. Each ranked list contributes 1 / (k + rank) per item.
 * The same chunk id seen in both lists sums to a higher fused score.
 * @param {Array<{ id: string }>} dense  dense-ranked candidates
 * @param {Array<{ id: string }>} bm25   BM25-ranked candidates
 * @returns {Map<string, number>} id -> rrfScore
 */
function rrfScores(dense, bm25) {
  const out = new Map();
  for (let i = 0; i < dense.length; i += 1) {
    const id = dense[i].id;
    out.set(id, (out.get(id) || 0) + 1 / (RRF_K + i + 1));
  }
  for (let i = 0; i < bm25.length; i += 1) {
    const id = bm25[i].id;
    out.set(id, (out.get(id) || 0) + 1 / (RRF_K + i + 1));
  }
  return out;
}

/**
 * Retrieve candidates via dense (Pinecone) + BM25, fuse with RRF, return top-N.
 *
 * Each returned candidate carries the original chunk text and both raw scores,
 * so downstream consumers (reranker, source UI) can show all the signals.
 *
 * @param {{
 *   queryEmbedding: number[],
 *   queryText: string,
 *   fileIds: string[],
 *   denseTopK?: number,
 *   bm25TopK?: number,
 *   candidatePool?: number,
 * }} args
 * @returns {Promise<Array<{
 *   id: string, fileId: string, chunkIndex: number, text: string,
 *   denseScore?: number, bm25Score?: number, rrfScore: number,
 * }>>}
 */
async function retrieve({
  queryEmbedding,
  queryText,
  fileIds,
  denseTopK = DEFAULT_DENSE_TOPK,
  bm25TopK = DEFAULT_BM25_TOPK,
  candidatePool = DEFAULT_CANDIDATE_POOL,
}) {
  if (!Array.isArray(fileIds) || !fileIds.length) return [];
  if (!Array.isArray(queryEmbedding) || !queryEmbedding.length) return [];

  // Run both retrievals in parallel; each can fail independently without
  // taking the other down (we'll degrade gracefully).
  const [denseRes, bm25Res] = await Promise.allSettled([
    queryByFileIds(queryEmbedding, fileIds, denseTopK),
    Promise.resolve(bm25Service.search(queryText, fileIds, bm25TopK)),
  ]);

  const dense = denseRes.status === "fulfilled" ? denseRes.value || [] : [];
  const bm25 = bm25Res.status === "fulfilled" ? bm25Res.value || [] : [];
  if (denseRes.status === "rejected") {
    console.warn("[hybrid] dense leg failed:", denseRes.reason?.message);
  }
  if (bm25Res.status === "rejected") {
    console.warn("[hybrid] bm25 leg failed:", bm25Res.reason?.message);
  }

  // Index dense results by id for quick lookup.
  const byId = new Map();
  for (const m of dense) {
    const md = m.metadata || {};
    const id = String(m.id || `${md.fileId ?? ""}_${md.chunkIndex ?? ""}`);
    if (!md.text) continue;
    byId.set(id, {
      id,
      fileId: String(md.fileId ?? ""),
      fileName: String(md.fileName ?? ""),
      chunkIndex:
        typeof md.chunkIndex === "number"
          ? md.chunkIndex
          : Number(md.chunkIndex),
      text: String(md.text),
      totalChunks:
        typeof md.totalChunks === "number"
          ? md.totalChunks
          : Number(md.totalChunks) || undefined,
      denseScore: typeof m.score === "number" ? m.score : undefined,
      bm25Score: undefined,
    });
  }
  // Merge in BM25 results (texts not in Pinecone results — should not normally
  // happen, but if it does we still want to surface them).
  for (const b of bm25) {
    if (byId.has(b.id)) {
      byId.get(b.id).bm25Score = b.score;
      continue;
    }
    byId.set(b.id, {
      id: b.id,
      fileId: b.fileId,
      fileName: "",
      chunkIndex: b.chunkIndex,
      text: b.text,
      totalChunks: undefined,
      denseScore: undefined,
      bm25Score: b.score,
    });
  }

  if (!byId.size) return [];

  // Build the two ranked lists (id only) for RRF, in original ranking order.
  const denseRanked = dense
    .map((m) => String(m.id))
    .filter((id) => byId.has(id));
  const bm25Ranked = bm25
    .map((b) => b.id)
    .filter((id) => byId.has(id));

  const rrf = rrfScores(denseRanked, bm25Ranked);
  const merged = Array.from(byId.values()).map((c) => ({
    ...c,
    rrfScore: rrf.get(c.id) || 0,
  }));

  merged.sort((a, b) => b.rrfScore - a.rrfScore);
  return merged.slice(0, candidatePool);
}

module.exports = { retrieve, rrfScores };