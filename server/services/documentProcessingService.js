const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const { v4: uuidv4 } = require("uuid");
const { chunkText } = require("./chunkingService");
const { embedDocuments } = require("./embeddingsService");
const { upsertVectors, SCHEMA_VERSION } = require("./pineconeService");
const bm25Service = require("./bm25Service");

/**
 * @param {string} filePath
 * @param {string} mimeOrExt
 */
async function extractTextFromFile(filePath, mimeOrExt) {
  const lower = (mimeOrExt || "").toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (lower.includes("pdf") || ext === ".pdf") {
    const buf = await fs.readFile(filePath);
    const data = await pdfParse(buf);
    return (data.text || "").trim();
  }
  if (lower.includes("text") || ext === ".txt") {
    return (await fs.readFile(filePath, "utf8")).trim();
  }
  throw new Error("Unsupported file type. Only PDF and TXT are allowed.");
}

/**
 * Process upload: chunk (semantic), embed, upsert to Pinecone, add to BM25.
 * @param {{ filePath: string, originalName: string, mimeType: string }} input
 * @returns {Promise<{ fileId: string, fileName: string, uploadDate: string, chunkCount: number }>}
 */
async function processAndIndexDocument(input) {
  const fileId = uuidv4();
  const text = await extractTextFromFile(input.filePath, input.mimeType);
  if (!text) {
    throw new Error("Could not extract text from the file (empty document).");
  }

  const chunks = await chunkText(text);
  if (!chunks.length) {
    throw new Error("No text chunks produced from document.");
  }

  const embeddings = await embedDocuments(chunks);
  const totalChunks = chunks.length;

  // Add to BM25 before upserting to Pinecone so a Pinecone failure still leaves
  // a usable BM25 index. If Pinecone fails, we clean up BM25 below.
  bm25Service.addChunks(fileId, chunks);

  const vectors = chunks.map((chunkTextItem, chunkIndex) => ({
    id: `${fileId}_${chunkIndex}`,
    values: embeddings[chunkIndex],
    metadata: {
      schemaVersion: SCHEMA_VERSION,
      fileId,
      fileName: input.originalName,
      chunkIndex,
      totalChunks,
      text: chunkTextItem,
    },
  }));

  try {
    await upsertVectors(vectors);
  } catch (err) {
    // Roll back BM25 so it doesn't drift from Pinecone.
    bm25Service.removeFile(fileId);
    throw err;
  }

  // Persist BM25 to disk (fire-and-forget; failure is logged but doesn't
  // invalidate the upload — we'll just rebuild on next restart).
  bm25Service.save().catch((err) => {
    console.warn("[bm25] persistence failed:", err.message);
  });

  const uploadDate = new Date().toISOString();

  return {
    fileId,
    fileName: input.originalName,
    uploadDate,
    chunkCount: totalChunks,
  };
}

module.exports = {
  extractTextFromFile,
  processAndIndexDocument,
};