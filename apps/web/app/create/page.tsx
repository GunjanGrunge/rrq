"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import type { RexScoreData } from "@/lib/pipeline-store";
import { ArrowRight, Send, Loader2, Lock } from "lucide-react";

const TONES = [
  { value: "informative", label: "Informative", desc: "Clear, factual, educational" },
  { value: "entertaining", label: "Entertaining", desc: "Engaging, fun, story-driven" },
  { value: "documentary", label: "Documentary", desc: "In-depth, investigative" },
  { value: "controversial", label: "Controversial", desc: "Bold, opinion-led, contrarian" },
  { value: "persuasive", label: "Persuasive", desc: "Conviction-driven, action-focused" },
] as const;

type Tone = (typeof TONES)[number]["value"];

const NICHES = [
  { value: "AI & Technology", label: "AI & Tech" },
  { value: "Finance & Investing", label: "Finance" },
  { value: "Health & Wellness", label: "Health" },
  { value: "Business & Entrepreneurship", label: "Business" },
  { value: "Gaming", label: "Gaming" },
  { value: "Science & Space", label: "Science" },
  { value: "News & Current Events", label: "News" },
  { value: "Sports", label: "Sports" },
  { value: "Entertainment & Pop Culture", label: "Entertainment" },
  { value: "Politics & Society", label: "Politics" },
  { value: "Education", label: "Education" },
  { value: "Lifestyle", label: "Lifestyle" },
] as const;

type NicheValue = (typeof NICHES)[number]["value"];

interface ChatMessage {
  role: "zeus" | "user";
  content: string;
  streaming?: boolean;
}

type RexScore = RexScoreData;

const DIMENSION_LABELS: Record<string, string> = {
  trendStrength: "Trend Strength",
  competitionLevel: "Opportunity Gap",
  audienceDemand: "Audience Demand",
  nicheRelevance: "Niche Relevance",
  contentUniqueness: "Uniqueness",
};

