"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
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
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && !loading && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              Start a focused brief
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Add sources on the left, then ask for summaries, insights, or
              comparisons grounded in those files.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[min(100%,44rem)] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                message.role === "user"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <>
                  {message.pending ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Drafting answer…
                    </div>
                  ) : (
                    <div className="max-w-none text-sm leading-relaxed text-slate-700 [&_a]:text-sky-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[0.9em]">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="mb-2 list-disc pl-5">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-2 list-decimal pl-5">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-1">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {!message.pending && message.sources && message.sources.length > 0 && (
                    <EvidenceTray sources={message.sources} />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-slate-200 pt-4">
        {!canSend && (
          <p className="mb-3 text-center text-xs text-amber-700">
            Select at least one document to unlock chat.
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
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
            className="min-h-[52px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner outline-none ring-sky-200 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSend || !input.trim()}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 disabled:opacity-40"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
