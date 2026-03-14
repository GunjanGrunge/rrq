"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import { ArrowRight, ChevronDown } from "lucide-react";

const TONES = [
  "informative",
  "entertaining",
  "documentary",
  "controversial",
  "persuasive",
] as const;

type Tone = (typeof TONES)[number];

export default function CreatePage() {
  const router = useRouter();
  const { setBrief, startJob, setStep } = usePipelineStore();

  useEffect(() => { setStep(0); }, [setStep]);

  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(10);
  const [tone, setTone] = useState<Tone>("informative");
  const [generateShorts, setGenerateShorts] = useState(false);
  const [shortsType, setShortsType] = useState<"convert" | "fresh">("convert");
  const [qualityThreshold] = useState(7);
  const [isStarting, setIsStarting] = useState(false);

  const estimatedWords = Math.round(duration * 150);

  async function handleStart() {
    if (!topic.trim()) return;
    setIsStarting(true);

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setBrief({ topic, duration, tone, generateShorts, shortsType, qualityThreshold });
    startJob(jobId);
    setStep(2);

    router.push(`/create/research`);
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-8 py-16">
      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Title */}
        <div className="mb-12 text-center">
          <span className="font-dm-mono text-xs text-text-tertiary tracking-[0.3em] uppercase block mb-4">
            Step 01 · Creative Brief
          </span>
          <h1 className="font-syne font-bold text-5xl text-text-primary leading-tight">
            What&apos;s the video about?
          </h1>
        </div>

        {/* Topic input */}
        <div className="mb-8">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The hidden truth about intermittent fasting that nobody talks about"
            className="w-full bg-bg-surface border border-bg-border hover:border-bg-border-hover focus:border-accent-primary focus:outline-none focus:ring-0 rounded-none text-text-primary font-lora text-lg p-6 resize-none transition-all duration-200 placeholder:text-text-tertiary"
            rows={3}
            style={{ boxShadow: "none" }}
            onFocus={(e) => {
              e.target.style.boxShadow = "0 0 0 2px rgba(245, 166, 35, 0.3)";
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = "none";
            }}
          />
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

        {/* Tone selector */}
        <div className="mb-8 bg-bg-surface border border-bg-border p-6">
          <span className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase block mb-4">
            Tone
          </span>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`
                  font-dm-mono text-xs px-4 py-2 border tracking-widest uppercase transition-all duration-150
                  ${tone === t
                    ? "border-accent-primary bg-accent-primary text-text-inverse"
                    : "border-bg-border text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                  }
                `}
              >
                {t}
              </button>
            ))}
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
          disabled={!topic.trim() || isStarting}
          className={`
            w-full flex items-center justify-center gap-3 py-5
            font-syne font-bold text-base tracking-widest uppercase
            transition-all duration-200 group
            ${topic.trim() && !isStarting
              ? "bg-accent-primary hover:bg-accent-primary-hover text-text-inverse cursor-pointer"
              : "bg-bg-elevated text-text-tertiary cursor-not-allowed"
            }
          `}
        >
          {isStarting ? "Starting pipeline..." : "Start Pipeline"}
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
