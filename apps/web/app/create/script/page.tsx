"use client";

import { useEffect, useState } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import { useStepProgress } from "@/lib/hooks/use-step-progress";
import type {
  ResearchOutput,
  ScriptOutput,
  ScriptSection,
  DisplayMode,
} from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import StepProgressCard from "@/components/pipeline/StepProgressCard";

const SCRIPT_STAGES = [
  "Research reviewed + freshness checked",
  "Story arc and structure mapped",
  "Full script written by MUSE",
];

const SECTION_COLORS: Record<string, string> = {
  hook: "border-l-amber-500",
  intro: "border-l-blue-500",
  body: "border-l-neutral-600",
  comparison: "border-l-purple-500",
  cta: "border-l-green-500",
};

function getSectionColor(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("hook")) return SECTION_COLORS.hook;
  if (lower.includes("intro") || lower.includes("credibility"))
    return SECTION_COLORS.intro;
  if (lower.includes("cta") || lower.includes("call to action"))
    return SECTION_COLORS.cta;
  if (lower.includes("comparison") || lower.includes("pros"))
    return SECTION_COLORS.comparison;
  return SECTION_COLORS.body;
}

const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  "avatar-fullscreen": "Avatar",
  "broll-with-corner-avatar": "B-Roll + Avatar",
  "broll-only": "B-Roll",
  "visual-asset": "Visual Asset",
};

