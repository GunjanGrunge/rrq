"use client";

import { useEffect, useState } from "react";
import { usePipelineStore } from "@/lib/pipeline-store";
import type { ResearchOutput, SEOTitle, KeyFact } from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import MetadataChip from "@/components/ui/MetadataChip";

export default function ResearchPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs } =
    usePipelineStore();
  const [research, setResearch] = useState<ResearchOutput | null>(
    (outputs[1] as ResearchOutput) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<number>(0);
  const [visibleCards, setVisibleCards] = useState(0);

  useEffect(() => {
    setStep(1);
  }, [setStep]);

  // Stagger animation for cards
  useEffect(() => {
    if (!research) return;
    const totalCards =
      1 + // summary
      1 + // hook
      research.keyFacts.length +
      research.seoTitles.length;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setVisibleCards(i);
      if (i >= totalCards) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [research]);

  async function runResearch() {
    if (!brief) return;
    setLoading(true);
    setError(null);
    setStepStatus(1, "running");

    try {
      const res = await fetch("/api/pipeline/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: brief.topic,
          duration: brief.duration,
          tone: brief.tone,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Research failed");

      setResearch(data.data);
      setStepOutput(1, data.data);
      setStepStatus(1, "complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStepStatus(1, "error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run if brief exists and no output yet
  useEffect(() => {
    if (brief && !research && !loading) {
      runResearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

  if (!brief) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Enter a topic in the Creative Brief first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-xl font-bold text-text-primary">
            Research
          </h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1">
            {brief.topic}
          </p>
        </div>
        <StatusPill status={loading ? "running" : research ? "complete" : "ready"} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-accent-error/10 border border-accent-error/30">
          <p className="font-dm-mono text-xs text-accent-error">{error}</p>
          <button
            onClick={runResearch}
            className="mt-2 font-dm-mono text-xs text-accent-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !research && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-dm-mono text-sm text-text-secondary animate-pulse">
              Researching...
            </p>
          </div>
        </div>
      )}

      {research && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left column (40%) */}
          <div className="col-span-2 space-y-4">
            {/* Summary */}
            <Card visible={visibleCards >= 1}>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
                Summary
              </h3>
              <p className="font-dm-mono text-xs text-text-secondary leading-relaxed">
                {research.summary}
              </p>
            </Card>

            {/* Hook */}
            <Card visible={visibleCards >= 2} glow>
              <h3 className="font-syne text-sm font-bold text-accent-primary mb-2">
                Hook
              </h3>
              <p className="font-lora text-sm text-text-primary leading-relaxed italic">
                &ldquo;{research.hook}&rdquo;
              </p>
            </Card>

            {/* Key Facts */}
            <div className="space-y-2">
              <h3 className="font-syne text-sm font-bold text-text-primary">
                Key Facts
              </h3>
              {research.keyFacts.map((fact: KeyFact, i: number) => (
                <Card key={i} visible={visibleCards >= 3 + i}>
                  <p className="font-dm-mono text-xs text-text-primary">
                    {fact.fact}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-dm-mono text-[10px] text-text-tertiary">
                      {fact.source}
                    </span>
                    <MetadataChip
                      label={fact.recency}
                      variant={fact.recency === "recent" ? "tag" : "category"}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right column (60%) */}
          <div className="col-span-3 space-y-4">
            {/* Pros / Cons */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-syne text-sm font-bold text-accent-success mb-2">
                  Pros
                </h3>
                <div className="space-y-2">
                  {research.pros.map((p, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-accent-success/5 border border-accent-success/20"
                    >
                      <p className="font-dm-mono text-xs text-text-primary">
                        {p.point}
                      </p>
                      <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                        {p.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-syne text-sm font-bold text-accent-error mb-2">
                  Cons
                </h3>
                <div className="space-y-2">
                  {research.cons.map((c, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-accent-error/5 border border-accent-error/20"
                    >
                      <p className="font-dm-mono text-xs text-text-primary">
                        {c.point}
                      </p>
                      <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                        {c.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
                Keywords
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {research.keywords.primary.map((k) => (
                  <MetadataChip key={k} label={k} variant="keyword" />
                ))}
                {research.keywords.secondary.map((k) => (
                  <MetadataChip key={k} label={k} variant="tag" />
                ))}
                {research.keywords.longTail.map((k) => (
                  <MetadataChip key={k} label={k} variant="category" />
                ))}
              </div>
            </div>

            {/* SEO Titles — selectable */}
            <div>
              <h3 className="font-syne text-sm font-bold text-text-primary mb-2">
                SEO Title Options
              </h3>
              <div className="space-y-2">
                {research.seoTitles.map((t: SEOTitle, i: number) => {
                  const cardIndex =
                    3 + research.keyFacts.length + i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedTitle(i)}
                      className={`w-full text-left p-3 rounded-md border transition-all duration-200 ${
                        selectedTitle === i
                          ? "border-accent-primary bg-accent-primary/5"
                          : "border-bg-border bg-bg-surface hover:border-bg-border/80"
                      } ${visibleCards >= cardIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
                      style={{
                        transition:
                          "opacity 200ms ease-out, transform 200ms ease-out, border-color 200ms, background 200ms",
                      }}
                    >
                      <p className="font-syne text-sm text-text-primary">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <MetadataChip label={t.formula} variant="tag" />
                        <MetadataChip
                          label={`CTR: ${t.estimatedCTR}`}
                          variant={
                            t.estimatedCTR === "high" ? "keyword" : "category"
                          }
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Viral Potential */}
            {research.viralPotential && (
              <div className="p-3 rounded-md bg-bg-surface border border-bg-border">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-syne text-sm font-bold text-text-primary">
                    Viral Potential
                  </h3>
                  <MetadataChip
                    label={research.viralPotential.score}
                    variant={
                      research.viralPotential.score === "HIGH"
                        ? "keyword"
                        : "tag"
                    }
                  />
                </div>
                <p className="font-dm-mono text-xs text-text-secondary">
                  {research.viralPotential.reasoning}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next step button */}
      {research && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => {
              setStep(2);
              window.location.href = "/create/script";
            }}
            className="px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors"
          >
            PROCEED TO SCRIPT →
          </button>
        </div>
      )}
    </div>
  );
}

function Card({
  children,
  visible,
  glow,
}: {
  children: React.ReactNode;
  visible: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-md border transition-all duration-200 ${
        glow
          ? "border-accent-primary/40 bg-accent-primary/5"
          : "border-bg-border bg-bg-surface"
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
