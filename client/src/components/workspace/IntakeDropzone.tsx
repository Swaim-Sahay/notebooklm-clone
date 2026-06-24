"use client";

import { useCallback, useState } from "react";
import { CloudUpload, FileText, FileType2 } from "lucide-react";

type Props = {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  disabled?: boolean;
};

export function IntakeDropzone({ onFileSelected, uploading, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [disabled, uploading, onFileSelected]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = "";
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative overflow-hidden rounded-2xl border border-dashed px-5 py-6 text-center transition ${
        dragging
          ? "border-blue-500 bg-blue-50"
          : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
      } ${disabled || uploading ? "opacity-60" : ""}`}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <CloudUpload className="h-5 w-5 text-blue-700" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {dragging ? "Release to add" : "Drop a PDF or TXT file"}
      </p>
      <p className="mt-1 text-[11.5px] text-slate-500">
        We ingest and embed it into your library.
      </p>

      <div className="mt-4 flex items-center justify-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800">
          {uploading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Uploading…
            </>
          ) : (
            "Browse files"
          )}
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            disabled={disabled || uploading}
            onChange={onChange}
          />
        </label>
        <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-500 sm:flex">
          <FileText className="h-3 w-3" /> PDF
          <span className="text-slate-300">·</span>
          <FileType2 className="h-3 w-3" /> TXT
        </div>
      </div>
    </div>
  );
}