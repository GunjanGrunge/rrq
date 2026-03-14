"use client";

import { useEffect, useState } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import { useDirectorNavigation } from "@/lib/hooks/use-director-navigation";
import type {
  ResearchOutput,
  ScriptOutput,
  SEOOutput,
} from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import MetadataChip from "@/components/ui/MetadataChip";

export default function SEOPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs } =
    usePipelineStore();
  const { proceedAfterSEO, isDirectorMode } = useDirectorNavigation();
  const researchOutput = outputs[1] as ResearchOutput | undefined;
  const scriptOutput = outputs[2] as ScriptOutput | undefined;
  const [seo, setSeo] = useState<SEOOutput | null>(
    (outputs[3] as SEOOutput) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(3);
  }, [setStep]);

  async function runSEO() {
    if (!researchOutput || !scriptOutput) return;
    setLoading(true);
    setError(null);
    setStepStatus(3, "running");

    try {
      const res = await fetch("/api/pipeline/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchOutput,
          scriptOutput,
          generateShorts: brief?.generateShorts ?? false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "SEO failed");

      setSeo(data.data);
      setStepOutput(3, data.data);
      setStepStatus(3, "complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStepStatus(3, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (researchOutput && scriptOutput && !seo && !loading) {
      runSEO();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchOutput, scriptOutput]);

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
          <h1 className="font-syne text-xl font-bold text-text-primary">
            SEO Metadata
          </h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1">
            Optimised for maximum impressions and CTR
          </p>
        </div>
        <StatusPill
          status={loading ? "running" : seo ? "complete" : "ready"}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-accent-error/10 border border-accent-error/30">
          <p className="font-dm-mono text-xs text-accent-error">{error}</p>
          <button
            onClick={runSEO}
            className="mt-2 font-dm-mono text-xs text-accent-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !seo && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-dm-mono text-sm text-text-secondary animate-pulse">
              Optimising SEO...
            </p>
          </div>
        </div>
      )}

      {seo && (
        <div className="space-y-6">
          {/* Final Title + Score */}
          <div className="p-4 rounded-md bg-bg-surface border border-accent-primary/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-syne text-sm font-bold text-accent-primary">
                Final Title
              </h3>
              <div className="flex items-center gap-2">
                <MetadataChip
                  label={`CTR: ${seo.expectedCTR}`}
                  variant="keyword"
                />
                <MetadataChip
                  label={`SEO: ${seo.seoStrengthScore}/10`}
                  variant="tag"
                />
              </div>
            </div>
            <p className="font-syne text-lg font-bold text-text-primary">
              {seo.finalTitle}
            </p>
          </div>

          {/* Title Variants */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-3">
              Title Variants
            </h3>
            <div className="space-y-2">
              {seo.titleVariants.map((v, i) => (
                <div
                  key={i}
                  className="p-3 rounded-md bg-bg-surface border border-bg-border"
                >
                  <p className="font-syne text-sm text-text-primary">
                    {v.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <MetadataChip label={v.formula} variant="tag" />
                    <span className="font-dm-mono text-[10px] text-text-tertiary">
                      {v.rationale}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Description */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
                Description
              </h3>
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border max-h-60 overflow-y-auto">
                <pre className="font-dm-mono text-xs text-text-secondary whitespace-pre-wrap">
                  {seo.description}
                </pre>
              </div>
            </div>

            {/* Chapters */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
                Chapters
              </h3>
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border space-y-1">
                {seo.chapters.map((ch, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-dm-mono text-[10px] text-accent-primary w-10 shrink-0">
                      {ch.timestamp}
                    </span>
                    <span className="font-dm-mono text-xs text-text-secondary">
                      {ch.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {seo.tags.map((tag) => (
                <MetadataChip key={tag} label={tag} variant="tag" />
              ))}
            </div>
          </div>

          {/* Hashtags + Category + Schedule */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-xs font-bold text-text-primary mb-2">
                Hashtags
              </h4>
              <div className="flex flex-wrap gap-1">
                {seo.hashtags.map((h) => (
                  <MetadataChip key={h} label={h} variant="keyword" />
                ))}
              </div>
            </div>
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-xs font-bold text-text-primary mb-2">
                Category
              </h4>
              <p className="font-dm-mono text-xs text-text-primary">
                {seo.category}
              </p>
              <p className="font-dm-mono text-[10px] text-text-tertiary mt-1">
                Made for kids: {seo.madeForKids ? "Yes" : "No"}
              </p>
            </div>
            <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
              <h4 className="font-syne text-xs font-bold text-text-primary mb-2">
                Scheduled Upload
              </h4>
              <p className="font-dm-mono text-xs text-text-primary">
                {new Date(seo.scheduledTime).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Thumbnail A/B */}
          <div>
            <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
              Thumbnail A/B Variants
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {seo.thumbnailABVariants.map((v, i) => (
                <div
                  key={i}
                  className="p-3 rounded-md bg-bg-surface border border-bg-border"
                >
                  <p className="font-syne text-xs font-bold text-text-primary mb-1">
                    Variant {String.fromCharCode(65 + i)}
                  </p>
                  <p className="font-dm-mono text-[10px] text-text-secondary">
                    {v.concept}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
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
              <h3 className="font-syne text-sm font-bold text-text-primary mb-3">
                Shorts SEO
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="font-dm-mono text-[10px] text-text-tertiary">
                    Title
                  </span>
                  <p className="font-dm-mono text-xs text-text-primary">
                    {seo.shortsTitle}
                  </p>
                </div>
                {seo.shortsDescription && (
                  <div>
                    <span className="font-dm-mono text-[10px] text-text-tertiary">
                      Description
                    </span>
                    <p className="font-dm-mono text-xs text-text-secondary">
                      {seo.shortsDescription}
                    </p>
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
          <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
            <h4 className="font-syne text-xs font-bold text-text-primary mb-1">
              SEO Notes
            </h4>
            <p className="font-dm-mono text-[10px] text-text-secondary">
              {seo.seoNotes}
            </p>
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
