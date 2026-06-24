const { chunkTextSemantic } = require("./semanticChunkingService");

/**
 * @param {string} text
 * @returns {Promise<string[]>}
 *
 * Backwards-compatible shim. The original `chunkText` used a 500/100 recursive
 * split; we now delegate to the semantic chunker, which keeps length in check
 * via the same RecursiveCharacterTextSplitter at 800/150 but adds semantic
 * boundary detection on top.
 */
async function chunkText(text) {
  return chunkTextSemantic(text);
}

module.exports = { chunkText };