export default function ScriptPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs, stepStatuses } =
    usePipelineStore();
  const { proceedAfterScript, isDirectorMode } = useDirectorNavigation();
  const researchOutput = outputs[1] as ResearchOutput | undefined;
  const [script, setScript] = useState<ScriptOutput | null>(
    (outputs[2] as ScriptOutput) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { completedStages, statusLine, isRunning, consume, reset } = useStepProgress();

  useEffect(() => {
    setStep(2);
    setHydrated(true);
  }, [setStep]);

  async function runScript() {
    if (!brief || !researchOutput) return;
    reset();
    setError(null);
    setStepStatus(2, "running");

    await consume<ScriptOutput>(
      "/api/pipeline/script",
      { researchOutput, duration: brief.duration, tone: brief.tone, generateShorts: brief.generateShorts, shortsType: brief.shortsType },
      (data) => {
        setScript(data);
        setStepOutput(2, data);
        setStepStatus(2, "complete");
      },
      (msg) => {
        setError(msg);
        setStepStatus(2, "error");
      },
    );
  }

  // Sync local state from store after Zustand rehydration
  useEffect(() => {
    if (hydrated && outputs[2] && !script) {
      setScript(outputs[2] as ScriptOutput);
    }
  }, [hydrated, outputs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    if (researchOutput && !script && !isRunning && stepStatuses[2] !== "complete") {
      runScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, researchOutput]);

  function updateSectionScript(index: number, newText: string) {
    if (!script) return;
    const updated = { ...script, sections: [...script.sections] };
    updated.sections[index] = { ...updated.sections[index], script: newText };
    setScript(updated);
    setStepOutput(2, updated);
  }

  function updateTitle(newTitle: string) {
    if (!script) return;
    const updated = { ...script, title: newTitle };
    setScript(updated);
    setStepOutput(2, updated);
  }

  if (!researchOutput) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Complete the Research step first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
        <div className="flex-1 min-w-0 mr-4">
          <h1 className="font-syne text-xl font-bold text-text-primary">Script</h1>
          {script && editMode ? (
            <input
              value={script.title}
              onChange={(e) => updateTitle(e.target.value)}
              className="mt-1 w-full bg-bg-elevated border border-accent-primary text-text-primary font-dm-mono text-sm px-2 py-1 focus:outline-none"
              placeholder="Video title…"
            />
          ) : (
            <p className="font-dm-mono text-xs text-text-secondary mt-1 truncate">
              {script?.title ?? brief?.topic}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {script && (
            <button
              onClick={() => setEditMode(!editMode)}
              className="font-dm-mono text-xs text-accent-primary hover:underline"
            >
              {editMode ? "Done Editing" : "Edit Script"}
            </button>
          )}
          <StatusPill
            status={isRunning ? "running" : script ? "complete" : "ready"}
          />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 rounded-md bg-accent-error/10 border border-accent-error/30">
          <p className="font-dm-mono text-sm text-accent-error">{error}</p>
          <button
            onClick={runScript}
            className="mt-2 font-dm-mono text-xs text-accent-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {isRunning && !script && (
        <StepProgressCard
          stages={SCRIPT_STAGES}
          completedStages={completedStages}
          statusLine={statusLine}
        />
      )}

      {script && (
        <div className="flex-1 overflow-hidden flex">
          {/* Left — Section Navigator (25%) */}
          <div className="w-1/4 border-r border-bg-border overflow-y-auto py-3">
            {script.sections.map((section: ScriptSection, i: number) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors ${
                  activeSection === i
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
                }`}
              >
                <div
                  className={`w-1 h-6 rounded-full flex-shrink-0 ${getSectionColor(section.label)}`}
                />
                <div className="min-w-0">
                  <p className="font-syne text-xs font-bold truncate">
                    {section.label}
                  </p>
                  <p className="font-dm-mono text-xs text-text-secondary mt-0.5">
                    {section.timestampStart} — {section.wordCount}w
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Centre — Script Body (50%) */}
          <div className="w-1/2 overflow-y-auto px-6 py-4">
            {script.sections.map((section: ScriptSection, i: number) => (
              <div
                key={section.id}
                id={`section-${i}`}
                className={`mb-6 pl-4 border-l-2 ${getSectionColor(section.label)} ${
                  activeSection === i ? "opacity-100" : "opacity-60"
                } transition-opacity`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-syne text-sm font-bold text-text-primary">
                    {section.label}
                  </h3>
                  <span className="font-dm-mono text-xs text-text-secondary flex-shrink-0 ml-2">
                    {section.timestampStart} – {section.timestampEnd}
                  </span>
                </div>

                {editMode ? (
                  <textarea
                    value={section.script}
                    onChange={(e) => updateSectionScript(i, e.target.value)}
                    className="w-full bg-bg-elevated border border-bg-border rounded-md p-3 font-lora text-sm text-text-primary leading-relaxed resize-none min-h-[120px] focus:border-accent-primary focus:outline-none"
                    rows={Math.max(4, section.script.split("\n").length)}
                  />
                ) : (
                  <p className="font-lora text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                    {section.script}
                  </p>
                )}

                <p className="font-dm-mono text-xs text-text-secondary mt-2 italic break-words">
                  Visual: {section.visualNote}
                </p>
              </div>
            ))}
          </div>

          {/* Right — Metadata (25%) */}
          <div className="w-1/4 border-l border-bg-border overflow-y-auto py-4 px-4 space-y-4">
            {/* Stats */}
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-3">Stats</h4>
              <div className="space-y-2">
                <Stat label="Duration" value={`${script.duration} min`} />
                <Stat label="Words" value={String(script.totalWordCount)} />
                <Stat label="Sections" value={String(script.sections.length)} />
              </div>
            </div>

            {/* Voice Config */}
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-3">Voice Config</h4>
              <div className="space-y-2">
                <div>
                  <p className="font-dm-mono text-xs text-text-secondary uppercase tracking-wide">Gender</p>
                  <p className="font-dm-mono text-sm text-text-primary capitalize mt-0.5">
                    {script.voiceConfig.gender}
                  </p>
                </div>
                <div>
                  <p className="font-dm-mono text-xs text-text-secondary uppercase tracking-wide">Style</p>
                  <p className="font-dm-mono text-sm text-text-primary capitalize mt-0.5">
                    {script.voiceConfig.style}
                  </p>
                </div>
                <div>
                  <p className="font-dm-mono text-xs text-text-secondary uppercase tracking-wide">Reasoning</p>
                  <p className="font-dm-mono text-xs text-text-secondary mt-0.5 leading-relaxed break-words">
                    {script.voiceConfig.reasoning}
                  </p>
                </div>
              </div>
            </div>

            {/* Active section visual mode */}
            {script.sections[activeSection] && (
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
                <h4 className="font-syne text-sm font-bold text-text-primary mb-2">Display Mode</h4>
                <p className="font-dm-mono text-sm text-accent-primary">
                  {DISPLAY_MODE_LABELS[script.sections[activeSection].displayMode]}
                </p>
                <p className="font-dm-mono text-xs text-text-secondary mt-1.5 leading-relaxed break-words">
                  {script.sections[activeSection].toneNote}
                </p>
              </div>
            )}

            {/* Chapters */}
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-3">Chapters</h4>
              <div className="space-y-1.5">
                {script.chapters.map((ch, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="font-dm-mono text-xs text-accent-primary w-10 flex-shrink-0 mt-px">
                      {ch.timestamp}
                    </span>
                    <span className="font-dm-mono text-xs text-text-secondary break-words min-w-0">
                      {ch.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next step */}
      {script && (
        <div className="px-6 py-4 border-t border-bg-border flex justify-end">
          <button
            onClick={() => {
              setStep(isDirectorMode ? 2 : 3);
              proceedAfterScript();
            }}
            className="px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
          >
            {isDirectorMode ? "REVIEW SCRIPT →" : "PROCEED TO SEO →"}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-dm-mono text-xs text-text-secondary">{label}</span>
      <span className="font-dm-mono text-sm text-text-primary font-semibold">{value}</span>
    </div>
  );
}
