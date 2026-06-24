"use client";

import type { SourceChunk } from "@/lib/types";
import { ChevronDown, Quote, Hash, FileText, Gauge } from "lucide-react";

type Props = {
  sources: SourceChunk[];
};

export function EvidenceTray({ sources }: Props) {
  if (!sources?.length) return null;

  return (
    <details className="group/evidence mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100">
        <span className="flex items-center gap-2">
          <Quote className="h-3.5 w-3.5 text-blue-700" />
          Evidence · {sources.length}{" "}
          <span className="text-slate-500">
            {sources.length === 1 ? "chunk" : "chunks"}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open/evidence:rotate-180" />
      </summary>

      <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3">
        {sources.map((source, index) => {
          const chunkLabel =
            typeof source.totalChunks === "number" && source.totalChunks > 0
              ? `Chunk ${source.chunkIndex} of ${source.totalChunks}`
              : `Chunk ${source.chunkIndex}`;
          return (
            <article
              key={`${source.fileId}-${source.chunkIndex}-${index}`}
              className="group/source relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">
                  <FileText className="h-3 w-3 text-slate-500" />
                  <span className="max-w-[16rem] truncate">{source.fileName}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
                  <Hash className="h-3 w-3" />
                  {chunkLabel}
                </span>
                {typeof source.rerankerScore === "number" && (
                  <span
                    className="rerank-pill inline-flex items-center gap-1"
                    title="Relevance score from the LLM reranker (0–1)."
                  >
                    <Gauge className="h-3 w-3" />
                    rerank {(source.rerankerScore * 100).toFixed(0)}%
                  </span>
                )}
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Source {index + 1}
                </span>
              </div>

              <div className="relative pl-3">
                <span className="absolute left-0 top-0 h-full w-0.5 accent-bar" />
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                  {source.text}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}