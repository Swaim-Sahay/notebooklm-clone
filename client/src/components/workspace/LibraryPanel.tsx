"use client";

import { FileText, Trash2, Circle, LibraryBig } from "lucide-react";
import type { UploadedFileMeta } from "@/lib/types";
import { IntakeDropzone } from "./IntakeDropzone";

type Props = {
  files: UploadedFileMeta[];
  activeFileIds: string[];
  onToggle: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  busyFileId: string | null;
  handleUpload: (file: File) => void;
  uploading: boolean;
};

export function LibraryPanel({
  files,
  activeFileIds,
  onToggle,
  onRemove,
  onClearAll,
  onSelectAll,
  busyFileId,
  handleUpload,
  uploading,
}: Props) {
  return (
    <aside className="card flex min-h-0 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              <LibraryBig className="h-4 w-4" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Source Library
            </p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Reference set
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Pick the documents that should ground your answers.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {files.length}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={files.length === 0 || busyFileId !== null}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={files.length === 0 || busyFileId !== null}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
        >
          Clear library
        </button>
      </div>

      <div className="scroll-soft min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {files.length === 0 ? (
          <EmptyLibrary />
        ) : (
          files.map((file, i) => {
            const active = activeFileIds.includes(file.fileId);
            return (
              <div
                key={file.fileId}
                className={`group relative flex items-start gap-3 overflow-hidden rounded-xl border px-3 py-3 text-sm transition ${
                  active
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {active && (
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 accent-bar" />
                )}

                <button
                  type="button"
                  onClick={() => onToggle(file.fileId)}
                  className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md transition"
                  aria-label={active ? "Deselect file" : "Select file"}
                >
                  {active ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-700 shadow-sm">
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-3.5 w-3.5 text-white"
                      >
                        <path
                          d="M4 10.5l3.5 3.5L16 6"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 group-hover:text-slate-500" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-[13px] font-medium text-slate-900">
                      {file.fileName}
                    </span>
                    {file.stale && (
                      <span
                        className="stale-tag inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
                        title="This file needs to be re-uploaded to be searched."
                      >
                        Reindex needed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10.5px] uppercase tracking-wide text-slate-500">
                    {new Date(file.uploadDate).toLocaleString()}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyFileId !== null}
                  onClick={() => onRemove(file.fileId)}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <IntakeDropzone
        onFileSelected={handleUpload}
        uploading={uploading}
        disabled={busyFileId !== null}
      />
    </aside>
  );
}

function EmptyLibrary() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
        <LibraryBig className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[12.5px] font-semibold text-slate-800">
        Your library is empty
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
        Drop a few reference documents below to ground your next conversation.
      </p>
    </div>
  );
}