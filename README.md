# NotebookLM-Style RAG Application

An advanced Retrieval-Augmented Generation (RAG) app built on Next.js, Express, and Pinecone. Upload PDF or TXT files, semantically chunk and embed them with hybrid retrieval (dense + BM25) and LLM-based reranking, then query them with answers drawn exclusively from your chosen documents — every response comes with grounded citations and a faithfulness score.

## Features

- 📤 **File Upload**: Drag and drop or browse to select PDF/TXT files
- 🤖 **Advanced RAG Chat**: Ask questions anchored to your documents using semantic chunking, hybrid retrieval, LLM reranking, and a faithfulness check
- 📌 **Multi-Document Support**: Choose which files contribute to each answer
- 🔗 **Source Citations**: Inspect retrieved chunks, with reranker scores and "Chunk N of M" labels
- 🛡️ **Faithfulness Scoring**: Every assistant answer is graded for groundedness and surfaced as a color-coded pill (`Grounded / Partial / Ungrounded`)
- 🔍 **Query Rewriting**: Conversational questions are rewritten into self-contained search queries before retrieval
- 💾 **Persistent Storage**: Files and the BM25 index persist across restarts via local JSON
- 🎨 **Modern UI**: Clean, responsive design powered by Tailwind CSS
- 🚀 **Free Stack**: Powered by Groq (free LLM) and HuggingFace embeddings

## Tech Stack

### Frontend
- **Framework**: Next.js 16 with App Router (Turbopack)
- **UI**: React 19 + Tailwind CSS
- **Language**: TypeScript
- **API Client**: Axios
- **State**: React Hooks + localStorage

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (CommonJS)
- **Vector DB**: Pinecone (serverless, cosine, 384-dim)
- **Embeddings**: HuggingFace `Xenova/all-MiniLM-L6-v2` via Transformers.js (local, normalize=true)
- **LLM**: Groq (`llama-3.3-70b-versatile`) — used for answer generation, query rewriting, reranking, and the faithfulness judge
- **Document Parsing**: `pdf-parse`
- **File Upload**: Multer
- **Chunking**: Custom semantic chunker (sentence split → embedding-similarity merge) built on top of LangChain `RecursiveCharacterTextSplitter` (length backstop)
- **Lexical Retrieval**: In-process BM25 (custom implementation) with JSON persistence

## Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- **Groq API Key** (free tier at https://console.groq.com)
- **Pinecone Account** (free tier at https://www.pinecone.io)

## Setup Instructions

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend (separate terminal)
cd client
npm install
```

### 2. Configure Environment Variables

#### Backend (`server/.env`)

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_INDEX_NAME=notebooklm-rag
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PORT=3001
```

**Where to get these keys:**

1. **Groq API Key** — https://console.groq.com → API Keys
2. **Pinecone Setup** — https://www.pinecone.io → create an org, grab the API key, pick `aws`/`us-east-1` (recommended)

#### Frontend (`client/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### 3. Start the Application

You'll need **two terminal windows**:

**Terminal 1 — Backend API**

```bash
cd server
npm run dev
```

Expected output:
```
[pinecone] schema mismatch — recreating index (only on first boot after upgrade)
Pinecone index ready...
[startup] N file(s) are out of date with the current index.
API listening on http://localhost:3001
```

**Terminal 2 — Frontend**

```bash
cd client
npm run dev
```

Expected output:
```
▲ Next.js 16.2.5 (Turbopack)
- Local:    http://localhost:3000
✓ Ready in <1s
```

### 4. Open the Application

Navigate to `http://localhost:3000`.

> **First-boot note:** If you're upgrading from the original (naive RAG) version, the server detects that the Pinecone index predates the new schema and recreates it. Existing files are kept in `server/data/files.json` but flagged `stale: true` in the UI with a **Reindex required** banner — re-upload them to populate the new index.

## How to Use

1. **Upload Documents** — Drag-and-drop PDF or TXT files onto the upload zone
2. **Select Documents** — Tick files in the left sidebar to include them as context
3. **Ask Questions** — Type in the chat input and press Enter
4. **Inspect Citations** — Open the "Evidence" tray under any answer to see source chunks, their reranker score, and `Chunk N of M` position
5. **Manage Files** — Click the trash icon to remove a file (cleanly drops BM25 entries + Pinecone vectors + the on-disk upload)

## Document Processing Pipeline

1. **Parse** — `pdf-parse` for PDFs, raw read for TXT
2. **Semantic Chunking** — Sentence split → MiniLM embedding per sentence → greedy merge of adjacent sentences whose cosine similarity ≥ 0.55 → `RecursiveCharacterTextSplitter` (800/150) as a length backstop
3. **Embed** — Each chunk is converted to a 384-dim vector with `all-MiniLM-L6-v2` (mean-pooled, L2-normalized)
4. **Index (dense)** — Upsert to Pinecone with metadata `{ schemaVersion: 2, fileId, fileName, chunkIndex, totalChunks, text }`
5. **Index (BM25)** — In-process BM25 keyed by `${fileId}_${chunkIndex}`; persisted to `server/data/bm25-index.json`

## Query Pipeline

For every chat message:

1. **Rewrite** — Groq rewrites the user's question into a self-contained search query (drops filler, resolves pronouns). When the rewrite changes the input, a small `Rewritten: ...` caption appears under the assistant message.
2. **Embed query** — MiniLM produces a 384-dim vector
3. **Hybrid Retrieval** — Dense (Pinecone top-40) + BM25 (top-40) in parallel, fused via Reciprocal Rank Fusion (`k=60`) → top-16 candidates
4. **Rerank** — Single Groq call scores every `(query, chunk)` pair 0–10; top-6 kept, scores normalized to 0–1 and shown as a `rerank NN%` pill on each evidence card
5. **Generate** — Groq answers using only the reranked context, with a stricter "no outside knowledge" prompt
6. **Faithfulness** — A second lightweight Groq call extracts atomic claims from the answer and checks each against the context. Result is a 0–1 score surfaced as a color-coded `Grounded / Partial / Ungrounded` pill in the chat header

The `/api/chat` response shape:

```json
{
  "answer": "...",
  "sources": [
    {
      "fileId": "...",
      "fileName": "...",
      "chunkIndex": 3,
      "text": "...",
      "score": 0.81,
      "rerankerScore": 0.8,
      "totalChunks": 12
    }
  ],
  "rewrittenQuery": "...",
  "faithfulness": { "score": 0.92, "unsupported": [] }
}
```

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Multipart field `file` — PDF or TXT. Returns `{ fileId, fileName, uploadDate, chunkCount }`. |
| `POST` | `/api/chat` | JSON `{ message, selectedFileIds }` → see response shape above. |
| `GET` | `/api/files` | Uploaded file metadata (server-side registry). Each entry includes `stale: boolean`. |
| `DELETE` | `/api/files/:fileId` | Remove BM25 entries, Pinecone vectors, and the on-disk file. |

## Project Layout

```
server/
  index.js                   # bootstrap: env assert → ensureIndexReady → BM25.loadFromDisk → markOrphansStale → listen
  controllers/               # Express route handlers (upload, chat, files)
  services/
    semanticChunkingService.js   # sentence split + embed similarity merge + recursive fallback
    chunkingService.js           # thin wrapper that delegates to the semantic chunker
    bm25Service.js               # in-process BM25 + JSON persistence
    embeddingsService.js         # local MiniLM via @xenova/transformers
    queryRewriteService.js       # Groq LLM query rewrite
    hybridRetrievalService.js    # dense + BM25 + RRF fusion
    rerankerService.js           # Groq batch (query, chunk) scoring
    faithfulnessService.js       # Groq attribution judge
    chatService.js               # the full query pipeline (rewrite → hybrid → rerank → generate → faithfulness)
    documentProcessingService.js # ingest: parse → chunk → embed → BM25.add → Pinecone.upsert
    pineconeService.js           # ensureIndexReady with schemaVersion check + recreate
  utils/
    env.js                  # loads + validates env vars
    fileMetadataStore.js    # JSON-backed files.json with markStale helper

client/
  src/
    app/                    # Next.js App Router (layout.tsx, page.tsx, globals.css)
    components/             # UI shims → workspace/
    components/workspace/
      WorkspaceShell.tsx    # layout, handles send, surfaces the stale banner
      LibraryPanel.tsx      # file list, with stale tag
      ChatDeck.tsx          # message bubbles; renders the faithfulness pill + rewritten-query hint
      EvidenceTray.tsx      # per-source: fileName, chunk N of M, rerank pill
      IntakeDropzone.tsx    # PDF/TXT dropzone
    services/apiClient.ts   # axios client; chat() return type includes rewrittenQuery + faithfulness
    lib/types.ts            # UploadedFileMeta, SourceChunk, ChatMessage, Faithfulness
```

## Architecture Notes

- **Pinecone schema versioning** — Every upsert tags metadata with `schemaVersion: 2`. On startup, `pineconeService.ensureIndexReady` samples the index; if no v2 vectors are present, the index is dropped and recreated. `queryByFileIds` also adds `schemaVersion: 2` to its filter so legacy vectors (if any survived) cannot bleed into results.
- **BM25 persistence** — The BM25 index lives in `server/data/bm25-index.json`. It is rewritten on every add/remove and loaded from disk on startup. Delete operations always clean both BM25 and Pinecone.
- **No new dependencies** — The advanced RAG stack uses only packages already in `server/package.json` (Groq SDK, `@pinecone-database/pinecone`, `@xenova/transformers`, `@langchain/textsplitters`).
- **Graceful degradation** — Every LLM call (`queryRewrite`, `rerank`, `faithfulness`) falls back to a sensible default on failure: rewrites fall back to the original query; rerank failure preserves dense order; faithfulness returns `null` so the UI can omit the badge instead of showing garbage.

## Troubleshooting

- **"Reindex required" banner won't go away** — Delete the flagged files and re-upload them.
- **Pinecone schema recreate fails** — Check that your Pinecone API key has permission to delete indexes (some plans don't).
- **Faithfulness pill is missing on a response** — The judge's JSON parse failed (rare). The UI omits the badge rather than showing a misleading value.
- **First chat is slow** — The MiniLM model (~25MB) is downloaded on first use. Subsequent calls are fast.