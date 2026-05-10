# NotebookLM-Style RAG Application

A production-ready Retrieval-Augmented Generation (RAG) application built on Next.js, Express, and Pinecone. Upload PDF or TXT files, split and embed their contents, then query them with answers drawn exclusively from your chosen documents.

## Features

- 📤 **File Upload**: Drag and drop or browse to select PDF/TXT files
- 🤖 **RAG-Powered Chat**: Ask questions anchored to your documents
- 📌 **Multi-Document Support**: Choose which files contribute to each answer
- 🔗 **Source Citations**: Inspect retrieved chunks and their origin files
- 💾 **Persistent Storage**: Files are retained across sessions via localStorage
- 🎨 **Modern UI**: Clean, responsive design powered by Tailwind CSS
- 🚀 **Free Stack**: Powered by Groq (free LLM) and HuggingFace embeddings

## Tech Stack

### Frontend
- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS
- **API Client**: Axios
- **State**: React Hooks + localStorage

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Vector DB**: Pinecone
- **Embeddings**: HuggingFace (sentence-transformers/all-MiniLM-L6-v2) via Transformers.js
- **LLM**: Groq (llama-3.3-70b-versatile)
- **Document Parsing**: pdf-parse
- **File Upload**: Multer
- **Chunking**: LangChain RecursiveCharacterTextSplitter

## Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- **Groq API Key** (free tier at https://console.groq.com)
- **Pinecone Account** (free tier at https://www.pinecone.io)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone or extract the project
cd notebooklm_clone

# Install backend dependencies
cd server
npm install

# Install frontend dependencies (in a separate terminal)
cd client
npm install
```

### 2. Configure Environment Variables

#### Backend Setup (`server/.env`)

Create `server/.env` and populate it with the following:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_INDEX_NAME=notebooklm-rag
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PORT=3001
```

**Where to get these keys:**

1. **Groq API Key**:
   - Visit https://console.groq.com
   - Create a free account
   - Go to API Keys
   - Copy your key

2. **Pinecone Setup**:
   - Visit https://www.pinecone.io
   - Create a free account
   - Set up a new organization
   - Retrieve your API Key from the dashboard
   - Select your preferred cloud provider (AWS recommended)
   - Pick a region (us-east-1 recommended)

#### Frontend Setup (`client/.env.local`)

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### 3. Start the Application

You will need **two terminal windows**:

**Terminal 1 — Backend API**

```bash
cd server
npm run dev
```

Expected output:
```
Pinecone index ready...
API listening on http://localhost:3001
```

**Terminal 2 — Frontend**

```bash
cd client
npm run dev
```

Expected output:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

### 4. Open the Application

Navigate to `http://localhost:3000` in your browser.

## How to Use

1. **Upload Documents**:
   - Drag and drop PDF or TXT files onto the upload zone
   - Or click "Choose file" to browse
   - Wait for the "Upload complete" confirmation

2. **Select Documents**:
   - Uploaded files appear in the left sidebar
   - Check the box next to each file to include it in answers
   - Use "Select all" or "Clear all" for batch operations

3. **Ask Questions**:
   - Type your question in the chat input
   - Press Enter or click Send
   - The AI will search your documents and return a grounded answer

4. **View Sources**:
   - Every response includes a "Sources" section
   - Expand it to see the exact chunks used
   - Use this to verify answers are grounded in your documents

5. **Manage Files**:
   - Click the trash icon to delete an individual file
   - Click "Clear all" to remove everything
   - The file list persists across browser sessions via localStorage

## Document Processing

1. **Upload**: File is received by the backend via Multer
2. **Extract**: Text is parsed from the PDF or TXT file
3. **Chunk**: Text is split into 500-character chunks with 100-character overlap
4. **Embed**: Each chunk is converted to a 384-dimensional embedding (all-MiniLM-L6-v2)
5. **Store**: Embeddings are upserted into Pinecone along with metadata
6. **Query**: User questions are embedded and matched against stored vectors
7. **Generate**: Retrieved context is sent to Groq to produce a grounded response

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Multipart field `file` — PDF or TXT |
| `POST` | `/api/chat` | JSON `{ message, selectedFileIds }` |
| `GET` | `/api/files` | Uploaded file metadata (server-side registry) |
| `DELETE` | `/api/files/:fileId` | Remove local file, metadata, and Pinecone vectors for `fileId` |

## Project Layout

- `client/` — Next.js App Router, Tailwind, `localStorage` for file list and active selections
- `server/` — Express, Multer, LangChain text splitting, OpenAI embeddings/chat, Pinecone