"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { useStepProgress } from "@/lib/hooks/use-step-progress";
import type { ResearchOutput, SEOTitle, KeyFact } from "@/lib/types/pipeline";
import StatusPill from "@/components/ui/StatusPill";
import MetadataChip from "@/components/ui/MetadataChip";
import StepProgressCard from "@/components/pipeline/StepProgressCard";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";

const RESEARCH_STAGES = [
  "Web search + Reddit + News fetched",
  "Pages crawled and content extracted",
  "Research brief synthesised by Rex",
];

type Panel = "overview" | "keywords" | "data";
const PANEL_ORDER: Panel[] = ["overview", "keywords", "data"];
const PANEL_LABELS: Record<Panel, string> = {
  overview: "Key Facts",
  keywords: "Keywords",
  data: "Viral + Audience",
};
const PANEL_COLORS: Record<Panel, { active: string; idle: string; label: string; idleLabel: string; arrow: string }> = {
  overview: {
    active: "border-accent-primary/60 bg-accent-primary/8",
    idle: "border-accent-primary/25 bg-accent-primary/3",
    label: "text-accent-primary",
    idleLabel: "text-accent-primary",
    arrow: "text-accent-primary",
  },
  keywords: {
    active: "border-accent-info/60 bg-accent-info/8",
    idle: "border-accent-info/25 bg-accent-info/3",
    label: "text-accent-info",
    idleLabel: "text-accent-info",
    arrow: "text-accent-info",
  },
  data: {
    active: "border-purple-500/60 bg-purple-500/8",
    idle: "border-purple-500/25 bg-purple-500/3",
    label: "text-purple-400",
    idleLabel: "text-purple-400",
    arrow: "text-purple-400",
  },
};

function getPanelTeaser(panel: Panel, r: ResearchOutput): string {
  if (panel === "overview")
    return `${r.keyFacts.length} facts · ${r.pros.length} pros · ${r.cons.length} cons`;
  if (panel === "keywords")
    return `${r.keywords.primary.length + r.keywords.secondary.length + r.keywords.longTail.length} keywords`;
  return `${r.viralPotential?.score ?? "—"} viral · ${r.competitorGap ? "gap found" : "no gap"}`;
}

type TitleValidation = {
  rexScore: number;
  verdict: "BETTER" | "ON_PAR" | "WEAKER";
  reasoning: string;
};

function getBestTitleIndex(titles: SEOTitle[]): number {
  if (titles.length === 0) return 0;
  const hasScores = titles.some((t) => t.rexScore !== undefined);
  if (hasScores) {
    return titles.reduce(
      (best, _, i, arr) =>
        (arr[i].rexScore ?? 0) > (arr[best].rexScore ?? 0) ? i : best,
      0
    );
  }
  const highIdx = titles.findIndex((t) => t.estimatedCTR === "high");
  return highIdx >= 0 ? highIdx : 0;
}

