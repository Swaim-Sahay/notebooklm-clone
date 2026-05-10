const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { PORT, assertEnv, FRONTEND_URL } = require("./utils/env");
const { ensureIndexReady } = require("./services/pineconeService");
const { handleUpload, UPLOAD_ROOT } = require("./controllers/uploadController");
const { handleChat } = require("./controllers/chatController");
const { listFiles, deleteFile } = require("./controllers/filesController");

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const app = express();
const MAX_JSON_BODY = "20mb";
const MAX_FILE_SIZE = 32 * 1024 * 1024;

const corsConfig = {
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsConfig));
app.use(express.json({ limit: MAX_JSON_BODY }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "") || ".bin";
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || "";
    const okExt = /\.(pdf|txt)$/i.test(name);
    if (okExt) {
      return cb(null, true);
    }
    cb(new Error("Only PDF and TXT files are allowed."));
  },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const uploadSingleFile = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
};

app.post("/api/upload", uploadSingleFile, handleUpload);

app.post("/api/chat", handleChat);
app.get("/api/files", listFiles);
app.delete("/api/files/:fileId", deleteFile);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error." });
});

async function start() {
  assertEnv();
  await ensureIndexReady();
  app.listen(PORT, () => {
    console.log(`API listening on ${FRONTEND_URL.replace(/\/$/, "")}:${PORT}`);
  });
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
