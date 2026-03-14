"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { ArrowRight, ChevronDown, Send } from "lucide-react";

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
}

const ZEUS_OPENING = "Tell me about your video — what topic or idea do you have in mind?";

// Zeus follow-up logic based on what's missing
function getZeusFollowUp(
  topic: string,
  selectedTones: Tone[],
  selectedNiches: NicheValue[],
  messageCount: number
): string | null {
  if (messageCount === 1 && selectedNiches.length === 0) {
    return `Got it — "${topic.slice(0, 60)}${topic.length > 60 ? "…" : ""}". What field or audience is this for? Pick a niche above so I can tailor the research and framing.`;
  }
  if (messageCount === 1 && selectedTones.length === 0) {
    return `Nice topic. How do you want it to feel? Informative and factual, entertaining and story-driven, or something else? You can pick a tone above — or skip and I'll choose based on your niche.`;
  }
  if (messageCount >= 2 && selectedTones.length === 0 && selectedNiches.length > 0) {
    const nicheLabel = selectedNiches[0];
    const suggestedTone =
      nicheLabel.includes("Finance") || nicheLabel.includes("Science")
        ? "informative"
        : nicheLabel.includes("Entertainment") || nicheLabel.includes("Gaming")
        ? "entertaining"
        : nicheLabel.includes("Politics") || nicheLabel.includes("News")
        ? "controversial"
        : "informative";
    return `For ${nicheLabel}, I'd suggest an "${suggestedTone}" tone — it tends to perform well with that audience. Feel free to change it above, or I'll go with that.`;
  }
  return null;
}

export default function CreatePage() {
  const router = useRouter();
  const { setBrief, startJob, setStep } = usePipelineStore();

  useEffect(() => { setStep(0); }, [setStep]);

  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(10);
  const [selectedTones, setSelectedTones] = useState<Tone[]>([]);
  const [selectedNiches, setSelectedNiches] = useState<NicheValue[]>([]);
  const [generateShorts, setGenerateShorts] = useState(false);
  const [shortsType, setShortsType] = useState<"convert" | "fresh">("convert");
  const [qualityThreshold] = useState(7);
  const [directorMode, setDirectorMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"ai" | "self">("ai");
  const [isStarting, setIsStarting] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "zeus", content: ZEUS_OPENING },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [topicConfirmed, setTopicConfirmed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  function handleChatSend() {
    const msg = chatInput.trim();
    if (!msg) return;

    const userMessages: ChatMessage[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(userMessages);
    setChatInput("");

    // First user message sets the topic
    if (!topicConfirmed) {
      setTopic(msg);
      setTopicConfirmed(true);
    }

    const userMessageCount = userMessages.filter((m) => m.role === "user").length;
    const followUp = getZeusFollowUp(
      topicConfirmed ? topic : msg,
      selectedTones,
      selectedNiches,
      userMessageCount
    );

    if (followUp) {
      setTimeout(() => {
        setChatMessages((prev) => [...prev, { role: "zeus", content: followUp }]);
      }, 600);
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

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const primaryTone = selectedTones[0] ?? "informative";

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
    startJob(jobId);
    setStep(2);

    router.push(`/create/research`);
  }

  const canStart = topic.trim().length > 0;

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
          <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase block mb-4">
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

        {/* Zeus Chat */}
        <div className="mb-8 bg-bg-surface border border-bg-border">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-bg-border">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
            <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
              Zeus · Your AI Director
            </span>
          </div>

          {/* Messages */}
          <div className="px-5 py-4 space-y-4 max-h-64 overflow-y-auto">
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
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 pb-5 pt-2 flex gap-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={topicConfirmed ? "Reply to Zeus..." : "Describe your video idea..."}
              className="flex-1 bg-bg-elevated border border-bg-border hover:border-bg-border-hover focus:border-accent-primary focus:outline-none text-text-primary font-lora text-sm px-4 py-2.5 transition-all duration-200 placeholder:text-text-tertiary"
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim()}
              className={`px-4 py-2.5 transition-all duration-150 ${
                chatInput.trim()
                  ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse"
                  : "bg-bg-elevated text-text-tertiary cursor-not-allowed border border-bg-border"
              }`}
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* Niche selector */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase">
              Niche
            </span>
            {selectedNiches.length > 0 && (
              <span className="font-dm-mono text-[10px] text-accent-primary">
                {selectedNiches.length} selected
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {NICHES.map((n) => (
              <button
                key={n.value}
                onClick={() => toggleNiche(n.value)}
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
          <p className="font-dm-mono text-[10px] text-text-tertiary mt-3">
            Select one or more. Helps Zeus tailor research and positioning.
          </p>
        </div>

        {/* Tone selector — multi-select */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase">
              Tone
            </span>
            <span className="font-dm-mono text-[10px] text-text-tertiary">
              {selectedTones.length === 0 ? "Zeus will decide" : `${selectedTones.length} selected`}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => toggleTone(t.value)}
                className={`
                  flex items-center justify-between px-4 py-3 border text-left transition-all duration-150
                  ${selectedTones.includes(t.value)
                    ? "border-accent-primary bg-accent-primary/5"
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
          <p className="font-dm-mono text-[10px] text-text-tertiary mt-3">
            Skip to let Zeus choose based on your niche and topic.
          </p>
        </div>

        {/* Duration slider */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase">
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
              <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase block">
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
          <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase block mb-4">
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
        <div className="mb-10 flex items-center justify-between px-1">
          <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase">
            Min quality score
          </span>
          <div className="flex items-center gap-1">
            <span className="font-dm-mono text-sm text-text-primary">
              {qualityThreshold}/10
            </span>
            <ChevronDown size={12} className="text-text-tertiary" />
          </div>
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
          {isStarting ? "Starting..." : "Start Pipeline"}
          {!isStarting && (
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          )}
        </button>
      </div>
    </div>
  );
}
