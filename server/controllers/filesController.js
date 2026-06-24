const path = require("path");
const fs = require("fs/promises");
const { readAll, removeByFileId } = require("../utils/fileMetadataStore");
const { deleteByFileId } = require("../services/pineconeService");
const bm25Service = require("../services/bm25Service");

async function listFiles(_req, res) {
  try {
    const files = await readAll();
    // A file is considered "stale" if it exists in the metadata store but has
    // no chunks in the BM25 index. That happens when the server is upgraded
    // and the Pinecone index was recreated — old files still listed but their
    // chunks are gone, so the user must re-upload.
    const indexed = new Set(bm25Service.listIndexedFileIds());
    const sanitized = files.map((f) => ({
      fileId: f.fileId,
      fileName: f.fileName,
      uploadDate: f.uploadDate,
      stale: Boolean(f.stale) || !indexed.has(f.fileId),
    }));
    return res.json({ files: sanitized });
  } catch (err) {
    console.error("List files error:", err);
    return res.status(500).json({ error: err.message || "Failed to list files." });
  }
}

async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ error: "fileId is required." });
    }

    const removed = await removeByFileId(fileId);
    if (!removed) {
      return res.status(404).json({ error: "File not found." });
    }

    // Drop chunks from BM25 before touching Pinecone. If Pinecone fails, the
    // file is already removed from the user-facing list.
    try {
      bm25Service.removeFile(fileId);
      await bm25Service.save();
    } catch (e) {
      console.warn("Could not remove BM25 entries for", fileId, e.message);
    }

    try {
      await deleteByFileId(fileId);
    } catch (e) {
      console.warn("Could not delete Pinecone vectors for", fileId, e.message);
    }

    if (removed.storedPath) {
      const absPath = path.join(__dirname, "..", removed.storedPath);
      try {
        await fs.unlink(absPath);
      } catch (e) {
        console.warn("Could not delete local file:", absPath, e.message);
      }
    }

    return res.json({ ok: true, fileId });
  } catch (err) {
    console.error("Delete file error:", err);
    return res.status(500).json({ error: err.message || "Delete failed." });
  }
}

module.exports = {
  listFiles,
  deleteFile,
};