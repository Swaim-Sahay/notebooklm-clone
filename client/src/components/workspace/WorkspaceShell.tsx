"use client";

import { useCallback, useState } from "react";
import { LibraryPanel } from "./LibraryPanel";
import { ChatDeck } from "./ChatDeck";
import { useLocalFileState } from "@/hooks/useLocalFileState";
import { uploadFile, chatRequest, deleteServerFile } from "@/services/apiClient";
import type { ChatMessage } from "@/lib/types";
import { BookOpenText, NotebookPen, CircleDot } from "lucide-react";

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
        const { answer, sources, rewrittenQuery, faithfulness } =
          await chatRequest({
            message: text,
            selectedFileIds: activeFileIds,
          });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: answer,
                  sources,
                  rewrittenQuery,
                  faithfulness,
                  pending: false,
                }
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
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
        {/* ================== Header ================== */}
        <header className="card relative overflow-hidden p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(31,78,216,0.08),transparent_60%)]" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.06),transparent_60%)]" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <NotebookPen className="h-6 w-6 text-blue-700" />
                <span className="absolute -mt-7 ml-7 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white pulse-soft" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Notebook · RAG Workspace
                </p>
                <h1 className="mt-1 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
                  Chat with your knowledge library
                </h1>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Drop a few references, pick the ones you trust, and get
                  answers grounded in your own sources — every response comes
                  with citations.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill icon={<CircleDot className="h-3.5 w-3.5 text-emerald-600" />}>
                RAG online
              </Pill>
              <Pill
                icon={<BookOpenText className="h-3.5 w-3.5 text-slate-500" />}
              >
                {files.length} {files.length === 1 ? "source" : "sources"}
              </Pill>
              <Pill dotClass="bg-blue-700">
                {activeFileIds.length} active
              </Pill>
            </div>
          </div>
        </header>

        {/* ================== Body ================== */}
        <div className="grid flex-1 gap-6 lg:grid-cols-[340px_1fr]">
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
            <div className="card flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Dialogue
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    Synthesis room
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ask a question and keep responses tethered to sources.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 sm:block">
                    <div
                      className="h-full rounded-full bg-blue-700 transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, activeFileIds.length * 25)}%`,
                      }}
                    />
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {files.length} loaded
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {files.some((f) => f.stale) && (
                <div
                  className="stale-tag mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs"
                  data-testid="stale-banner"
                >
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>
                    <strong>Reindex required.</strong>{" "}
                    {files.filter((f) => f.stale).length} file(s) in your
                    library were ingested before the current pipeline and won&apos;t
                    be searched until you re-upload them.
                  </span>
                </div>
              )}

              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <ChatDeck
                  messages={messages}
                  onSend={handleSend}
                  loading={chatLoading}
                  canSend={canSend}
                />
              </div>
            </div>

            <div className="card-soft p-4 sm:p-5">
              <div className="flex items-center gap-2 pb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Workflow tips
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Tip
                  title="Compare perspectives"
                  body="Upload multiple briefs to surface differences in framing."
                />
                <Tip
                  title="Request structure"
                  body="Ask for timelines, summaries, or contradictions."
                />
                <Tip
                  title="Verify the trail"
                  body="Open the evidence panel to see exactly which chunks fed the answer."
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Pill({
  children,
  icon,
  dotClass,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  dotClass?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
      {icon ? icon : dotClass ? <span className={`h-2 w-2 rounded-full ${dotClass}`} /> : null}
      {children}
    </span>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[12.5px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
