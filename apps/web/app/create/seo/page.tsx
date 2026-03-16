"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import { useStepProgress } from "@/lib/hooks/use-step-progress";
import type {
  ResearchOutput,
  ScriptOutput,
  SEOOutput,
} from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import MetadataChip from "@/components/ui/MetadataChip";
import StepProgressCard from "@/components/pipeline/StepProgressCard";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";

const SEO_STAGES = [
  "Script and research absorbed",
  "Title variants crafted",
  "Full metadata locked by Regum",
];

export default function SEOPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs, stepStatuses, rerunStep } =
    usePipelineStore();
  const { proceedAfterSEO, isDirectorMode } = useDirectorNavigation();
  const router = useRouter();
  const researchOutput = outputs[1] as ResearchOutput | undefined;
  const scriptOutput = outputs[2] as ScriptOutput | undefined;
  const [seo, setSeo] = useState<SEOOutput | null>(
    (outputs[3] as SEOOutput) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { completedStages, statusLine, isRunning, consume, reset } = useStepProgress();

  useEffect(() => {
    setStep(3);
    setHydrated(true);
  }, [setStep]);

  async function runSEO() {
    if (!researchOutput || !scriptOutput) return;
    reset();
    setError(null);
    setStepStatus(3, "running");

    await consume<SEOOutput>(
      "/api/pipeline/seo",
      { researchOutput, scriptOutput, generateShorts: brief?.generateShorts ?? false },
      (data) => {
        setSeo(data);
        setStepOutput(3, data);
        setStepStatus(3, "complete");
      },
      (msg) => {
        setError(msg);
        setStepStatus(3, "error");
      },
    );
  }

  // Sync local state from store after Zustand rehydration
  useEffect(() => {
    if (hydrated && outputs[3] && !seo) {
      setSeo(outputs[3] as SEOOutput);
    }
  }, [hydrated, outputs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    if (researchOutput && scriptOutput && !seo && !isRunning && !["complete", "running"].includes(stepStatuses[3])) {
      runSEO();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, researchOutput, scriptOutput]);

  if (!researchOutput || !scriptOutput) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Complete the Script step first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-xl font-bold text-text-primary">SEO Metadata</h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1">
            Optimised for maximum impressions and CTR
          </p>
        </div>
        <StatusPill status={isRunning ? "running" : seo ? "complete" : "ready"} />
      </div>

      {error && (
        <div className="mb-4">
          <StepFailureCard
            stepNumber={3}
            stepLabel="SEO"
            errorMessage={error}
            showDownstreamWarning
            downstreamCount={STEP_DOWNSTREAM[3].length}
            onRerunStep={() => { rerunStep(3); router.push("/create/seo"); }}
            onRerunFromHere={() => { rerunStep(3); router.push("/create/seo"); }}
          />
        </div>
      )}

      {isRunning && !seo && (
        <StepProgressCard
          stages={SEO_STAGES}
          completedStages={completedStages}
          statusLine={statusLine}
        />
      )}

      {seo && (
        <div className="space-y-6">
          {/* Final Title + Score */}
          <div className="p-4 rounded-md bg-bg-surface border border-accent-primary/30">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="font-syne text-sm font-bold text-accent-primary">Final Title</h3>
              <div className="flex items-center gap-2">
                <MetadataChip label={`CTR: ${seo.expectedCTR}`} variant="keyword" />
                <MetadataChip label={`SEO: ${seo.seoStrengthScore}/10`} variant="tag" />
              </div>
            </div>
            <p className="font-syne text-lg font-bold text-text-primary break-words">{seo.finalTitle}</p>
          </div>

          {/* Title Variants */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Title Variants</h3>
            <div className="space-y-2">
              {seo.titleVariants.map((v, i) => (
                <div key={i} className="p-3 rounded-md bg-bg-surface border border-bg-border">
                  <p className="font-syne text-sm text-text-primary break-words">{v.title}</p>
                  <div className="flex items-start gap-2 mt-2 flex-wrap">
                    <MetadataChip label={v.formula} variant="tag" />
                    <span className="font-dm-mono text-xs text-text-secondary leading-relaxed break-words">{v.rationale}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Description */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">Description</h3>
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border max-h-60 overflow-y-auto">
                <pre className="font-dm-mono text-xs text-text-secondary whitespace-pre-wrap break-words">
                  {seo.description}
                </pre>
              </div>
            </div>

            {/* Chapters */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">Chapters</h3>
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border space-y-1.5">
                {seo.chapters.map((ch, i) => (
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

          {/* Tags */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {seo.tags.map((tag) => (
                <MetadataChip key={tag} label={tag} variant="tag" />
              ))}
            </div>
          </div>

          {/* Hashtags + Category + Schedule */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-2">Hashtags</h4>
              <div className="flex flex-wrap gap-1">
                {seo.hashtags.map((h) => (
                  <MetadataChip key={h} label={h} variant="keyword" />
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-2">Category</h4>
              <p className="font-dm-mono text-sm text-text-primary">{seo.category}</p>
              <p className="font-dm-mono text-xs text-text-secondary mt-1.5">
                Made for kids: {seo.madeForKids ? "Yes" : "No"}
              </p>
            </div>
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-sm font-bold text-text-primary mb-2">Scheduled Upload</h4>
              <p className="font-dm-mono text-sm text-text-primary break-words">
                {new Date(seo.scheduledTime).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Thumbnail A/B */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-2">Thumbnail A/B Variants</h3>
            <div className="grid grid-cols-2 gap-3">
              {seo.thumbnailABVariants.map((v, i) => (
                <div key={i} className="p-3 rounded-md bg-bg-surface border border-bg-border">
                  <p className="font-syne text-xs font-bold text-text-primary mb-2">
                    Variant {String.fromCharCode(65 + i)}
                  </p>
                  <p className="font-dm-mono text-xs text-text-secondary leading-relaxed break-words mb-2">{v.concept}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <MetadataChip label={v.emotion} variant="tag" />
                    <MetadataChip label={v.textOverlay} variant="keyword" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shorts SEO */}
          {seo.shortsTitle && (
            <div className="p-4 rounded-md bg-bg-surface border border-bg-border">
              <h3 className="font-syne text-sm font-bold text-text-primary mb-3">Shorts SEO</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-dm-mono text-xs text-text-secondary uppercase tracking-wide mb-1">Title</p>
                  <p className="font-dm-mono text-sm text-text-primary break-words">{seo.shortsTitle}</p>
                </div>
                {seo.shortsDescription && (
                  <div>
                    <p className="font-dm-mono text-xs text-text-secondary uppercase tracking-wide mb-1">Description</p>
                    <p className="font-dm-mono text-xs text-text-secondary leading-relaxed break-words">{seo.shortsDescription}</p>
                  </div>
                )}
                {seo.shortsHashtags && (
                  <div className="flex flex-wrap gap-1">
                    {seo.shortsHashtags.map((h) => (
                      <MetadataChip key={h} label={h} variant="tag" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEO Notes */}
          <div className="p-4 rounded-md bg-bg-surface border border-bg-border">
            <h4 className="font-syne text-sm font-bold text-text-primary mb-2">SEO Notes</h4>
            <p className="font-dm-mono text-sm text-text-secondary leading-relaxed break-words">{seo.seoNotes}</p>
          </div>
        </div>
      )}

      {/* Next step */}
      {seo && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => {
              setStep(isDirectorMode ? 3 : 4);
              proceedAfterSEO();
            }}
            className="px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
          >
            {isDirectorMode ? "REVIEW METADATA →" : "RUN QUALITY GATE →"}
          </button>
        </div>
      )}
    </div>
  );
}