export default function CreatePage() {
  const router = useRouter();
  const { setBrief, brief: activeBrief, newSession: createNewSession, setStep } = usePipelineStore();

  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(10);
  const [selectedTones, setSelectedTones] = useState<Tone[]>([]);
  const [selectedNiches, setSelectedNiches] = useState<NicheValue[]>([]);
  const [nicheLocked, setNicheLocked] = useState(false);
  const [generateShorts, setGenerateShorts] = useState(false);
  const [shortsType, setShortsType] = useState<"convert" | "fresh">("convert");
  const [qualityThreshold, setQualityThreshold] = useState(7);
  const [directorMode, setDirectorMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"ai" | "self">("ai");
  const [isStarting, setIsStarting] = useState(false);
  const [isMidPipeline, setIsMidPipeline] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [topicConfirmed, setTopicConfirmed] = useState(false);
  const [zeusThinking, setZeusThinking] = useState(false);
  const [briefReady, setBriefReady] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef(false);

  // Rex score state — initialised from persisted brief if available
  const [rexScore, setRexScore] = useState<RexScore | null>(activeBrief?.rexScore ?? null);
  const [rexLoading, setRexLoading] = useState(false);
  // Track if rex has already been triggered for this brief session
  const rexTriggeredRef = useRef(false);

  useEffect(() => {
    const { sessions } = usePipelineStore.getState();
    if (Object.keys(sessions).length === 0) {
      createNewSession();
    }
    setStep(0);

    const state = usePipelineStore.getState();
    const restoredBrief = state.brief;
    if (restoredBrief?.chatMessages && restoredBrief.chatMessages.length > 0) {
      setChatMessages(restoredBrief.chatMessages);
      setTopic(restoredBrief.topic ?? "");
      setTopicConfirmed(true);
      setBriefReady(true);
      setSelectedTones((restoredBrief.tones ?? []) as Tone[]);
      setSelectedNiches((restoredBrief.selectedNiches ?? []) as NicheValue[]);
      setNicheLocked(true);
      setDuration(restoredBrief.duration ?? 10);
      setGenerateShorts(restoredBrief.generateShorts ?? false);
      setShortsType(restoredBrief.shortsType ?? "convert");
      setDirectorMode(restoredBrief.directorMode ?? false);
      setVoiceMode(restoredBrief.voiceMode ?? "ai");
      if (restoredBrief.rexScore) {
        setRexScore(restoredBrief.rexScore);
      }
      rexTriggeredRef.current = true;

      const activeSession = state.sessions[state.activeJobId ?? ""];
      if (activeSession && activeSession.currentStep > 0) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "zeus",
            content:
              "Welcome back. If you change anything and start again, the pipeline will reset — research, script, SEO, and quality gate will all need to run again from scratch. Let me know if you want to adjust anything or just go straight back to your pipeline.",
          },
        ]);
        setIsMidPipeline(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll chat container (not page) whenever messages change
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, zeusThinking]);

  const estimatedWords = Math.round(duration * 150);

  function toggleTone(t: Tone) {
    setSelectedTones((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function toggleNiche(n: NicheValue) {
    setSelectedNiches((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  // ── Streaming Zeus response ────────────────────────────────────────────────
  const streamZeusReply = useCallback(async (
    messages: ChatMessage[],
    currentTopic: string,
    currentNiches: NicheValue[],
    currentTones: Tone[],
    isOpening = false,
  ) => {
    if (streamingRef.current) return;
    streamingRef.current = true;
    setZeusThinking(true);

    // Add an empty Zeus message that we'll fill in as tokens arrive
    const placeholderIdx = messages.length;
    setChatMessages((prev) => [...prev, { role: "zeus", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/brief/zeus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          topic: currentTopic,
          niche: currentNiches,
          tone: currentTones,
          isOpening,
        }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Update the streaming message in place — strip signals from display
        const display = accumulated
          .replace(/\[BRIEF_READY\]/g, "")
          .replace(/\[NICHE_CHANGE:[^\]]*\]/g, "")
          .replace(/\[TONE:[^\]]*\]/g, "")
          .trim();

        setChatMessages((prev) => {
          const updated = [...prev];
          updated[placeholderIdx] = { role: "zeus", content: display, streaming: true };
          return updated;
        });
      }

      // Stream complete — resolve signals from accumulated text
      const briefReady = accumulated.includes("[BRIEF_READY]");
      const nicheMatch = accumulated.match(/\[NICHE_CHANGE:\s*([^\]]+)\]/);
      const finalDisplay = accumulated
        .replace(/\[BRIEF_READY\]/g, "")
        .replace(/\[NICHE_CHANGE:[^\]]*\]/g, "")
        .replace(/\[TONE:[^\]]*\]/g, "")
        .trim();

      // Finalise the message (remove streaming flag)
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[placeholderIdx] = { role: "zeus", content: finalDisplay };
        return updated;
      });

      if (nicheMatch) {
        const suggestedNiche = nicheMatch[1].trim() as NicheValue;
        const validNiche = NICHES.find((n) => n.value === suggestedNiche);
        if (validNiche) {
          setSelectedNiches([suggestedNiche]);
        }
      }

      // Parse tone recommendation
      const toneMatch = accumulated.match(/\[TONE:\s*([^\]]+)\]/);
      if (toneMatch) {
        const recommendedTones = toneMatch[1]
          .split(",")
          .map((t) => t.trim() as Tone)
          .filter((t) => TONES.some((opt) => opt.value === t))
          .slice(0, 2);
        if (recommendedTones.length > 0) setSelectedTones(recommendedTones);
      }

      if (briefReady && !rexTriggeredRef.current) {
        setBriefReady(true);
        rexTriggeredRef.current = true;
        runRexScore(currentTopic, messages);
      }
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[placeholderIdx] = { role: "zeus", content: "Something went wrong. Try again." };
        return updated;
      });
    } finally {
      streamingRef.current = false;
      setZeusThinking(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lock in niche ──────────────────────────────────────────────────────────
  async function handleNicheLockIn() {
    if (selectedNiches.length === 0 || nicheLocked) return;
    setNicheLocked(true);
    // Zeus comes online — send opening message
    await streamZeusReply([], "", selectedNiches, selectedTones, true);
  }

  // ── Send chat message ──────────────────────────────────────────────────────
  async function handleChatSend() {
    const msg = chatInput.trim();
    if (!msg || zeusThinking || streamingRef.current) return;

    if (!topicConfirmed) {
      setTopic(msg);
      setTopicConfirmed(true);
    }

    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: msg },
    ];
    setChatMessages(updatedMessages);
    setChatInput("");

    await streamZeusReply(updatedMessages, topicConfirmed ? topic : msg, selectedNiches, selectedTones);
  }

  async function runRexScore(resolvedTopic: string, messages: ChatMessage[]) {
    setRexLoading(true);
    const chatSummary = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" | ");

    try {
      const res = await fetch("/api/brief/rex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: resolvedTopic,
          niche: selectedNiches,
          tone: selectedTones,
          chatSummary,
        }),
      });
      const score = await res.json() as RexScore;
      setRexScore(score);
      // Persist into brief so it survives navigation
      const currentBrief = usePipelineStore.getState().brief;
      if (currentBrief) {
        usePipelineStore.getState().setBrief({ ...currentBrief, rexScore: score });
      }
    } catch {
      // non-blocking
    } finally {
      setRexLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }

  async function handleStart() {
    if (!topic.trim()) return;
    setIsStarting(true);

    const primaryTone = selectedTones[0] ?? "informative";

    // Only create a new session if the current session already has pipeline outputs
    // (i.e. research or later steps ran). Going back and editing the brief reuses the session.
    const currentState = usePipelineStore.getState();
    const activeSession = currentState.activeJobId
      ? currentState.sessions[currentState.activeJobId]
      : null;
    const hasOutputs = activeSession && Object.keys(activeSession.outputs).length > 0;
    if (hasOutputs) {
      createNewSession();
    }

    setBrief({
      topic,
      duration,
      tones: selectedTones.length > 0 ? selectedTones : ["informative"],
      tone: primaryTone,
      selectedNiches,
      generateShorts,
      shortsType,
      qualityThreshold,
      chatMessages,
      directorMode,
      voiceMode,
    });
    setStep(1);

    router.push(`/create/research`);
  }

  const verdictColor = rexScore?.verdict === "STRONG"
    ? "text-accent-success"
    : rexScore?.verdict === "SOLID"
    ? "text-accent-primary"
    : "text-accent-error";

  const verdictBorder = rexScore?.verdict === "STRONG"
    ? "border-accent-success/30 bg-accent-success/5"
    : rexScore?.verdict === "SOLID"
    ? "border-accent-primary/30 bg-accent-primary/5"
    : "border-accent-error/30 bg-accent-error/5";

  const canStart = briefReady && topic.trim().length > 0;

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-8 py-16">
      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Title */}
        <div className="mb-10 text-center">
          <span className="font-dm-mono text-xs text-text-tertiary tracking-[0.3em] uppercase block mb-4">
            Step 01 · Creative Brief
          </span>
          <h1 className="font-syne font-bold text-5xl text-text-primary leading-tight">
            Let&apos;s build your video.
          </h1>
        </div>

        {/* Production Mode selector */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase block mb-4">
            Production Mode
          </span>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                value: false,
                label: "Studio Mode",
                desc: "AI runs the full pipeline. Your video is produced and published automatically.",
              },
              {
                value: true,
                label: "Director Mode",
                desc: "AI produces, you approve 4 key creative decisions before publishing.",
              },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setDirectorMode(opt.value)}
                className={`
                  flex items-center justify-between px-4 py-3 border text-left transition-all duration-150
                  ${directorMode === opt.value
                    ? "border-accent-primary bg-accent-primary/5"
                    : "border-bg-border hover:border-bg-border-hover"
                  }
                `}
              >
                <div>
                  <span className={`font-dm-mono text-xs tracking-wider ${
                    directorMode === opt.value ? "text-accent-primary" : "text-text-primary"
                  }`}>
                    {opt.label}
                  </span>
                  <span className="font-lora text-xs text-text-tertiary ml-3">{opt.desc}</span>
                </div>
                {directorMode === opt.value && (
                  <div className="w-4 h-4 rounded-sm border border-accent-primary bg-accent-primary flex items-center justify-center shrink-0">
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Niche selector (pre-chat, with Lock In) ── */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase">
              Niche
            </span>
            {nicheLocked ? (
              <span className="font-dm-mono text-[10px] text-accent-success tracking-wider flex items-center gap-1.5">
                <Lock size={10} />
                Locked
              </span>
            ) : selectedNiches.length > 0 ? (
              <span className="font-dm-mono text-[10px] text-accent-primary">
                {selectedNiches.length} selected
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {NICHES.map((n) => (
              <button
                key={n.value}
                onClick={() => {
                  toggleNiche(n.value);
                  // If niche was locked and user changes it, let them re-lock
                  if (nicheLocked) setNicheLocked(false);
                }}
                className={`
                  font-dm-mono text-xs px-3 py-1.5 border tracking-wider transition-all duration-150
                  ${selectedNiches.includes(n.value)
                    ? "border-accent-primary bg-accent-primary text-text-inverse"
                    : "border-bg-border text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                  }
                `}
              >
                {n.label}
              </button>
            ))}
          </div>

          {/* Lock In button */}
          {!nicheLocked ? (
            <button
              onClick={handleNicheLockIn}
              disabled={selectedNiches.length === 0}
              className={`
                w-full flex items-center justify-center gap-2 py-2.5
                font-dm-mono text-xs tracking-widest uppercase transition-all duration-150
                ${selectedNiches.length > 0
                  ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse cursor-pointer"
                  : "bg-bg-elevated text-text-tertiary cursor-not-allowed border border-bg-border"
                }
              `}
            >
              <Lock size={11} />
              Lock In Niche
            </button>
          ) : (
            <p className="font-dm-mono text-[10px] text-text-secondary">
              Zeus is using your niche context. You can still change it above.
            </p>
          )}
        </div>

        {/* ── Zeus Chat ── */}
        <div className={`mb-8 bg-bg-surface border transition-all duration-300 ${
          nicheLocked ? "border-bg-border" : "border-bg-border opacity-60"
        }`}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-bg-border">
            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              nicheLocked ? "bg-accent-primary animate-pulse" : "bg-text-tertiary"
            }`} />
            <span className={`font-dm-mono text-[10px] tracking-widest uppercase transition-colors duration-300 ${
              nicheLocked ? "text-accent-primary" : "text-text-tertiary"
            }`}>
              Zeus · {nicheLocked ? "Your AI Director" : "Offline"}
            </span>
            {briefReady && (
              <span className="ml-auto font-dm-mono text-[10px] text-accent-success tracking-wider">
                ◆ Brief locked
              </span>
            )}
          </div>

          {/* Offline state */}
          {!nicheLocked && (
            <div className="px-5 py-8 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center">
                <span className="font-dm-mono text-[10px] text-text-tertiary font-bold">Z</span>
              </div>
              <p className="font-dm-mono text-xs text-text-tertiary text-center">
                Select your niche and lock in to bring Zeus online.
              </p>
            </div>
          )}

          {/* Messages */}
          {nicheLocked && (
            <>
              <div ref={chatScrollRef} className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {msg.role === "zeus" && (
                      <div className="w-7 h-7 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-dm-mono text-[9px] text-accent-primary font-bold">Z</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2.5 font-lora text-sm leading-relaxed ${
                        msg.role === "zeus"
                          ? "bg-bg-elevated text-text-secondary"
                          : "bg-accent-primary/10 border border-accent-primary/20 text-text-primary"
                      }`}
                    >
                      {msg.content}
                      {msg.streaming && (
                        <span className="inline-block w-1 h-3.5 bg-accent-primary/70 ml-0.5 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                ))}

                {zeusThinking && chatMessages[chatMessages.length - 1]?.role !== "zeus" && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center shrink-0">
                      <span className="font-dm-mono text-[9px] text-accent-primary font-bold">Z</span>
                    </div>
                    <div className="bg-bg-elevated px-4 py-2.5 flex items-center gap-2">
                      <Loader2 size={12} className="text-accent-primary animate-spin" />
                      <span className="font-dm-mono text-[10px] text-text-tertiary tracking-wider">Zeus is thinking…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {!briefReady && (
                <div className="px-5 pb-5 pt-2 flex gap-3">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={zeusThinking}
                    placeholder={topicConfirmed ? "Reply to Zeus…" : "Describe your video idea…"}
                    className="flex-1 bg-bg-elevated border border-bg-border hover:border-bg-border-hover focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-4 py-2.5 transition-all duration-200 placeholder:text-text-tertiary disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || zeusThinking}
                    className={`px-4 py-2.5 transition-all duration-150 ${
                      chatInput.trim() && !zeusThinking
                        ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse"
                        : "bg-bg-elevated text-text-tertiary cursor-not-allowed border border-bg-border"
                    }`}
                  >
                    <Send size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rex Score Card — appears after brief is locked */}
        {briefReady && (
          <div className={`mb-8 border p-6 ${rexLoading ? "border-bg-border bg-bg-surface" : verdictBorder}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
                  Rex · Opportunity Score
                </span>
              </div>
              {rexScore && (
                <div className="flex items-center gap-3">
                  <span className={`font-syne font-bold text-2xl ${verdictColor}`}>
                    {rexScore.overall}
                  </span>
                  <span className={`font-dm-mono text-xs tracking-widest ${verdictColor}`}>
                    {rexScore.verdict}
                  </span>
                </div>
              )}
            </div>

            {rexLoading && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 size={14} className="text-accent-primary animate-spin" />
                <span className="font-dm-mono text-xs text-text-tertiary tracking-wider">
                  Rex is scanning the opportunity…
                </span>
              </div>
            )}

            {rexScore && (
              <>
                <div className="space-y-3 mb-4">
                  {Object.entries(rexScore.dimensions).map(([key, dim]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-dm-mono text-[10px] text-text-tertiary tracking-wider">
                          {DIMENSION_LABELS[key] ?? key}
                        </span>
                        <span className="font-dm-mono text-[10px] text-text-secondary">
                          {dim.note}
                        </span>
                      </div>
                      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            dim.score >= 70 ? "bg-accent-success" :
                            dim.score >= 45 ? "bg-accent-primary" :
                            "bg-accent-error"
                          }`}
                          style={{ width: `${dim.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="font-lora text-xs text-text-secondary italic border-t border-bg-border pt-3">
                  {rexScore.recommendation}
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Tone (post-brief, Zeus-recommended) ── */}
        {briefReady && (
          <div className="mb-8 bg-bg-surface border border-bg-border p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase">
                Tone
              </span>
              <span className="font-dm-mono text-[10px] text-text-tertiary">
                {selectedTones.length === 0 ? "Zeus will decide" : `${selectedTones.length}/2 selected`}
              </span>
            </div>
            <p className="font-dm-mono text-[10px] text-text-secondary mb-4">
              Zeus picked this based on your brief. You can change or add a second tone — max 2 to keep the content focused.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    if (selectedTones.includes(t.value)) {
                      toggleTone(t.value);
                    } else if (selectedTones.length < 2) {
                      toggleTone(t.value);
                    }
                  }}
                  disabled={!selectedTones.includes(t.value) && selectedTones.length >= 2}
                  className={`
                    flex items-center justify-between px-4 py-3 border text-left transition-all duration-150
                    ${selectedTones.includes(t.value)
                      ? "border-accent-primary bg-accent-primary/5"
                      : selectedTones.length >= 2
                      ? "border-bg-border opacity-40 cursor-not-allowed"
                      : "border-bg-border hover:border-bg-border-hover"
                    }
                  `}
                >
                  <div>
                    <span className={`font-dm-mono text-xs tracking-wider ${
                      selectedTones.includes(t.value) ? "text-accent-primary" : "text-text-primary"
                    }`}>
                      {t.label}
                    </span>
                    <span className="font-lora text-xs text-text-tertiary ml-3">{t.desc}</span>
                  </div>
                  {selectedTones.includes(t.value) && (
                    <div className="w-4 h-4 rounded-sm border border-accent-primary bg-accent-primary flex items-center justify-center shrink-0">
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Duration slider */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase">
              Duration
            </span>
            <span className="font-dm-mono text-sm text-accent-primary">
              {duration} min · ~{estimatedWords.toLocaleString()} words
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={20}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-1 bg-bg-elevated rounded-full appearance-none cursor-pointer accent-accent-primary"
          />
          <div className="flex justify-between mt-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary">3 min</span>
            <span className="font-dm-mono text-[10px] text-text-tertiary">20 min</span>
          </div>
        </div>

        {/* YouTube Shorts toggle */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase block">
                YouTube Shorts
              </span>
              <span className="font-lora text-sm text-text-secondary mt-1 block">
                Also generate a Short?
              </span>
            </div>
            <button
              onClick={() => setGenerateShorts(!generateShorts)}
              className={`
                relative w-12 h-6 rounded-full transition-all duration-200
                ${generateShorts ? "bg-accent-primary" : "bg-bg-elevated border border-bg-border"}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
                  ${generateShorts ? "left-7" : "left-1"}
                `}
              />
            </button>
          </div>

          {generateShorts && (
            <div className="mt-4 flex gap-3">
              {[
                { value: "convert" as const, label: "Convert from main", note: "Free" },
                { value: "fresh" as const, label: "Fresh Short content", note: "+$0.01" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setShortsType(opt.value)}
                  className={`
                    flex-1 border p-3 text-left transition-all duration-150
                    ${shortsType === opt.value
                      ? "border-accent-primary bg-bg-elevated"
                      : "border-bg-border hover:border-bg-border-hover"
                    }
                  `}
                >
                  <div className="font-dm-mono text-xs text-text-primary tracking-wide">
                    {opt.label}
                  </div>
                  <div className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                    {opt.note}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Voice */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase block mb-4">
            Voice
          </span>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                value: "ai" as const,
                label: "AI Voice",
                desc: "ARIA picks the right voice and tone for your video. Hands-free.",
              },
              {
                value: "self" as const,
                label: "My Voice",
                desc: "Record and upload your own voiceover. AI writes the script, you deliver it.",
              },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVoiceMode(opt.value)}
                className={`
                  flex items-center justify-between px-4 py-3 border text-left transition-all duration-150
                  ${voiceMode === opt.value
                    ? "border-accent-primary bg-accent-primary/5"
                    : "border-bg-border hover:border-bg-border-hover"
                  }
                `}
              >
                <div>
                  <span className={`font-dm-mono text-xs tracking-wider ${
                    voiceMode === opt.value ? "text-accent-primary" : "text-text-primary"
                  }`}>
                    {opt.label}
                  </span>
                  <span className="font-lora text-xs text-text-tertiary ml-3">{opt.desc}</span>
                </div>
                {voiceMode === opt.value && (
                  <div className="w-4 h-4 rounded-sm border border-accent-primary bg-accent-primary flex items-center justify-center shrink-0">
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {voiceMode === "self" && (
            <p className="font-dm-mono text-[10px] text-accent-primary mt-3">
              You&apos;ll be prompted to upload your recording at the audio step.
            </p>
          )}
        </div>

        {/* Quality threshold */}
        <div className="mb-10 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase">
              Min Quality Score
            </span>
            <span className={`font-dm-mono text-sm font-bold ${
              qualityThreshold <= 5
                ? "text-accent-error"
                : qualityThreshold >= 9
                ? "text-accent-primary"
                : "text-accent-success"
            }`}>
              {qualityThreshold}/10
            </span>
          </div>
          <p className="font-dm-mono text-[10px] text-text-secondary mb-4 leading-relaxed">
            Every script is scored before production begins. Set this too low and weak content gets through — costing you a full production run on a video that won&apos;t perform. Set it too high and the pipeline may never produce a passing script, forcing repeated rewrites that burn credits either way.
          </p>
          <input
            type="range"
            min={4}
            max={10}
            value={qualityThreshold}
            onChange={(e) => setQualityThreshold(Number(e.target.value))}
            className="w-full h-1 bg-bg-elevated rounded-full appearance-none cursor-pointer accent-accent-primary mb-3"
          />
          <div className="flex justify-between mb-4">
            <span className="font-dm-mono text-[10px] text-text-tertiary">4 — Lenient</span>
            <span className="font-dm-mono text-[10px] text-accent-primary">7 — Recommended</span>
            <span className="font-dm-mono text-[10px] text-text-tertiary">10 — Strict</span>
          </div>
          {qualityThreshold <= 5 && (
            <p className="font-dm-mono text-[10px] text-accent-error leading-relaxed">
              Low bar — weak scripts may pass and cost you GPU time and ElevenLabs credits on content that won&apos;t perform.
            </p>
          )}
          {qualityThreshold >= 9 && (
            <p className="font-dm-mono text-[10px] text-accent-primary leading-relaxed">
              Very strict — the pipeline may loop on rewrites frequently. Use only for premium, long-form content.
            </p>
          )}
          {qualityThreshold >= 6 && qualityThreshold <= 8 && (
            <p className="font-dm-mono text-[10px] text-text-tertiary leading-relaxed">
              {qualityThreshold === 7
                ? "Default — balances quality and throughput. Recommended for most channels."
                : qualityThreshold === 8
                ? "High bar — good for established channels where quality is the priority."
                : "Slightly lenient — suitable for high-volume or experimental content."}
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={!canStart || isStarting}
          className={`
            w-full flex items-center justify-center gap-3 py-5
            font-syne font-bold text-base tracking-widest uppercase
            transition-all duration-200 group
            ${canStart && !isStarting
              ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse cursor-pointer"
              : "bg-bg-elevated text-text-tertiary cursor-not-allowed"
            }
          `}
        >
          {isStarting ? "Starting…" : briefReady ? (isMidPipeline ? "Reset & Start Over" : "Start Pipeline") : "Talk to Zeus first"}
          {!isStarting && canStart && (
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          )}
        </button>

        {!briefReady && (
          <p className="font-dm-mono text-[10px] text-text-secondary text-center mt-3">
            Zeus needs to understand your idea before production starts.
          </p>
        )}
      </div>
    </div>
  );
}
