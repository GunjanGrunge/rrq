"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";
import ApprovalGate from "@/components/pipeline/ApprovalGate";
import type { ScriptOutput, ScriptSection } from "@/lib/types/pipeline";

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
  if (lower.includes("intro") || lower.includes("credibility")) return SECTION_COLORS.intro;
  if (lower.includes("cta") || lower.includes("call to action")) return SECTION_COLORS.cta;
  if (lower.includes("comparison") || lower.includes("pros")) return SECTION_COLORS.comparison;
  return SECTION_COLORS.body;
}

export default function ApproveScriptPage() {
  const router = useRouter();
  const { outputs, approveGate, approvalGates } = usePipelineStore();
  const script = outputs[2] as ScriptOutput | undefined;
  const gate = approvalGates["gate-script"];

  const [editedScript, setEditedScript] = useState<ScriptOutput | null>(script ?? null);
  const [editMode, setEditMode] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (script && !editedScript) {
      setEditedScript(script);
    }
  }, [script, editedScript]);

  if (!script) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Complete the Script step first.
        </p>
      </div>
    );
  }

  function updateSection(index: number, newText: string) {
    if (!editedScript) return;
    const updated = { ...editedScript, sections: [...editedScript.sections] };
    updated.sections[index] = { ...updated.sections[index], script: newText };
    setEditedScript(updated);
  }

  async function handleApprove() {
    setIsApproving(true);
    approveGate("gate-script", { editedScript });
    router.push("/create/seo");
  }

  async function handleRegenerate(notes: string) {
    // Phase 5 — live regen via API
    console.log("Regenerate with notes:", notes);
  }

  const isApproved = gate.status === "approved";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <ApprovalGate
        gateId="gate-script"
        badge="Director Gate 1 / 4"
        title="Your Script is Ready"
        subtitle="Review, edit inline, then approve to move to metadata."
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        }
        isApproving={isApproving}
        isApproved={isApproved}
        onApprove={handleApprove}
        onRegenerate={handleRegenerate}
        approveLabel="Approve Script & Start SEO"
      >
        <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
          {/* Left — stats + sections (35%) */}
          <div className="w-[35%] border-r border-bg-border overflow-y-auto p-4 space-y-4">
            {/* Stats */}
            <div className="bg-bg-surface border border-bg-border p-4">
              <h4 className="font-syne text-xs font-bold text-text-primary mb-3">Script Overview</h4>
              <div className="space-y-1.5">
                {[
                  { label: "Duration", value: `${script.duration} min` },
                  { label: "Words", value: String(script.totalWordCount) },
                  { label: "Sections", value: String(script.sections.length) },
                  { label: "Voice", value: `${script.voiceConfig.gender} · ${script.voiceConfig.style}` },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="font-dm-mono text-[10px] text-text-tertiary">{s.label}</span>
                    <span className="font-dm-mono text-xs text-text-primary capitalize">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section nav */}
            <div className="bg-bg-surface border border-bg-border">
              <div className="px-4 py-2 border-b border-bg-border">
                <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">Sections</span>
              </div>
              {script.sections.map((section: ScriptSection, i: number) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(i)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors border-b border-bg-border last:border-0 ${
                    activeSection === i ? "bg-bg-elevated text-text-primary" : "text-text-secondary hover:bg-bg-elevated"
                  }`}
                >
                  <div className={`w-1 h-5 rounded-full ${getSectionColor(section.label)} shrink-0`} />
                  <div className="min-w-0">
                    <p className="font-syne text-xs font-bold truncate">{section.label}</p>
                    <p className="font-dm-mono text-[10px] text-text-tertiary">{section.wordCount}w</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right — script body (65%) */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-syne font-bold text-base text-text-primary">{script.title}</h2>
              <button
                onClick={() => setEditMode(!editMode)}
                className="font-dm-mono text-xs text-accent-primary hover:underline"
              >
                {editMode ? "Done Editing" : "Edit Script"}
              </button>
            </div>

            <div className="space-y-6">
              {(editedScript?.sections ?? script.sections).map((section: ScriptSection, i: number) => (
                <div
                  key={section.id}
                  className={`pl-4 border-l-2 ${getSectionColor(section.label)} ${
                    activeSection === i ? "opacity-100" : "opacity-60"
                  } transition-opacity cursor-pointer`}
                  onClick={() => setActiveSection(i)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-syne text-sm font-bold text-text-primary">{section.label}</h3>
                    <span className="font-dm-mono text-[10px] text-text-tertiary">
                      {section.timestampStart} – {section.timestampEnd}
                    </span>
                  </div>

                  {editMode && activeSection === i ? (
                    <textarea
                      value={section.script}
                      onChange={(e) => updateSection(i, e.target.value)}
                      className="w-full bg-bg-elevated border border-bg-border p-3 font-lora text-sm text-text-primary leading-relaxed resize-none min-h-[120px] focus:border-accent-primary focus:outline-none"
                      rows={Math.max(4, section.script.split("\n").length)}
                    />
                  ) : (
                    <p className="font-lora text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                      {section.script}
                    </p>
                  )}

                  <p className="font-dm-mono text-[10px] text-text-tertiary mt-2 italic">
                    Visual: {section.visualNote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ApprovalGate>
    </div>
  );
}
