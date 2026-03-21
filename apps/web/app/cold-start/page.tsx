"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Loader2, AlertCircle, ChevronRight, Zap, Settings } from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/lib/ui-store";

// ─── Types ────────────────────────────────────────────────────────────────────

type SprintStatus = "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";

interface VideoCandidate {
  rank: number;
  angle: string;
  format: string;
  whyThisFirst: string;
  estimatedCTR: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  testHypothesis: string;
}

interface ContentGap {
  gap: string;
  why: string;
  opportunity: "HIGH" | "MEDIUM" | "LOW";
  competitors: string[];
}

interface SprintData {
  status: SprintStatus;
  currentPhase: string;
  currentPhaseLabel: string;
  phaseIndex: number;
  totalPhases: number;
  progressPct: number;
  sprintStartedAt: string;
  sprintCompletedAt: string | null;
  rexScanSummary: string | null;
  sniperAuditSummary: string | null;
  contentGapMap: ContentGap[];
  oversaturatedAngles: string[];
  firstVideoShortlist: VideoCandidate[];
  coldStartStrategy: string | null;
  syntheticRecordsSeeded: number;
  error: string | null;
  selectedNiches: string[];
  channelMode: string;
}

// ─── Dev fake data ────────────────────────────────────────────────────────────

const FAKE_SPRINT: SprintData = {
  status: "COMPLETE",
  currentPhase: "COMPLETE",
  currentPhaseLabel: "Sprint Complete",
  phaseIndex: 6,
  totalPhases: 7,
  progressPct: 100,
  sprintStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  sprintCompletedAt: new Date().toISOString(),
  rexScanSummary: "14 open windows found · AI hardware review cycle peaking · Competitor saturation LOW in explainer format",
  sniperAuditSummary: "9 channels profiled · Top gap: no one doing budget builds under $500 with real benchmarks · MrMobile + Dave2D dominant in premium tier",
  contentGapMap: [
    {
      gap: "Budget GPU builds under $500 with real-world benchmark comparisons",
      why: "All major tech channels target $1k+ builds. Sub-$500 segment underserved despite massive search volume.",
      opportunity: "HIGH",
      competitors: ["MrMobile", "Dave2D", "Linus Tech Tips"],
    },
    {
      gap: "AI tools for everyday productivity — not coding, not creative",
      why: "Coverage skews heavily toward developers and designers. Office workers / students searching but not finding direct answers.",
      opportunity: "HIGH",
      competitors: ["MKBHD", "The Verge"],
    },
    {
      gap: "Long-term reliability reviews (1-year follow-ups)",
      why: "Launch-day reviews flood the market. Nobody revisits products 12 months later with real wear data.",
      opportunity: "MEDIUM",
      competitors: ["JerryRigEverything"],
    },
  ],
  oversaturatedAngles: [
    "iPhone 16 Pro Max review",
    "Apple vs Samsung 2025 comparison",
    "Best laptops under $1000 generic roundup",
    "M4 MacBook Air unboxing",
  ],
  firstVideoShortlist: [
    {
      rank: 1,
      angle: "I built the best PC you can for $499 in 2025 — and benchmarked it against a $1,200 system",
      format: "CHALLENGE / BUILD LOG",
      whyThisFirst: "Maximum search volume, zero saturation in your budget tier, high shareability. Sets the channel identity as the 'real numbers' channel from video one.",
      estimatedCTR: "7–9%",
      riskLevel: "LOW",
      testHypothesis: "Budget-conscious audience will share aggressively if the benchmarks are honest and the value proposition is clear in the thumbnail.",
    },
    {
      rank: 2,
      angle: "5 AI tools that actually saved me hours this week (tested on real work, not demos)",
      format: "LISTICLE / DEMO",
      whyThisFirst: "Evergreen search demand, low production cost, positions channel in the AI productivity lane early.",
      estimatedCTR: "5–7%",
      riskLevel: "LOW",
      testHypothesis: "Non-developer audience will respond to specificity — 'real work' framing beats generic 'best AI tools' clones.",
    },
    {
      rank: 3,
      angle: "I used the same $300 monitor for 18 months — here's what actually broke down",
      format: "LONG-TERM REVIEW",
      whyThisFirst: "Differentiated format. No one else is doing this. Builds trust and authority for a new channel faster than launch-day reviews.",
      estimatedCTR: "4–6%",
      riskLevel: "MEDIUM",
      testHypothesis: "Honesty-first framing and long-form trust signals will attract subscribers who stay, even if initial CTR is lower.",
    },
  ],
  coldStartStrategy: `Weeks 1–2: Establish the 'real numbers' brand identity. Lead with the $499 build — this anchors your channel as data-driven and budget-accessible. Avoid Apple/Samsung content entirely in the first month.

Weeks 3–4: Layer in AI productivity content. Target the office worker segment that no tech channel is serving properly. Keep it practical — tools, not theory.

Month 2: Introduce the long-term review format. Pick a product you've owned for 6+ months. This is your moat — nobody else is doing this at your scale.

Avoid: Unboxings, reaction content, "best of year" roundups. These are crowded and won't differentiate a new channel.`,
  syntheticRecordsSeeded: 7,
  error: null,
  selectedNiches: ["Tech Reviews"],
  channelMode: "SINGLE_NICHE",
};

