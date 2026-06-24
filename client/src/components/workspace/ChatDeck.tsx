"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, User2, NotebookPen, Lock, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { EvidenceTray } from "./EvidenceTray";
import { useAutoScroll } from "@/hooks/useAutoScroll";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  canSend: boolean;
  placeholder?: string;
};

const STARTER_PROMPTS = [
  "Summarize the key findings across these documents.",
  "What are the strongest claims, and what evidence supports them?",
  "Compare the perspectives in each source.",
  "Pull out a timeline of events mentioned in the library.",
];

export function ChatDeck({
  messages,
  onSend,
  loading,
  canSend,
  placeholder = "Ask anything about the documents in your library…",
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, loading]);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || loading || !canSend) return;
    setInput("");
    onSend(trimmed);
  }, [input, loading, canSend, onSend]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="scroll-soft flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && !loading && (
          <EmptyChat
            canSend={canSend}
            onPick={(q) => {
              if (!canSend) return;
              setInput(q);
            }}
          />
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {loading && <PendingBubble />}
      </div>

      {/* ============= Composer ============= */}
      <div className="mt-4 border-t border-slate-200 pt-4">
        {!canSend && (
          <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-amber-700">
            <Lock className="h-3 w-3" />
            Select at least one document to unlock chat.
          </p>
        )}
        <div
          className={`relative flex flex-col gap-2 rounded-2xl border bg-white p-2 transition focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(31,78,216,0.10)] ${
            canSend ? "border-slate-300" : "border-slate-200 opacity-70"
          }`}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={placeholder}
            disabled={loading || !canSend}
            className="min-h-[52px] w-full resize-none rounded-xl bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <p className="text-[10.5px] uppercase tracking-wide text-slate-500">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                Shift + Enter
              </kbd>{" "}
              for newline
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={loading || !canSend || !input.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <Avatar role="assistant" />}
      <div
        className={`relative max-w-[min(100%,44rem)] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? "bg-blue-700 text-white"
            : "border border-slate-200 bg-white text-slate-800"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : message.pending ? null : (
          <>
            <div className="prose-chat text-[13.5px] leading-relaxed text-slate-800">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-2 list-disc space-y-1 pl-5 marker:text-blue-700">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 list-decimal space-y-1 pl-5 marker:text-teal-700">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-900">{children}</strong>
                  ),
                  a: ({ children, ...rest }) => (
                    <a
                      {...rest}
                      className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
                      {children}
                    </code>
                  ),
                  h1: ({ children }) => (
                    <h1 className="mb-2 mt-1 text-base font-semibold text-slate-900">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-1 text-[14.5px] font-semibold text-slate-900">
                      {children}
                    </h2>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-2 border-l-2 border-blue-300 bg-slate-50 px-3 py-1 text-slate-700">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            <AssistantMeta message={message} />
          </>
        )}

        {!isUser && !message.pending && message.sources && message.sources.length > 0 && (
          <EvidenceTray sources={message.sources} />
        )}
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600">
        <User2 className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-700 shadow-sm">
      <NotebookPen className="h-4 w-4" />
    </div>
  );
}

function PendingBubble() {
  return (
    <div className="flex justify-start gap-3">
      <Avatar role="assistant" />
      <div className="relative max-w-[20rem] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
          <span className="caret text-slate-700">
            Drafting a grounded answer
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-11/12 rounded-full shimmer" />
          <div className="h-2 w-9/12 rounded-full shimmer" />
          <div className="h-2 w-7/12 rounded-full shimmer" />
        </div>
      </div>
    </div>
  );
}

function AssistantMeta({ message }: { message: ChatMessage }) {
  const faith = message.faithfulness;
  const rewrite = message.rewrittenQuery;
  const hasFaith = faith && typeof faith.score === "number";
  const showRewrite = rewrite && rewrite.trim() && rewrite !== message.content;
  if (!hasFaith && !showRewrite) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {hasFaith && <FaithfulnessPill score={faith!.score} />}
      {showRewrite && (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] text-slate-600"
          title={rewrite}
        >
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Rewritten
          </span>
          <span className="truncate text-slate-700">{rewrite}</span>
        </span>
      )}
    </div>
  );
}

function FaithfulnessPill({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const tier =
    score >= 0.75
      ? { label: `Grounded ${pct}%`, cls: "faith-pill faith-pill--high" }
      : score >= 0.4
        ? { label: `Partial ${pct}%`, cls: "faith-pill faith-pill--mid" }
        : { label: `Ungrounded ${pct}%`, cls: "faith-pill faith-pill--low" };
  return (
    <span
      className={`inline-flex items-center gap-1 ${tier.cls}`}
      title="Groundedness: how much of the answer is supported by the retrieved sources."
    >
      <ShieldCheck className="h-3 w-3" />
      {tier.label}
    </span>
  );
}

function EmptyChat({
  canSend,
  onPick,
}: {
  canSend: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <NotebookPen className="h-6 w-6 text-blue-700" />
        </div>
        <p className="mt-3 text-base font-semibold text-slate-900">
          Start a focused brief
        </p>
        <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-slate-500">
          {canSend
            ? "Ask for summaries, insights, or comparisons — every answer is anchored to the sources you selected."
            : "Select one or more documents in the library to unlock a grounded conversation."}
        </p>

        <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {STARTER_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={!canSend}
              onClick={() => onPick(q)}
              className="group/prompt rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-[12px] text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-blue-700 group-hover/prompt:text-blue-800">
                Try asking
              </span>
              <span className="mt-1 block leading-snug">{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}