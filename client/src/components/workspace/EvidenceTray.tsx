"use client";

import type { SourceChunk } from "@/lib/types";
import { ChevronDown } from "lucide-react";

type Props = {
  sources: SourceChunk[];
};

export function EvidenceTray({ sources }: Props) {
  if (!sources?.length) return null;

  return (
    <details className="mt-4 rounded-3xl border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        Evidence ({sources.length})
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-4 py-3">
        {sources.map((source, index) => (
          <article
            key={`${source.fileId}-${source.chunkIndex}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700"
          >
            <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {source.fileName}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                Chunk {source.chunkIndex}
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-slate-600">
              {source.text}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}
