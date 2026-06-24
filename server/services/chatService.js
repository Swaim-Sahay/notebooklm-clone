const { Groq } = require("groq-sdk");
const { GROQ_API_KEY } = require("../utils/env");
const { embedQuery } = require("./embeddingsService");
const { rewriteQuery } = require("./queryRewriteService");
const { retrieve: hybridRetrieve } = require("./hybridRetrievalService");
const { rerank } = require("./rerankerService");
const { scoreFaithfulness } = require("./faithfulnessService");

const NOT_FOUND_MESSAGE =
  "I could not find that information in the uploaded documents.";

const ANSWER_MODEL = "llama-3.3-70b-versatile";
const CANDIDATE_POOL = 16;
const RERANK_TOP_N = 6;

let groq = null;
function getClient() {
  if (!groq) groq = new Groq({ apiKey: GROQ_API_KEY });
  return groq;
}

/**
 * Build the system prompt used to ground the answer in retrieved context.
 */
function buildSystemPrompt() {
  return [
    "You are a document assistant.",
    "Answer ONLY using the provided context below.",
    "",
    "Rules:",
    "- Do not use outside knowledge.",
    "- Do not introduce facts, names, numbers, or dates that are not present in the context.",
    "- Quote or paraphrase only what is supported by the context.",
    `- If the answer cannot be found in the context, respond with exactly: ${NOT_FOUND_MESSAGE}`,
    "- When you cite a claim, you do NOT need to mark the citation inline; the system will show the sources.",
    "",
    "Context:",
  ].join("\n");
}

/**
 * @param {string} question
 * @param {string[]} selectedFileIds
 * @returns {Promise<{
 *   answer: string,
 *   sources: Array<{
 *     fileId: string, fileName: string, chunkIndex: number,
 *     text: string, score?: number, rerankerScore?: number, totalChunks?: number,
 *   }>,
 *   rewrittenQuery?: string,
 *   faithfulness?: { score: number, unsupported?: string[] } | null,
 * }>}
 */
async function chatWithDocuments(question, selectedFileIds) {
  const trimmedQ = (question || "").trim();
  if (!trimmedQ) {
    throw new Error("Message is required.");
  }
  const ids = (selectedFileIds || []).filter(Boolean);
  if (!ids.length) {
    throw new Error("Select at least one uploaded document.");
  }

  // 1) Rewrite the user query into a self-contained search query.
  const rewritten = await rewriteQuery(trimmedQ);
  if (rewritten && rewritten !== trimmedQ) {
    console.log(`[rewrite] original="${trimmedQ}" → rewritten="${rewritten}"`);
  }

  // 2) Embed the rewritten query.
  const queryVec = await embedQuery(rewritten || trimmedQ);

  // 3) Hybrid retrieval: dense (Pinecone) + BM25 → RRF.
  const candidates = await hybridRetrieve({
    queryEmbedding: queryVec,
    queryText: rewritten || trimmedQ,
    fileIds: ids,
    candidatePool: CANDIDATE_POOL,
  });

  if (!candidates.length) {
    return {
      answer: NOT_FOUND_MESSAGE,
      sources: [],
      rewrittenQuery: rewritten,
      faithfulness: { score: 1.0 },
    };
  }

  // 4) Rerank and keep top-N.
  const top = await rerank(trimmedQ, candidates, RERANK_TOP_N);

  // 5) Shape sources for the UI.
  const sources = top.map((c) => ({
    fileId: c.fileId,
    fileName: c.fileName || "",
    chunkIndex: c.chunkIndex,
    text: c.text,
    score: typeof c.denseScore === "number" ? c.denseScore : undefined,
    rerankerScore: typeof c.rerankerScore === "number" ? c.rerankerScore : undefined,
    totalChunks: typeof c.totalChunks === "number" ? c.totalChunks : undefined,
  })).filter((s) => s.text);

  // 6) Generate the answer, grounded in the reranked context.
  const answer = await generateAnswer(trimmedQ, sources);

  // 7) Faithfulness check (best-effort, returns null on parse failure).
  const faith = await scoreFaithfulness(answer, [
    ...sources,
    // Attach the original question so the judge has it (the service stashes it).
    { _question: trimmedQ, text: "" },
  ]);

  return {
    answer,
    sources,
    rewrittenQuery: rewritten,
    faithfulness: faith,
  };
}

async function generateAnswer(question, sources) {
  const contextBlocks = sources.map((s, i) =>
    `[Source ${i + 1}] File: ${s.fileName} | Chunk: ${s.chunkIndex}\n${s.text}`
  );
  const context = contextBlocks.join("\n\n---\n\n");

  const systemPrompt = buildSystemPrompt() + "\n" + context;
  const userPrompt = `Question: ${question}`;

  try {
    const completion = await getClient().chat.completions.create({
      model: ANSWER_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const out = (completion.choices?.[0]?.message?.content || "").trim();
    return out || NOT_FOUND_MESSAGE;
  } catch (err) {
    console.error("[chat] generation failed:", err.message);
    throw new Error("Failed to generate answer.");
  }
}

module.exports = {
  chatWithDocuments,
  NOT_FOUND_MESSAGE,
};