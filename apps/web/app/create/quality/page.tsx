"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { useStepProgress } from "@/lib/hooks/use-step-progress";
import type {
  ResearchOutput,
  ScriptOutput,
  SEOOutput,
  QualityGateOutput,
} from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import StepProgressCard from "@/components/pipeline/StepProgressCard";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";

const QUALITY_STAGES = [
  "Content read + facts verified live",
  "All 7 dimensions scored",
  "Verdict written by Vera",
  "Final recommendation locked",
];

const DIMENSION_LABELS: Record<string, string> = {
  hookStrength: "Hook Strength",
  retentionStructure: "Retention Structure",
  titleCTR: "Title CTR",
  keywordCoverage: "Keyword Coverage",
  competitorDiff: "Competitor Gap",
  museBlueprintAdherence: "Blueprint Adherence",
  uniquenessScore: "Uniqueness Score",
};

export default function QualityPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs, stepStatuses, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const researchOutput = outputs[1] as ResearchOutput | undefined;
  const scriptOutput = outputs[2] as ScriptOutput | undefined;
  const seoOutput = outputs[3] as SEOOutput | undefined;
  const [quality, setQuality] = useState<QualityGateOutput | null>(
    (outputs[4] as QualityGateOutput) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const { completedStages, statusLine, isRunning, consume, reset } = useStepProgress();
  const [animatedScores, setAnimatedScores] = useState<Record<string, number>>({});
  const [visibleRows, setVisibleRows] = useState(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    setStep(4);
    setHydrated(true);
  }, [setStep]);

  async function runQuality(currentAttempt: number) {
    if (!researchOutput || !scriptOutput || !seoOutput) return;
    reset();
    setError(null);
    setStepStatus(4, "running");

    await consume<QualityGateOutput>(
      "/api/pipeline/quality",
      { researchOutput, scriptOutput, seoOutput, attempt: currentAttempt, qualityThreshold: brief?.qualityThreshold ?? 7 },
      (data) => {
        setQuality(data);
        setStepOutput(4, data);
        setStepStatus(4, data.recommendation === "PROCEED" ? "complete" : "error");
        animateScores(data);
      },
      (msg) => {
        setError(msg);
        setStepStatus(4, "error");
      },
    );
  }

  function animateScores(result: QualityGateOutput) {
    const dimensions = Object.keys(result.scores);
    let row = 0;
    const rowInterval = setInterval(() => {
      row++;
      setVisibleRows(row);
      if (row >= dimensions.length) clearInterval(rowInterval);
    }, 80);

    const startTime = Date.now();
    const duration = 800;
    const targets = result.scores;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const current: Record<string, number> = {};
      for (const [key, value] of Object.entries(targets)) {
        current[key] = Number((value * eased).toFixed(1));
      }
      setAnimatedScores(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    }
    animationRef.current = requestAnimationFrame(tick);
  }

  // Sync local state from store after Zustand rehydration
  useEffect(() => {
    if (hydrated && outputs[4] && !quality) {
      const stored = outputs[4] as QualityGateOutput;
      setQuality(stored);
      animateScores(stored);
    }
  }, [hydrated, outputs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    if (researchOutput && scriptOutput && seoOutput && !quality && !isRunning && !["complete", "running"].includes(stepStatuses[4])) {
      runQuality(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, researchOutput, scriptOutput, seoOutput]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  if (!researchOutput || !scriptOutput || !seoOutput) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Complete the SEO step first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-xl font-bold text-text-primary">Quality Gate</h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1">
            Attempt {attempt} of 2 — Threshold: {brief?.qualityThreshold ?? 7}/10
          </p>
        </div>
        <StatusPill status={isRunning ? "running" : quality ? "complete" : "ready"} />
      </div>

      {error && (
        <div className="mb-4">
          <StepFailureCard
            stepNumber={4}
            stepLabel="Quality Gate"
            errorMessage={error}
            showDownstreamWarning
            downstreamCount={STEP_DOWNSTREAM[4].length}
            onRerunStep={() => { rerunStep(4); router.push("/create/quality"); }}
            onRerunFromHere={() => { rerunStep(4); router.push("/create/quality"); }}
          />
        </div>
      )}

      {isRunning && !quality && (
        <StepProgressCard
          stages={QUALITY_STAGES}
          completedStages={completedStages}
          statusLine={statusLine}
        />
      )}

      {quality && (
        <div className="max-w-2xl mx-auto">
          {/* Result header */}
          <div
            className={`p-6 rounded-t-lg border ${
              quality.recommendation === "PROCEED"
                ? "border-accent-success/30 bg-accent-success/5"
                : quality.recommendation === "REWRITE"
                  ? "border-accent-warning/30 bg-accent-warning/5"
                  : "border-accent-error/30 bg-accent-error/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {quality.recommendation === "PROCEED"
                  ? "✓"
                  : quality.recommendation === "REWRITE"
                    ? "⚠"
                    : "✗"}
              </span>
              <div>
                <h2 className="font-syne text-lg font-bold text-text-primary">
                  {quality.recommendation === "PROCEED"
                    ? "Quality Gate Passed"
                    : quality.recommendation === "REWRITE"
                      ? "Rewriting Weak Sections..."
                      : quality.uniquenessAutoReject
                        ? "Uniqueness Threshold Not Met"
                        : "Quality Standard Not Met"}
                </h2>
                {quality.recommendation !== "PROCEED" && (
                  <p className="font-dm-mono text-sm text-text-secondary mt-1">
                    {quality.uniquenessAutoReject
                      ? "This video is too similar to existing content."
                      : `Best score: ${quality.overall.toFixed(1)} / Your threshold: ${brief?.qualityThreshold ?? 7}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Score rows */}
          <div className="border-x border-bg-border">
            {Object.entries(quality.scores).map(([key, value], i) => {
              const isWeak = quality.weakSections.includes(key);
              const animated = animatedScores[key] ?? 0;
              return (
                <div
                  key={key}
                  className={`flex items-start justify-between px-6 py-4 border-b border-bg-border transition-all duration-200 gap-4 ${
                    visibleRows > i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-syne text-sm text-text-primary">
                      {DIMENSION_LABELS[key] ?? key}
                    </span>
                    {quality.feedback[key] && (
                      <p className="font-dm-mono text-xs text-text-secondary mt-1 leading-relaxed break-words">
                        {quality.feedback[key]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-800 ${
                          isWeak ? "bg-accent-error" : "bg-accent-success"
                        }`}
                        style={{ width: `${(animated / 10) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`font-dm-mono text-sm w-12 text-right ${
                        isWeak ? "text-accent-error" : "text-text-primary"
                      }`}
                    >
                      {animated.toFixed(1)}
                    </span>
                    <span className="text-sm w-4">
                      {isWeak ? "⚠" : "✅"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall */}
          <div className="px-6 py-4 border border-bg-border rounded-b-lg bg-bg-surface">
            <div className="flex items-center justify-between">
              <span className="font-syne text-lg font-bold text-text-primary">OVERALL</span>
              <span className="font-syne text-2xl font-bold text-accent-primary">
                {quality.overall.toFixed(1)}{" "}
                <span className="text-sm text-text-secondary">/ 10</span>
              </span>
            </div>
            <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-accent-primary rounded-full transition-all duration-800"
                style={{ width: `${(quality.overall / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex justify-center gap-4">
            {quality.recommendation === "PROCEED" && (
              <button
                onClick={() => {
                  setStep(5);
                  window.location.href = "/create/audio";
                }}
                className="px-8 py-3 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
              >
                PROCEED TO AUDIO →
              </button>
            )}

            {quality.recommendation === "REWRITE" && (
              <p className="font-dm-mono text-sm text-accent-warning animate-pulse">
                Auto-rewriting weak sections... (attempt 2)
              </p>
            )}

            {quality.recommendation === "REJECT" && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep(1);
                    window.location.href = "/create";
                  }}
                  className="px-6 py-2.5 border border-accent-primary text-accent-primary font-syne font-bold text-sm rounded-md hover:bg-accent-primary/10 transition-colors"
                >
                  TRY DIFFERENT ANGLE
                </button>
                <button
                  onClick={() => {
                    setAttempt(1);
                    runQuality(1);
                  }}
                  className="px-6 py-2.5 border border-bg-border text-text-secondary font-syne font-bold text-sm rounded-md hover:bg-bg-elevated transition-colors"
                >
                  LOWER THRESHOLD
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
