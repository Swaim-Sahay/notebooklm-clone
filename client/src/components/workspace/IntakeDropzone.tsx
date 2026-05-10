"use client";

import { useCallback, useState } from "react";
import { CloudUpload } from "lucide-react";

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
      className={`relative rounded-3xl border border-dashed px-6 py-8 text-center transition ${
        dragging
          ? "border-sky-400 bg-sky-50"
          : "border-slate-200 bg-slate-50"
      } ${disabled || uploading ? "opacity-60" : "hover:border-sky-300"}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
        <CloudUpload className="h-6 w-6 text-sky-500" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        Drop a PDF or TXT file
      </p>
      <p className="mt-1 text-xs text-slate-500">
        We ingest and summarize your source instantly.
      </p>
      <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800">
        {uploading ? "Uploading…" : "Browse files"}
        <input
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="hidden"
          disabled={disabled || uploading}
          onChange={onChange}
        />
      </label>
    </div>
  );
}