export default function ResearchPage() {
  const { brief, setStep, setStepStatus, setStepOutput, outputs, stepStatuses, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const storedResearch = outputs[1] as ResearchOutput | undefined;
  const [research, setResearch] = useState<ResearchOutput | null>(
    storedResearch ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<number>(-1);
  const [customTitle, setCustomTitle] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [titleLocked, setTitleLocked] = useState(!!storedResearch);
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [isSliding, setIsSliding] = useState(false);
  const [customValidation, setCustomValidation] = useState<TitleValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  // Track whether Zustand has finished rehydrating from localStorage
  const [hydrated, setHydrated] = useState(false);
  const { completedStages, statusLine, isRunning, consume, reset } = useStepProgress();

  useEffect(() => {
    setStep(1);
    // Mark as hydrated after first render — Zustand persist rehydrates synchronously
    // via onRehydrateStorage, so by the time this effect runs the store is ready
    setHydrated(true);
  }, [setStep]);

  // Sync local state after Zustand rehydrates from localStorage
  useEffect(() => {
    if (hydrated && storedResearch && !research) {
      setResearch(storedResearch);
      setTitleLocked(true);
    }
  }, [hydrated, storedResearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (research && selectedTitle === -1) {
      setSelectedTitle(getBestTitleIndex(research.seoTitles));
    }
  }, [research]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runResearch() {
    if (!brief) return;
    reset();
    setError(null);
    setTitleLocked(false);
    setSelectedTitle(-1);
    setCustomValidation(null);
    setStepStatus(1, "running");

    await consume<ResearchOutput>(
      "/api/pipeline/research",
      { topic: brief.topic, duration: brief.duration, tone: brief.tone },
      (data) => {
        setResearch(data);
        setStepOutput(1, data);
        setStepStatus(1, "complete");
      },
      (msg) => {
        setError(msg);
        setStepStatus(1, "error");
      },
    );
  }

  useEffect(() => {
    // Wait for Zustand hydration before deciding whether to run.
    // If step 1 is already complete (persisted), skip — data is in outputs[1].
    if (!hydrated) return;
    if (brief && !research && !isRunning && !["complete", "running"].includes(stepStatuses[1])) {
      runResearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, brief]);

  async function handleLockTitle() {
    if (!research) return;
    const isCustom = showCustomInput && customTitle.trim();
    const chosenTitle = isCustom
      ? customTitle.trim()
      : research.seoTitles[selectedTitle]?.title ?? "";
    if (!chosenTitle) return;

    let validation: TitleValidation | null = null;

    if (isCustom) {
      const rexBestIdx = getBestTitleIndex(research.seoTitles);
      const rexPick = research.seoTitles[rexBestIdx];
      setIsValidating(true);
      try {
        const res = await fetch("/api/pipeline/validate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customTitle: chosenTitle,
            topic: research.topic,
            targetAudience: research.targetAudience,
            viralPotential: research.viralPotential?.score ?? "MEDIUM",
            rexPickTitle: rexPick?.title ?? "",
            rexPickScore: rexPick?.rexScore ?? 70,
          }),
        });
        if (res.ok) {
          validation = await res.json() as TitleValidation;
          setCustomValidation(validation);
        }
      } catch {
        // Non-blocking — lock anyway without verdict
      } finally {
        setIsValidating(false);
      }
    }

    const rexBestIdx = getBestTitleIndex(research.seoTitles);
    const pickedScore = isCustom
      ? (validation?.rexScore ?? undefined)
      : research.seoTitles[selectedTitle]?.rexScore;

    const updated: ResearchOutput = {
      ...research,
      chosenTitleMeta: {
        isRexPick: !isCustom,
        rexScore: pickedScore,
        verdict: isCustom ? (validation?.verdict ?? undefined) : "BETTER",
        userOverrode: !!isCustom,
      },
      seoTitles: [
        {
          title: chosenTitle,
          formula: isCustom ? "curiosity-gap" : (research.seoTitles[selectedTitle]?.formula ?? "curiosity-gap"),
          estimatedCTR: "high",
          rexScore: pickedScore,
        },
        ...research.seoTitles.filter((_, i) => i !== (isCustom ? -1 : selectedTitle)),
      ],
    };
    setStepOutput(1, updated);
    setTitleLocked(true);

    void rexBestIdx;
  }

  function handleProceed() {
    setStep(2);
    window.location.href = "/create/script";
  }

  function openPanel(panel: Panel) {
    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }
    const fromIdx = activePanel ? PANEL_ORDER.indexOf(activePanel) : -1;
    const toIdx = PANEL_ORDER.indexOf(panel);
    setSlideDir(toIdx > fromIdx ? "right" : "left");
    setIsSliding(true);
    setActivePanel(panel);
    setTimeout(() => setIsSliding(false), 250);
  }

  function navigatePanel(dir: "prev" | "next") {
    if (!activePanel) return;
    const idx = PANEL_ORDER.indexOf(activePanel);
    const next = dir === "next" ? idx + 1 : idx - 1;
    if (next < 0 || next >= PANEL_ORDER.length) return;
    openPanel(PANEL_ORDER[next]);
  }

  if (!brief) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-secondary font-dm-mono text-sm">
          Enter a topic in the Creative Brief first.
        </p>
      </div>
    );
  }

  const rexBestIdx = research ? getBestTitleIndex(research.seoTitles) : 0;

  const chosenTitleText = showCustomInput && customTitle.trim()
    ? customTitle.trim()
    : research?.seoTitles[selectedTitle]?.title ?? "";

  const lockedOutput = outputs[1] as ResearchOutput | undefined;
  const lockedTitle = lockedOutput?.seoTitles?.[0]?.title ?? chosenTitleText;
  const lockedMeta = lockedOutput?.chosenTitleMeta;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-bg-border">
        <div>
          <h1 className="font-syne text-xl font-bold text-text-primary">Research</h1>
          <p className="font-dm-mono text-xs text-text-secondary mt-1 break-words">{brief.topic}</p>
        </div>
        <StatusPill status={isRunning ? "running" : research ? "complete" : "ready"} />
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4">
            <StepFailureCard
              stepNumber={1}
              stepLabel="Research"
              errorMessage={error}
              showDownstreamWarning
              downstreamCount={STEP_DOWNSTREAM[1].length}
              onRerunStep={() => { rerunStep(1); router.push("/create/research"); }}
              onRerunFromHere={() => { rerunStep(1); router.push("/create/research"); }}
            />
          </div>
        )}

        {isRunning && !research && (
          <StepProgressCard
            stages={RESEARCH_STAGES}
            completedStages={completedStages}
            statusLine={statusLine}
          />
        )}

        {research && (
          <div className="max-w-4xl mx-auto space-y-6">

            {/* ── Title Selection ─────────────────────────────────────────── */}
            <div className={`border rounded-lg overflow-hidden transition-all ${
              titleLocked ? "border-accent-success/40" : "border-accent-primary/40"
            }`}>
              <div className={`px-5 py-3 flex items-center justify-between ${
                titleLocked ? "bg-accent-success/5" : "bg-accent-primary/5"
              }`}>
                <div>
                  <span className="font-dm-mono text-xs font-semibold text-accent-primary tracking-widest uppercase">
                    {titleLocked ? "Title Locked" : "Choose Your Title"}
                  </span>
                  {!titleLocked && (
                    <p className="font-dm-mono text-xs text-text-secondary mt-1">
                      Rex scored each option — pick the best fit or write your own.
                    </p>
                  )}
                </div>
                {titleLocked && (
                  <button
                    onClick={() => {
                      setTitleLocked(false);
                      setCustomValidation(null);
                    }}
                    className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>

              {titleLocked ? (
                <div className="px-5 py-4">
                  <p className="font-syne text-base font-bold text-text-primary break-words">
                    {lockedTitle}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {lockedMeta?.isRexPick ? (
                      <span className="font-dm-mono text-xs text-accent-primary font-semibold">
                        ✦ Rex pick
                      </span>
                    ) : (
                      <span className="font-dm-mono text-xs text-text-secondary">
                        Your title
                      </span>
                    )}
                    {lockedMeta?.rexScore !== undefined && (
                      <span className="font-dm-mono text-xs text-text-secondary">
                        Rex score: <span className="text-accent-primary font-bold">{lockedMeta.rexScore}</span>
                      </span>
                    )}
                    {lockedMeta?.verdict && !lockedMeta.isRexPick && (
                      <VerdictChip verdict={lockedMeta.verdict} />
                    )}
                  </div>
                  {customValidation?.reasoning && !lockedMeta?.isRexPick && (
                    <p className="font-dm-mono text-xs text-text-secondary mt-2 italic break-words">
                      {customValidation.reasoning}
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-4 space-y-2">
                  {research.seoTitles.map((t: SEOTitle, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedTitle(i);
                        setShowCustomInput(false);
                      }}
                      className={`w-full text-left p-3 rounded border transition-all duration-150 ${
                        !showCustomInput && selectedTitle === i
                          ? "border-accent-primary bg-accent-primary/5"
                          : "border-bg-border bg-bg-surface hover:border-bg-border-hover"
                      }`}
                    >
                      <p className="font-syne text-sm text-text-primary break-words">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <MetadataChip label={t.formula} variant="tag" />
                        <MetadataChip
                          label={`CTR: ${t.estimatedCTR}`}
                          variant={t.estimatedCTR === "high" ? "keyword" : "category"}
                        />
                        {t.rexScore !== undefined && (
                          <span className={`font-dm-mono text-xs tabular-nums ${
                            i === rexBestIdx ? "text-accent-primary font-bold" : "text-text-secondary"
                          }`}>
                            {i === rexBestIdx ? `✦ ${t.rexScore}` : t.rexScore}
                          </span>
                        )}
                        {i === rexBestIdx && (
                          <span className="font-dm-mono text-xs text-accent-primary font-semibold">
                            Rex pick
                          </span>
                        )}
                      </div>
                    </button>
                  ))}

                  {showCustomInput ? (
                    <div className="p-3 rounded border border-accent-primary bg-accent-primary/5">
                      <input
                        autoFocus
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Write your own title…"
                        className="w-full bg-transparent font-syne text-sm text-text-primary placeholder-text-secondary focus:outline-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <button
                          onClick={() => {
                            setShowCustomInput(false);
                            setCustomTitle("");
                          }}
                          className="font-dm-mono text-xs text-text-secondary hover:text-text-primary"
                        >
                          Cancel
                        </button>
                        <span className="font-dm-mono text-xs text-text-secondary">
                          Rex will score your title on lock-in
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowCustomInput(true);
                        setSelectedTitle(-1);
                      }}
                      className="w-full text-left p-3 rounded border border-dashed border-bg-border-hover text-text-secondary hover:border-accent-primary/40 hover:text-text-primary transition-all font-dm-mono text-xs"
                    >
                      + Write your own title
                    </button>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleLockTitle}
                      disabled={!chosenTitleText || isValidating}
                      className="px-5 py-2 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors flex items-center gap-2"
                    >
                      {isValidating ? (
                        <>
                          <span className="inline-block w-3 h-3 border border-bg-base/40 border-t-bg-base rounded-full animate-spin" />
                          Rex is scoring…
                        </>
                      ) : (
                        "LOCK IN TITLE →"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Summary + Hook ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-bg-surface border border-bg-border border-l-2 border-l-accent-info/50">
                <h3 className="font-syne text-sm font-bold text-accent-info mb-2">Summary</h3>
                <p className="font-dm-mono text-sm text-text-secondary leading-relaxed break-words">
                  {research.summary}
                </p>
              </div>
              <div className="p-4 rounded-md bg-accent-primary/5 border border-accent-primary/30">
                <h3 className="font-syne text-sm font-bold text-accent-primary mb-2">Opening Hook</h3>
                <p className="font-lora text-sm text-text-primary leading-relaxed italic break-words">
                  &ldquo;{research.hook}&rdquo;
                </p>
              </div>
            </div>

            {/* ── Section Cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {(["overview", "keywords", "data"] as Panel[]).map((panel) => {
                const isActive = activePanel === panel;
                const colors = PANEL_COLORS[panel];
                return (
                  <button
                    key={panel}
                    onClick={() => openPanel(panel)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      isActive ? colors.active : colors.idle
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-dm-mono text-xs font-semibold tracking-widest uppercase ${colors.idleLabel}`}>
                        {PANEL_LABELS[panel]}
                      </span>
                      <span className={`font-dm-mono text-xs transition-transform ${
                        isActive ? `${colors.arrow} rotate-90` : colors.arrow
                      }`}>›</span>
                    </div>
                    <p className="font-dm-mono text-xs text-text-primary/50 leading-relaxed">
                      {getPanelTeaser(panel, research)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* ── Slide Panel ────────────────────────────────────────────── */}
            {activePanel && (
              <div className="border border-bg-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border bg-bg-surface">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigatePanel("prev")}
                      disabled={PANEL_ORDER.indexOf(activePanel) === 0}
                      className="font-dm-mono text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      ‹
                    </button>
                    <span className={`font-syne text-sm font-bold ${PANEL_COLORS[activePanel].label}`}>
                      {PANEL_LABELS[activePanel]}
                    </span>
                    <button
                      onClick={() => navigatePanel("next")}
                      disabled={PANEL_ORDER.indexOf(activePanel) === PANEL_ORDER.length - 1}
                      className="font-dm-mono text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                    >
                      ›
                    </button>
                  </div>
                  <button
                    onClick={() => setActivePanel(null)}
                    className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div
                  className={`p-5 transition-all duration-[250ms] ${
                    isSliding
                      ? slideDir === "right"
                        ? "opacity-0 translate-x-2"
                        : "opacity-0 -translate-x-2"
                      : "opacity-100 translate-x-0"
                  }`}
                >
                  {activePanel === "overview" && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-syne text-sm font-bold text-text-primary mb-2">Key Facts</h4>
                        {research.keyFacts.map((fact: KeyFact, i: number) => (
                          <FactCard key={i} fact={fact} />
                        ))}
                      </div>
                      <div>
                        <h4 className="font-syne text-sm font-bold text-accent-success mb-2">Pros</h4>
                        <div className="space-y-2">
                          {research.pros.map((p, i) => (
                            <div key={i} className="p-3 rounded bg-accent-success/5 border border-accent-success/20">
                              <p className="font-dm-mono text-xs text-text-primary font-semibold break-words">{p.point}</p>
                              <p className="font-dm-mono text-xs text-text-secondary mt-1 leading-relaxed break-words">{p.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-syne text-sm font-bold text-accent-error mb-2">Cons</h4>
                        <div className="space-y-2">
                          {research.cons.map((c, i) => (
                            <div key={i} className="p-3 rounded bg-accent-error/5 border border-accent-error/20">
                              <p className="font-dm-mono text-xs text-text-primary font-semibold break-words">{c.point}</p>
                              <p className="font-dm-mono text-xs text-text-secondary mt-1 leading-relaxed break-words">{c.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePanel === "keywords" && (
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                          <span className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase font-semibold">Primary</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {research.keywords.primary.map((k) => (
                            <MetadataChip key={k} label={k} variant="keyword" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-info" />
                          <span className="font-dm-mono text-xs text-accent-info tracking-widest uppercase font-semibold">Secondary</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {research.keywords.secondary.map((k) => (
                            <MetadataChip key={k} label={k} variant="tag" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          <span className="font-dm-mono text-xs text-purple-400 tracking-widest uppercase font-semibold">Long-tail</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {research.keywords.longTail.map((k) => (
                            <MetadataChip key={k} label={k} variant="category" />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePanel === "data" && (
                    <div className="grid grid-cols-2 gap-4">
                      {research.viralPotential && (
                        <div className={`p-4 rounded-md border ${
                          research.viralPotential.score === "HIGH"
                            ? "bg-purple-500/5 border-purple-500/30"
                            : "bg-accent-warning/5 border-accent-warning/20"
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className={`font-syne text-sm font-bold ${
                              research.viralPotential.score === "HIGH" ? "text-purple-400" : "text-accent-warning"
                            }`}>Viral Potential</h4>
                            <MetadataChip
                              label={research.viralPotential.score}
                              variant={research.viralPotential.score === "HIGH" ? "keyword" : "tag"}
                            />
                          </div>
                          <p className="font-dm-mono text-sm text-text-secondary leading-relaxed break-words">{research.viralPotential.reasoning}</p>
                          {research.viralPotential.shareTrigger && (
                            <p className={`font-dm-mono text-xs mt-3 italic break-words ${
                              research.viralPotential.score === "HIGH" ? "text-purple-400/70" : "text-text-secondary"
                            }`}>
                              Share trigger: {research.viralPotential.shareTrigger}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="p-4 rounded-md bg-accent-info/5 border border-accent-info/20">
                        <h4 className="font-syne text-sm font-bold text-accent-info mb-2">Target Audience</h4>
                        <p className="font-dm-mono text-sm text-text-secondary leading-relaxed break-words">{research.targetAudience}</p>
                        {research.competitorGap && (
                          <>
                            <h4 className="font-syne text-sm font-bold text-accent-primary mt-4 mb-2">Competitor Gap</h4>
                            <p className="font-dm-mono text-sm text-text-secondary leading-relaxed break-words">{research.competitorGap}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Proceed ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-4 pt-2">
              {!titleLocked && (
                <p className="font-dm-mono text-xs text-text-secondary">
                  Lock in a title above to continue
                </p>
              )}
              <button
                onClick={handleProceed}
                disabled={!titleLocked}
                className="px-6 py-2.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
              >
                PROCEED TO SCRIPT →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FactCard({ fact }: { fact: KeyFact }) {
  const [expanded, setExpanded] = useState(false);
  const sourceIsLong = fact.source.length > 30;

  return (
    <div className="p-3 rounded bg-bg-surface border border-bg-border border-l-2 border-l-accent-primary/40">
      <p className="font-dm-mono text-xs text-text-primary leading-relaxed break-words">{fact.fact}</p>
      <div className="flex items-start gap-2 mt-1.5 flex-wrap">
        <div className="flex items-center gap-1 min-w-0">
          <span className={`font-dm-mono text-xs text-text-secondary break-words ${!expanded && sourceIsLong ? "line-clamp-1" : ""}`}>
            {fact.source}
          </span>
          {sourceIsLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="font-dm-mono text-xs text-accent-primary hover:underline flex-shrink-0"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
        <MetadataChip
          label={fact.recency}
          variant={fact.recency === "recent" ? "tag" : "category"}
        />
      </div>
    </div>
  );
}

function VerdictChip({ verdict }: { verdict: "BETTER" | "ON_PAR" | "WEAKER" }) {
  if (verdict === "BETTER") {
    return (
      <span className="font-dm-mono text-xs text-accent-success bg-accent-success/10 border border-accent-success/20 px-2 py-0.5 rounded">
        ✦ Better than Rex
      </span>
    );
  }
  if (verdict === "ON_PAR") {
    return (
      <span className="font-dm-mono text-xs text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-2 py-0.5 rounded">
        ≈ On par
      </span>
    );
  }
  return (
    <span className="font-dm-mono text-xs text-text-secondary bg-bg-surface border border-bg-border px-2 py-0.5 rounded">
      ⚠ Weaker than Rex
    </span>
  );
}
