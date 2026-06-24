export type UploadedFileMeta = {
  fileId: string;
  fileName: string;
  uploadDate: string;
  /** True when the file exists in metadata but its chunks are missing from the
   *  current index (typically after a server-side index rebuild). */
  stale?: boolean;
};

export type SourceChunk = {
  fileId: string;
  fileName: string;
  chunkIndex: number;
  text: string;
  /** Cosine similarity from the dense leg (Pinecone). Optional. */
  score?: number;
  /** 0..1 score from the LLM reranker (1 = very relevant). */
  rerankerScore?: number;
  /** Total chunks in the source file. Lets the UI say "Chunk N of M". */
  totalChunks?: number;
};

export type Faithfulness = {
  /** 0..1 score; 1 = every claim in the answer is supported by context. */
  score: number;
  /** Optional list of claims the judge found unsupported. */
  unsupported?: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  pending?: boolean;
  /** The rewritten query used for retrieval (may equal `content` if no rewrite happened). */
  rewrittenQuery?: string;
  /** Faithfulness score for the assistant's answer. */
  faithfulness?: Faithfulness | null;
};