// ─── Phase list ───────────────────────────────────────────────────────────────

const PHASES = [
  { id: "REX_SCAN", label: "Trend & Narrative Mapping", agent: "REX", hours: "0–4h" },
  { id: "SNIPER_AUDIT", label: "Competitor & Market Intelligence", agent: "SNIPER", hours: "0–4h (parallel)" },
  { id: "ORACLE_PATTERNS", label: "Historical Pattern Analysis", agent: "ORACLE", hours: "4–8h" },
  { id: "THE_LINE_SYNTHESIS", label: "Synthesis + Content Gap Map", agent: "THE LINE", hours: "8–16h" },
  { id: "SHORTLIST", label: "First Video Shortlist", agent: "THE LINE", hours: "16–20h" },
  { id: "COUNCIL_SEEDING", label: "Council Index Seeding", agent: "THE LINE", hours: "20–24h" },
  { id: "COMPLETE", label: "Sprint Complete", agent: "ZEUS", hours: "24h" },
];

const RISK_COLOR: Record<string, string> = {
  LOW: "text-accent-success border-accent-success",
  MEDIUM: "text-accent-primary border-accent-primary",
  HIGH: "text-accent-error border-accent-error",
};

const GAP_COLOR: Record<string, string> = {
  HIGH: "text-accent-success",
  MEDIUM: "text-accent-primary",
  LOW: "text-text-tertiary",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseRow({
  phase,
  currentPhase,
  phaseIndex,
  index,
  rexSummary,
  sniperSummary,
}: {
  phase: (typeof PHASES)[number];
  currentPhase: string;
  phaseIndex: number;
  index: number;
  rexSummary: string | null;
  sniperSummary: string | null;
}) {
  const isDone = index < phaseIndex;
  const isActive = phase.id === currentPhase;
  const isPending = index > phaseIndex;

  const subtext =
    phase.id === "REX_SCAN" && rexSummary
      ? rexSummary
      : phase.id === "SNIPER_AUDIT" && sniperSummary
      ? sniperSummary
      : null;

  return (
    <div
      className={`flex items-start gap-4 p-4 border transition-colors duration-300 ${
        isActive
          ? "border-accent-primary/60 bg-accent-primary/5"
          : isDone
          ? "border-bg-border bg-bg-surface"
          : "border-bg-border/40 opacity-50"
      }`}
    >
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        {isDone ? (
          <div className="w-5 h-5 rounded-full bg-accent-success flex items-center justify-center">
            <Check size={11} className="text-text-inverse" strokeWidth={3} />
          </div>
        ) : isActive ? (
          <Loader2 size={20} className="text-accent-primary animate-spin" />
        ) : (
          <div className="w-5 h-5 rounded-full border border-bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span
            className={`font-syne font-bold text-sm ${
              isActive
                ? "text-accent-primary"
                : isDone
                ? "text-text-primary"
                : "text-text-tertiary"
            }`}
          >
            {phase.label}
          </span>
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest">
            {phase.agent}
          </span>
          <span className="font-dm-mono text-[10px] text-text-tertiary ml-auto">
            {phase.hours}
          </span>
        </div>
        {subtext && (
          <p className="font-dm-mono text-[10px] text-text-secondary mt-1 leading-relaxed">
            {subtext}
          </p>
        )}
        {isActive && !subtext && (
          <p className="font-dm-mono text-[10px] text-accent-primary/70 mt-1 animate-pulse">
            Running…
          </p>
        )}
      </div>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: VideoCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const isRecommended = candidate.rank === 1;

  return (
    <div
      className={`border transition-colors duration-200 ${
        isRecommended
          ? "border-accent-primary bg-accent-primary/5"
          : "border-bg-border bg-bg-surface hover:border-accent-primary/40"
      }`}
    >
      <button className="w-full p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isRecommended ? (
              <div className="flex items-center gap-1 bg-accent-primary px-1.5 py-0.5">
                <Zap size={9} className="text-text-inverse" />
                <span className="font-dm-mono text-[9px] text-text-inverse tracking-widest">
                  RECOMMENDED
                </span>
              </div>
            ) : (
              <div className="font-dm-mono text-[10px] text-text-tertiary border border-bg-border px-1.5 py-0.5">
                #{candidate.rank}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-syne font-bold text-sm text-text-primary leading-snug">
              {candidate.angle}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-dm-mono text-[10px] text-text-tertiary">
                {candidate.format}
              </span>
              <span className="font-dm-mono text-[10px] text-text-tertiary">
                CTR est. {candidate.estimatedCTR}
              </span>
              <span
                className={`font-dm-mono text-[10px] border px-1.5 py-0.5 ${RISK_COLOR[candidate.riskLevel] ?? "text-text-tertiary border-bg-border"}`}
              >
                {candidate.riskLevel} RISK
              </span>
            </div>
          </div>

          <ChevronRight
            size={14}
            className={`text-text-tertiary shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-bg-border">
          <div className="pt-3">
            <div className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase mb-1">
              Why This First
            </div>
            <p className="font-lora text-xs text-text-secondary leading-relaxed">
              {candidate.whyThisFirst}
            </p>
          </div>
          <div>
            <div className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase mb-1">
              Test Hypothesis
            </div>
            <p className="font-lora text-xs text-text-secondary leading-relaxed">
              {candidate.testHypothesis}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ColdStartPage() {
  const [sprint, setSprint] = useState<SprintData | null>(null);
  const [loading, setLoading] = useState(true);
  const { openZeusChatWithContext } = useUIStore();

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/cold-start/status");
      if (res.ok) {
        const data = await res.json() as { sprint: SprintData | null };
        // DEV: inject fake completed sprint if nothing in DynamoDB
        if (!data.sprint && process.env.NODE_ENV === "development") {
          setSprint(FAKE_SPRINT);
        } else {
          setSprint(data.sprint);
        }
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    // Poll every 8s while running
    const interval = setInterval(() => {
      if (sprint?.status === "RUNNING" || sprint === null) {
        void poll();
      }
    }, 8_000);
    return () => clearInterval(interval);
  }, [poll, sprint?.status]);

  const currentPhaseIndex = sprint
    ? PHASES.findIndex((p) => p.id === sprint.currentPhase)
    : -1;

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Header */}
      <div className="border-b border-bg-border px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-syne font-bold text-lg text-text-primary tracking-wider">
              COLD START DEEP RESEARCH
            </h1>
            <p className="font-dm-mono text-[10px] text-text-tertiary tracking-widest mt-0.5">
              24-hour sprint · Rex + SNIPER + Oracle + The Line
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openZeusChatWithContext("niche-change")}
              className="flex items-center gap-2 font-dm-mono text-[11px] tracking-widest text-text-secondary border border-bg-border px-3 py-2 hover:border-accent-primary hover:text-accent-primary transition-all duration-200"
            >
              <Settings size={12} />
              CHANGE NICHE
            </button>
            {sprint?.status === "COMPLETE" && (
              <Link
                href="/zeus"
                className="font-dm-mono text-[11px] tracking-widest text-accent-primary border border-accent-primary px-4 py-2 hover:bg-accent-primary hover:text-text-inverse transition-all duration-200"
              >
                FIRST COUNCIL →
              </Link>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="text-accent-primary animate-spin" />
        </div>
      ) : !sprint ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-dm-mono text-xs text-text-tertiary mb-2">
              No cold start sprint found.
            </p>
            <p className="font-dm-mono text-[10px] text-text-tertiary/60">
              Sprint fires automatically when channel mode is confirmed in onboarding.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex">
          {/* Left — Sprint phases */}
          <div className="w-[420px] shrink-0 border-r border-bg-border flex flex-col">
            {/* Progress bar */}
            <div className="px-6 py-4 border-b border-bg-border shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
                  Sprint Progress
                </span>
                <span className="font-dm-mono text-xs text-text-primary">
                  {sprint.progressPct}%
                </span>
              </div>
              <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary rounded-full transition-all duration-1000"
                  style={{ width: `${sprint.progressPct}%` }}
                />
              </div>
              {sprint.selectedNiches.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {sprint.selectedNiches.map((n) => (
                    <span
                      key={n}
                      className="font-dm-mono text-[9px] text-accent-primary border border-accent-primary/40 px-1.5 py-0.5 tracking-widest"
                    >
                      {n.toUpperCase().slice(0, 12)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Phase list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sprint.status === "FAILED" ? (
                <div className="bg-accent-error/10 border border-accent-error/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-accent-error" />
                    <span className="font-dm-mono text-[11px] text-accent-error tracking-widest uppercase">
                      Sprint Failed
                    </span>
                  </div>
                  <p className="font-dm-mono text-[10px] text-text-secondary leading-relaxed">
                    {sprint.error ?? "Unknown error"}
                  </p>
                </div>
              ) : (
                PHASES.map((phase, i) => (
                  <PhaseRow
                    key={phase.id}
                    phase={phase}
                    currentPhase={sprint.currentPhase}
                    phaseIndex={currentPhaseIndex}
                    index={i}
                    rexSummary={sprint.rexScanSummary}
                    sniperSummary={sprint.sniperAuditSummary}
                  />
                ))
              )}
            </div>

            {/* Seeding count */}
            {sprint.syntheticRecordsSeeded > 0 && (
              <div className="px-6 py-3 border-t border-bg-border shrink-0">
                <span className="font-dm-mono text-[10px] text-accent-success">
                  ✦ {sprint.syntheticRecordsSeeded} baseline records seeded to council index
                </span>
              </div>
            )}
          </div>

          {/* Right — Results (shown when COMPLETE) */}
          <div className="flex-1 overflow-y-auto p-6">
            {sprint.status !== "COMPLETE" ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 size={32} className="text-accent-primary animate-spin mb-4" />
                <p className="font-syne font-bold text-text-primary mb-2">
                  {sprint.currentPhaseLabel}
                </p>
                <p className="font-dm-mono text-[10px] text-text-tertiary max-w-xs">
                  The team is running deep research. Results appear here when the sprint completes.
                </p>
              </div>
            ) : (
              <div className="space-y-8 max-w-2xl">
                {/* First video candidates */}
                <div>
                  <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
                    First Video Candidates
                  </div>
                  <div className="space-y-3">
                    {sprint.firstVideoShortlist.map((c) => (
                      <CandidateCard key={c.rank} candidate={c} />
                    ))}
                  </div>
                </div>

                {/* Content gap map */}
                {sprint.contentGapMap.length > 0 && (
                  <div>
                    <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
                      Content Gap Map
                    </div>
                    <div className="space-y-3">
                      {sprint.contentGapMap.map((gap, i) => (
                        <div
                          key={i}
                          className="bg-bg-surface border border-bg-border p-4"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="font-syne font-bold text-sm text-text-primary">
                              {gap.gap}
                            </p>
                            <span
                              className={`font-dm-mono text-[10px] tracking-widest shrink-0 ${GAP_COLOR[gap.opportunity] ?? "text-text-tertiary"}`}
                            >
                              {gap.opportunity}
                            </span>
                          </div>
                          <p className="font-dm-mono text-[10px] text-text-secondary leading-relaxed">
                            {gap.why}
                          </p>
                          {gap.competitors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {gap.competitors.map((c) => (
                                <span
                                  key={c}
                                  className="font-dm-mono text-[9px] text-text-tertiary border border-bg-border px-1.5 py-0.5"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avoid list */}
                {sprint.oversaturatedAngles.length > 0 && (
                  <div>
                    <div className="font-dm-mono text-xs text-accent-error tracking-widest uppercase mb-3">
                      Oversaturated — Avoid at Launch
                    </div>
                    <div className="space-y-1">
                      {sprint.oversaturatedAngles.map((angle, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 py-1.5 border-b border-bg-border/50"
                        >
                          <span className="font-dm-mono text-[10px] text-accent-error">✗</span>
                          <span className="font-dm-mono text-[11px] text-text-secondary">
                            {angle}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cold start strategy */}
                {sprint.coldStartStrategy && (
                  <div>
                    <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-3">
                      30-Day Cold Start Strategy
                    </div>
                    <div className="bg-bg-surface border border-bg-border p-4">
                      <p className="font-lora text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                        {sprint.coldStartStrategy}
                      </p>
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="bg-accent-primary/10 border border-accent-primary/40 p-6 text-center">
                  <div className="font-syne font-bold text-text-primary mb-1">
                    First council ready to convene
                  </div>
                  <p className="font-dm-mono text-[10px] text-text-tertiary mb-4">
                    Council index seeded · {sprint.syntheticRecordsSeeded} baseline records · Agents informed
                  </p>
                  <Link
                    href="/zeus"
                    className="inline-block font-dm-mono text-[11px] tracking-widest text-text-inverse bg-accent-primary px-6 py-3 hover:bg-accent-primary/90 transition-colors duration-200"
                  >
                    GO TO ZEUS COMMAND CENTER →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
