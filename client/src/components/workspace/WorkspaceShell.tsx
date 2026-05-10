"use client";

import { useCallback, useState } from "react";
import { LibraryPanel } from "./LibraryPanel";
import { ChatDeck } from "./ChatDeck";
import { useLocalFileState } from "@/hooks/useLocalFileState";
import { uploadFile, chatRequest, deleteServerFile } from "@/services/apiClient";
import type { ChatMessage } from "@/lib/types";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function WorkspaceShell() {
  const {
    files,
    activeFileIds,
    addFile,
    removeFile,
    clearAllFiles,
    toggleActive,
    setActiveFileIds,
  } = useLocalFileState();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
        setError("Only PDF and TXT files are supported.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const meta = await uploadFile(file);
        addFile(meta);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? String(
                (e as { response?: { data?: { error?: string } } }).response
                  ?.data?.error
              )
            : "";
        setError(msg || (e instanceof Error ? e.message : "Upload failed."));
      } finally {
        setUploading(false);
      }
    },
    [addFile]
  );

  const handleRemove = useCallback(
    async (fileId: string) => {
      setBusyFileId(fileId);
      setError(null);
      try {
        await deleteServerFile(fileId);
        removeFile(fileId);
        setMessages((prev) => prev);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? String(
                (e as { response?: { data?: { error?: string } } }).response
                  ?.data?.error
              )
            : "";
        setError(msg || (e instanceof Error ? e.message : "Remove failed."));
      } finally {
        setBusyFileId(null);
      }
    },
    [removeFile]
  );

  const handleClearAll = useCallback(async () => {
    if (files.length === 0) return;
    setBusyFileId("__all__");
    setError(null);
    try {
      await Promise.all(files.map((file) => deleteServerFile(file.fileId)));
      clearAllFiles();
      setMessages([]);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String(
              (e as { response?: { data?: { error?: string } } }).response?.data
                ?.error
            )
          : "";
      setError(msg || (e instanceof Error ? e.message : "Clear failed."));
    } finally {
      setBusyFileId(null);
    }
  }, [files, clearAllFiles]);

  const handleSend = useCallback(
    async (text: string) => {
      if (activeFileIds.length === 0) return;
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
      };
      const assistantId = newId();
      const pending: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, pending]);
      setChatLoading(true);
      setError(null);
      try {
        const { answer, sources } = await chatRequest({
          message: text,
          selectedFileIds: activeFileIds,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: answer, sources, pending: false }
              : m
          )
        );
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? String(
                (e as { response?: { data?: { error?: string } } }).response
                  ?.data?.error
              )
            : "";
        const errText =
          msg || (e instanceof Error ? e.message : "Something went wrong.");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: errText,
                  pending: false,
                  sources: [],
                }
              : m
          )
        );
      } finally {
        setChatLoading(false);
      }
    },
    [activeFileIds]
  );

  const selectAll = useCallback(() => {
    setActiveFileIds(files.map((file) => file.fileId));
  }, [files, setActiveFileIds]);

  const canSend = activeFileIds.length > 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="rounded-[32px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            Atlas Workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Research canvas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Build grounded answers by pairing your library with curated
            questions. Pick sources, ask, and gather citations in one place.
          </p>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[320px_1fr]">
          <LibraryPanel
            files={files}
            activeFileIds={activeFileIds}
            onToggle={toggleActive}
            onRemove={handleRemove}
            onClearAll={handleClearAll}
            onSelectAll={selectAll}
            busyFileId={busyFileId}
            handleUpload={handleUpload}
            uploading={uploading}
          />

          <section className="flex min-h-0 flex-col gap-4">
            <div className="rounded-[32px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Dialogue
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Synthesis room
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ask a question and keep responses tethered to sources.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {files.length} sources loaded
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <ChatDeck
                messages={messages}
                onSend={handleSend}
                loading={chatLoading}
                canSend={canSend}
              />
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white/70 p-5 text-xs text-slate-500">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Workflow tips
              </p>
              <ul className="mt-3 space-y-2">
                <li>• Upload multiple briefs to compare perspectives.</li>
                <li>• Ask for timelines, summaries, or contradictions.</li>
                <li>• Use citations to verify the answer.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
