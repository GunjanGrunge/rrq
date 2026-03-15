"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { ScriptOutput, ScriptSection } from "@/lib/types/pipeline";
import { Mic, Upload, CheckCircle, Play, Pause, SkipForward } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

/** "0:00" / "1:32" → seconds */
function tsToSec(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** seconds → "m:ss" */
function secToTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SECTION_COLOURS = [
  "bg-amber-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-400",
  "bg-indigo-400",
];

// ── SectionTimeline ───────────────────────────────────────────────────────────

interface SectionTiming {
  sectionId: string;
  label: string;
  startSec: number;
  endSec: number;
}

interface SectionTimelineProps {
  timings: SectionTiming[];
  duration: number; // total audio duration in seconds
  currentTime: number;
  onSeek: (sec: number) => void;
  onTimingChange: (index: number, field: "startSec" | "endSec", value: number) => void;
  activeIndex: number;
}

function SectionTimeline({
  timings,
  duration,
  currentTime,
  onSeek,
  onTimingChange,
  activeIndex,
}: SectionTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);

  function handleBarClick(e: React.MouseEvent) {
    if (!barRef.current || duration === 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }

  return (
    <div>
      {/* Progress bar with section colour segments */}
      <div
        ref={barRef}
        onClick={handleBarClick}
        className="relative h-8 bg-bg-elevated rounded-md overflow-hidden cursor-pointer mb-4"
      >
        {duration > 0 && timings.map((t, i) => {
          const left = (t.startSec / duration) * 100;
          const width = ((t.endSec - t.startSec) / duration) * 100;
          return (
            <div
              key={t.sectionId}
              className={`absolute top-0 h-full opacity-70 ${SECTION_COLOURS[i % SECTION_COLOURS.length]}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
              title={t.label}
            />
          );
        })}
        {/* Playhead */}
        {duration > 0 && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white shadow-md z-10 transition-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        )}
        {/* Time label */}
        <div className="absolute inset-0 flex items-center justify-end pr-2 pointer-events-none">
          <span className="font-dm-mono text-[9px] text-white/60">
            {secToTs(currentTime)} / {secToTs(duration)}
          </span>
        </div>
      </div>

      {/* Section rows */}
      <div className="space-y-2">
        {timings.map((t, i) => {
          const isActive = i === activeIndex;
          const colour = SECTION_COLOURS[i % SECTION_COLOURS.length];
          return (
            <div
              key={t.sectionId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all duration-150 ${
                isActive
                  ? "border-accent-primary bg-accent-primary/5"
                  : "border-bg-border bg-bg-surface hover:border-bg-border-hover"
              }`}
            >
              {/* Colour swatch */}
              <div className={`w-2 h-6 rounded-sm shrink-0 ${colour}`} />

              {/* Label */}
              <span className="font-syne text-xs font-bold text-text-primary flex-1 truncate min-w-0">
                {t.label}
              </span>

              {/* Seek to start */}
              <button
                onClick={() => onSeek(t.startSec)}
                className="text-text-tertiary hover:text-accent-primary transition-colors shrink-0"
                title="Play from here"
              >
                <SkipForward size={13} />
              </button>

              {/* Start time input */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-dm-mono text-[10px] text-text-tertiary">in</span>
                <input
                  type="text"
                  value={secToTs(t.startSec)}
                  onChange={(e) => {
                    const s = tsToSec(e.target.value);
                    if (!isNaN(s)) onTimingChange(i, "startSec", s);
                  }}
                  className="w-12 bg-bg-elevated border border-bg-border rounded px-1.5 py-0.5 font-dm-mono text-[11px] text-text-primary text-center focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* End time input */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-dm-mono text-[10px] text-text-tertiary">out</span>
                <input
                  type="text"
                  value={secToTs(t.endSec)}
                  onChange={(e) => {
                    const s = tsToSec(e.target.value);
                    if (!isNaN(s)) onTimingChange(i, "endSec", s);
                  }}
                  className="w-12 bg-bg-elevated border border-bg-border rounded px-1.5 py-0.5 font-dm-mono text-[11px] text-text-primary text-center focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* Duration label */}
              <span className="font-dm-mono text-[10px] text-text-tertiary shrink-0 w-10 text-right">
                {secToTs(t.endSec - t.startSec)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SelfVoicePage ─────────────────────────────────────────────────────────────

function buildInitialTimings(sections: ScriptSection[]): SectionTiming[] {
  return sections.map((s) => ({
    sectionId: s.id,
    label: s.label,
    startSec: tsToSec(s.timestampStart),
    endSec: tsToSec(s.timestampEnd),
  }));
}

function SelfVoicePage() {
  const { outputs, setStepOutput, setStepStatus, setStep } = usePipelineStore();
  const scriptOutput = outputs[2] as ScriptOutput | undefined;
  const sections = scriptOutput?.sections ?? [];

  // Upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  // Timing state — seeded from script, user editable
  const [timings, setTimings] = useState<SectionTiming[]>([]);

  const [confirmed, setConfirmed] = useState(false);

  // Seed timings when sections are available
  useEffect(() => {
    if (sections.length > 0) setTimings(buildInitialTimings(sections));
  }, [sections.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track active section based on playhead
  useEffect(() => {
    const idx = timings.findLastIndex((t) => currentTime >= t.startSec);
    if (idx >= 0) setActiveSection(idx);
  }, [currentTime, timings]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  function handleFile(file: File) {
    if (!file.type.startsWith("audio/")) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(url);
    setConfirmed(false);
    setPlaying(false);
    setCurrentTime(0);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  }

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, audioDuration));
  }, [audioDuration]);

  function handleTimingChange(index: number, field: "startSec" | "endSec", value: number) {
    setTimings((prev) => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  function handleConfirm() {
    if (!audioFile) return;
    const payload = {
      source: "self" as const,
      fileName: audioFile.name,
      uploadedAt: Date.now(),
      timings,
    };
    setStepOutput(5, payload);
    setStepStatus(5, "complete");
    setConfirmed(true);
  }

  // ── Upload screen ────────────────────────────────────────────────────────
  if (!audioFile) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne text-xl font-bold text-text-primary">Your Voice</h1>
            <p className="font-dm-mono text-xs text-text-secondary mt-1">
              Record your voiceover using the script below, then upload the file.
            </p>
          </div>

          {/* Script reference */}
          {sections.length > 0 && (
            <div className="mb-6 bg-bg-surface border border-bg-border rounded-md overflow-hidden">
              <div className="px-4 py-2.5 border-b border-bg-border">
                <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
                  Script — read this to record
                </span>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto space-y-4">
                {sections.map((s, i) => (
                  <div key={s.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-sm ${SECTION_COLOURS[i % SECTION_COLOURS.length]}`} />
                      <span className="font-dm-mono text-[10px] text-accent-primary uppercase tracking-widest">
                        {s.label}
                      </span>
                      <span className="font-dm-mono text-[10px] text-text-tertiary">
                        {s.timestampStart} – {s.timestampEnd} · {s.wordCount}w
                      </span>
                    </div>
                    <p className="font-lora text-sm text-text-primary leading-relaxed pl-4">
                      {s.script}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="mb-6 p-4 bg-bg-surface border border-bg-border rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <Mic size={13} className="text-accent-primary" />
              <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
                Recording tips
              </span>
            </div>
            <ul className="space-y-1.5">
              {[
                "Record in one continuous take — you'll trim sections below after upload",
                "Quiet room, mic 15–20cm from your mouth",
                "Export as MP3 or WAV at 44.1kHz or higher",
                "Leave a half-second pause between sections so timestamps are easy to spot",
              ].map((tip, i) => (
                <li key={i} className="font-dm-mono text-[10px] text-text-secondary flex items-start gap-2">
                  <span className="text-accent-primary shrink-0 mt-0.5">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-md p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-150
              ${dragging ? "border-accent-primary bg-accent-primary/5" : "border-bg-border hover:border-accent-primary/50 hover:bg-bg-elevated"}
            `}
          >
            <Upload size={22} className="text-text-tertiary" />
            <div className="text-center">
              <p className="font-syne text-sm font-bold text-text-primary">Drop your recording here</p>
              <p className="font-dm-mono text-[10px] text-text-tertiary mt-1">MP3, WAV, M4A — or click to browse</p>
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Editor screen (after upload) ─────────────────────────────────────────
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border shrink-0">
        <div>
          <h1 className="font-syne text-xl font-bold text-text-primary">Sync Your Voice</h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1">
            Play back your recording and adjust where each section starts and ends.
          </p>
        </div>
        <button
          onClick={() => { setAudioFile(null); setAudioUrl(null); setConfirmed(false); }}
          className="font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          Replace audio
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Audio player */}
          <div className="bg-bg-surface border border-bg-border rounded-md p-4">
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => setAudioDuration(e.currentTarget.duration)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-accent-primary flex items-center justify-center shrink-0 hover:bg-accent-hover transition-colors"
              >
                {playing ? <Pause size={15} className="text-bg-base" /> : <Play size={15} className="text-bg-base ml-0.5" />}
              </button>
              <div className="flex-1">
                <p className="font-syne text-xs font-bold text-text-primary truncate">{audioFile.name}</p>
                <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                  {audioDuration > 0 ? `${secToTs(audioDuration)} total` : "Loading…"}
                </p>
              </div>
            </div>
          </div>

          {/* Section timeline + editor */}
          {timings.length > 0 && audioDuration > 0 && (
            <div className="bg-bg-surface border border-bg-border rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
                  Section timestamps
                </span>
                <span className="font-dm-mono text-[10px] text-text-secondary">
                  Click any row to jump · edit in/out to correct
                </span>
              </div>
              <SectionTimeline
                timings={timings}
                duration={audioDuration}
                currentTime={currentTime}
                onSeek={seek}
                onTimingChange={handleTimingChange}
                activeIndex={activeSection}
              />
            </div>
          )}

          {/* Gap / overlap warnings */}
          {timings.length > 1 && (
            <div className="space-y-1.5">
              {timings.slice(0, -1).map((t, i) => {
                const next = timings[i + 1];
                const gap = next.startSec - t.endSec;
                if (Math.abs(gap) < 0.5) return null;
                return (
                  <div
                    key={t.sectionId}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-dm-mono ${
                      gap < 0
                        ? "border-accent-error/30 bg-accent-error/5 text-accent-error"
                        : "border-accent-warning/30 bg-accent-warning/5 text-accent-warning"
                    }`}
                  >
                    <span className="shrink-0">{gap < 0 ? "⚠ Overlap" : "· Gap"}</span>
                    <span className="text-text-tertiary">
                      between <strong>{t.label}</strong> and <strong>{next.label}</strong>
                    </span>
                    <span className="ml-auto shrink-0">
                      {Math.abs(gap).toFixed(1)}s {gap < 0 ? "overlap" : "gap"}
                    </span>
                    {gap > 0 && (
                      <button
                        onClick={() => handleTimingChange(i + 1, "startSec", t.endSec)}
                        className="ml-2 underline text-accent-primary hover:no-underline shrink-0"
                      >
                        Fix
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm / confirmed */}
          {!confirmed ? (
            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={timings.length === 0}
                className="px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                CONFIRM TIMESTAMPS →
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border border-accent-success/40 bg-accent-success/5 rounded-md">
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-accent-success shrink-0" />
                <div>
                  <p className="font-syne text-sm font-bold text-text-primary">Timestamps confirmed</p>
                  <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                    {timings.length} sections · {secToTs(audioDuration)} total
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmed(false)}
                  className="font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
                >
                  Adjust
                </button>
                <button
                  onClick={() => { setStep(6); window.location.href = "/create/avatar"; }}
                  className="px-5 py-2 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
                >
                  CONTINUE →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Default export ────────────────────────────────────────────────────────────

export default function AudioPage() {
  const { setStep, brief } = usePipelineStore();
  useEffect(() => { setStep(5); }, [setStep]);

  if (brief?.voiceMode === "self") {
    return <SelfVoicePage />;
  }

  return (
    <PipelineStepWaiting
      stepNumber={5}
      title="Generating Voiceover"
      description="Your script is being converted into a natural-sounding voiceover. Tone, pacing, and emotional emphasis are applied based on your brief and content structure."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      }
      subTasks={[
        { label: "Analyse script for tone and pacing cues", done: false },
        { label: "Select the best voice for your content style", done: false },
        { label: "Generate full voiceover with natural expression", done: false },
        { label: "Apply fallback voice if needed", done: false },
        { label: "Save audio for video production", done: false },
      ]}
      estimatedTime="~45 seconds"
      prerequisiteStep={4}
      prerequisiteLabel="Quality Review (Step 04)"
    />
  );
}
