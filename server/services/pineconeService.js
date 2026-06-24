const { Pinecone } = require("@pinecone-database/pinecone");
const {
  PINECONE_API_KEY,
  PINECONE_INDEX_NAME,
  PINECONE_CLOUD,
  PINECONE_REGION,
  EMBEDDING_DIMENSION,
} = require("../utils/env");

// Bumped whenever the chunk metadata shape changes. Old indexes that lack this
// marker are treated as legacy and recreated on startup.
const SCHEMA_VERSION = 2;

let pineconeClient = null;
let indexReadyPromise = null;

function getClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
  }
  return pineconeClient;
}

async function indexExists() {
  const pc = getClient();
  const listed = await pc.listIndexes();
  const names = (listed.indexes || []).map((i) => i.name);
  return names.includes(PINECONE_INDEX_NAME);
}

async function createIndex() {
  const pc = getClient();
  await pc.createIndex({
    name: PINECONE_INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
    spec: {
      serverless: { cloud: PINECONE_CLOUD, region: PINECONE_REGION },
    },
    deletionProtection: "disabled",
  });
}

async function waitForReady(timeoutMs = 120_000) {
  const pc = getClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const desc = await pc.describeIndex(PINECONE_INDEX_NAME);
    if (desc.status?.ready) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Pinecone index did not become ready in time.");
}

/**
 * Returns true if the index already has at least one v2 vector. Used to decide
 * whether to nuke & recreate when the schema has changed.
 */
async function hasV2Vector() {
  const index = getIndex();
  // Use a cheap namespace-zero query with a dummy zero vector and a schema
  // filter. If nothing matches we treat the index as legacy.
  try {
    const res = await index.query({
      vector: new Array(EMBEDDING_DIMENSION).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: { schemaVersion: { $eq: SCHEMA_VERSION } },
    });
    return Array.isArray(res.matches) && res.matches.length > 0;
  } catch {
    return false;
  }
}

async function dropIndex() {
  const pc = getClient();
  await pc.deleteIndex(PINECONE_INDEX_NAME);
  // Wait until it's actually gone before we recreate.
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    if (!(await indexExists())) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Pinecone index did not delete in time.");
}

/**
 * Creates the serverless index if missing, then waits until status.ready.
 * If an existing index lacks schema v2 vectors, delete and recreate.
 */
async function ensureIndexReady() {
  if (indexReadyPromise) return indexReadyPromise;

  indexReadyPromise = (async () => {
    if (!(await indexExists())) {
      console.log("[pinecone] creating index…");
      await createIndex();
      await waitForReady();
      console.log("Pinecone index ready...");
      return;
    }

    // Exists — wait until ready before sampling.
    await waitForReady();
    const v2 = await hasV2Vector();
    if (!v2) {
      console.warn(
        "[pinecone] schema mismatch — recreating index (old vectors are not compatible with the new pipeline)…"
      );
      await dropIndex();
      await createIndex();
      await waitForReady();
      console.log("[pinecone] recreated. Fresh slate — please re-upload your documents.");
    }
    console.log("Pinecone index ready...");
  })().catch((err) => {
    // Reset so a subsequent call can retry.
    indexReadyPromise = null;
    throw err;
  });

  return indexReadyPromise;
}

function getIndex() {
  const pc = getClient();
  return pc.index(PINECONE_INDEX_NAME);
}

/**
 * @param {Array<{ id: string, values: number[], metadata: Record<string, unknown> }>} vectors
 */
async function upsertVectors(vectors) {
  await ensureIndexReady();
  const index = getIndex();
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const slice = vectors.slice(i, i + batchSize);
    await index.upsert(slice);
  }
}

/**
 * @param {number[]} vector
 * @param {string[]} fileIds
 * @param {number} topK
 */
async function queryByFileIds(vector, fileIds, topK = 8) {
  await ensureIndexReady();
  const index = getIndex();
  const fileFilter =
    fileIds.length === 1
      ? { fileId: { $eq: fileIds[0] } }
      : { fileId: { $in: fileIds } };

  // Always include schemaVersion in the filter so legacy vectors (if any
  // survived) cannot bleed into results.
  const filter = { $and: [fileFilter, { schemaVersion: { $eq: SCHEMA_VERSION } }] };

  const res = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter,
  });

  return res.matches || [];
}

/**
 * Delete all vectors for a single fileId (metadata filter).
 * @param {string} fileId
 */
async function deleteByFileId(fileId) {
  await ensureIndexReady();
  const index = getIndex();
  await index.deleteMany({ fileId: { $eq: fileId } });
}

module.exports = {
  ensureIndexReady,
  upsertVectors,
  queryByFileIds,
  deleteByFileId,
  SCHEMA_VERSION,
};