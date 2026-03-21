"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Zap } from "lucide-react";
import { useUIStore } from "@/lib/ui-store";

interface Message {
  id: string;
  role: "user" | "zeus";
  text: string;
  timestamp: number;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Suggested openers users can tap
const QUICK_PROMPTS = [
  "I want to change my niche",
  "How is my channel performing?",
  "What should I focus on this week?",
  "Explain the cold start results",
];

export default function ZeusChat() {
  const { zeusChatOpen, zeusChatContext, closeZeusChat } = useUIStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "zeus-intro",
      role: "zeus",
      text: "I'm Zeus. I oversee the full RRQ team — memory, scoring, strategy. What do you need?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset messages when context changes (new conversation opened)
  useEffect(() => {
    if (zeusChatOpen) {
      const newIntro = zeusChatContext === "niche-change"
        ? "Quick niche change. Three questions — current niche, new niche, content style. What are you moving away from?"
        : "I'm Zeus. I oversee the full RRQ team — memory, scoring, strategy. What do you need?";
      setMessages([{ id: "zeus-intro", role: "zeus", text: newIntro, timestamp: Date.now() }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [zeusChatOpen, zeusChatContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };
    // Capture current messages before state update for history
    const currentMessages = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Add a placeholder Zeus message we'll stream into
    const zeusId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: zeusId, role: "zeus", text: "", timestamp: Date.now() },
    ]);

    try {
      // Build history for Zeus context (exclude intro + current user message)
      const history = currentMessages
        .filter((m) => m.id !== "zeus-intro")
        .map((m) => ({ role: m.role === "zeus" ? "assistant" : "user", content: m.text }));

      const res = await fetch("/api/zeus/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history, context: zeusChatContext }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === zeusId
              ? { ...m, text: "Something went wrong on my end. Try again in a moment." }
              : m
          )
        );
        return;
      }

      // Stream SSE chunks into the Zeus placeholder message
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              text?: string;
              done?: boolean;
              error?: boolean;
            };
            if (payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === zeusId ? { ...m, text: m.text + payload.text } : m
                )
              );
            }
            if (payload.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === zeusId
                    ? { ...m, text: "Connection failed. I'm still watching — try again." }
                    : m
                )
              );
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === zeusId
            ? { ...m, text: "Connection failed. I'm still watching — try again." }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }, [sending, messages, zeusChatContext]);

  if (!zeusChatOpen) return null;

  return (
    <>
      {/* Backdrop (click outside to close) */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={closeZeusChat}
      />

      {/* Chat panel — fixed bottom-right */}
      <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-[580px] flex flex-col bg-bg-surface border border-bg-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent-primary" />
            <span className="font-syne font-bold text-sm text-text-primary tracking-wider">
              ZEUS
            </span>
            <span className="font-dm-mono text-[9px] text-accent-success tracking-widest uppercase border border-accent-success/30 px-1.5 py-0.5">
              Active
            </span>
          </div>
          <button
            onClick={closeZeusChat}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.filter((msg) => msg.text !== "" || msg.role !== "zeus").map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {msg.role === "zeus" && (
                <span className="font-dm-mono text-[9px] text-accent-primary tracking-widest">
                  ZEUS
                </span>
              )}
              <div
                className={`max-w-[85%] px-3 py-2 font-dm-mono text-[11px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent-primary text-text-inverse"
                    : "bg-bg-elevated text-text-primary border border-bg-border"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {sending && messages[messages.length - 1]?.text === "" && (
            <div className="flex items-start gap-2">
              <div className="bg-bg-elevated border border-bg-border px-3 py-2 flex items-center gap-2">
                <Loader2 size={10} className="text-accent-primary animate-spin" />
                <span className="font-dm-mono text-[10px] text-text-tertiary">
                  Zeus is thinking…
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts — only when first message */}
        {messages.length === 1 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp}
                onClick={() => void send(qp)}
                className="font-dm-mono text-[9px] text-text-secondary border border-bg-border px-2 py-1 hover:border-accent-primary hover:text-accent-primary transition-all duration-150 tracking-wider"
              >
                {qp}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-bg-border px-3 py-3 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Message Zeus…"
            className="flex-1 bg-transparent font-dm-mono text-[11px] text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <button
            onClick={() => void send(input)}
            disabled={!input.trim() || sending}
            className="text-accent-primary disabled:text-text-tertiary hover:text-accent-primary/80 transition-colors disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
