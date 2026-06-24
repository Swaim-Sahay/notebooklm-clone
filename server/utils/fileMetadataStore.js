const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const META_FILE = path.join(DATA_DIR, "files.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(META_FILE);
  } catch {
    await fs.writeFile(META_FILE, "[]", "utf8");
  }
}

/**
 * @returns {Promise<Array<{ fileId: string, fileName: string, uploadDate: string, storedPath: string, stale?: boolean }>>}
 */
async function readAll() {
  await ensureDataDir();
  const raw = await fs.readFile(META_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records) {
  await ensureDataDir();
  await fs.writeFile(META_FILE, JSON.stringify(records, null, 2), "utf8");
}

async function add(record) {
  const all = await readAll();
  // New uploads are never stale.
  all.push({ ...record, stale: false });
  await writeAll(all);
}

async function removeByFileId(fileId) {
  const all = await readAll();
  const next = all.filter((r) => r.fileId !== fileId);
  await writeAll(next);
  return all.find((r) => r.fileId === fileId) || null;
}

async function getByFileId(fileId) {
  const all = await readAll();
  return all.find((r) => r.fileId === fileId) || null;
}

/**
 * Update the `stale` flag on a set of records. Used at startup to flag files
 * that exist on disk but have no corresponding chunks in BM25 (i.e. they were
 * ingested under the old pipeline and need to be re-uploaded).
 *
 * @param {(fileId: string) => boolean} isStaleFn
 *        Predicate evaluated for each record's fileId. Records where it
 *        returns true are flagged stale; all others are cleared.
 */
async function markStaleBy(isStaleFn) {
  const all = await readAll();
  let changed = false;
  for (const r of all) {
    const shouldBeStale = Boolean(isStaleFn(r.fileId));
    if (Boolean(r.stale) !== shouldBeStale) {
      r.stale = shouldBeStale;
      changed = true;
    }
  }
  if (changed) await writeAll(all);
  return all;
}

module.exports = {
  readAll,
  add,
  removeByFileId,
  getByFileId,
  markStaleBy,
  DATA_DIR,
};