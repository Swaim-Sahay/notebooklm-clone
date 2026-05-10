"use client";

import { FileText, Trash2, CheckCircle2 } from "lucide-react";
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
    <aside className="flex min-h-0 flex-col gap-4 rounded-[32px] border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Source Library
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Reference set
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pick the documents that should ground your answers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={files.length === 0 || busyFileId !== null}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-40"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={files.length === 0 || busyFileId !== null}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-40"
        >
          Clear library
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {files.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Your library is empty. Upload a few reference documents to get
            started.
          </div>
        ) : (
          files.map((file) => {
            const active = activeFileIds.includes(file.fileId);
            return (
              <div
                key={file.fileId}
                className={`flex items-start gap-3 rounded-3xl border px-3 py-3 text-sm shadow-sm transition ${
                  active
                    ? "border-sky-200 bg-sky-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(file.fileId)}
                  className="mt-0.5 text-sky-500"
                  aria-label={active ? "Deselect file" : "Select file"}
                >
                  <CheckCircle2
                    className={`h-5 w-5 ${active ? "opacity-100" : "opacity-30"}`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="truncate font-medium text-slate-900">
                      {file.fileName}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(file.uploadDate).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyFileId !== null}
                  onClick={() => onRemove(file.fileId)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  aria-label="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
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
