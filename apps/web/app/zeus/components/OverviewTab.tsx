"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/lib/agent-store";
import type { AgentScore, AgentName, WatchlistItem } from "@/lib/agent-store";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import gsap from "gsap";

const NICHES = [
  { value: "AI & Technology", label: "TECH" },
  { value: "Finance & Investing", label: "FINANCE" },
  { value: "News & Current Events", label: "NEWS" },
  { value: "Sports", label: "SPORTS" },
  { value: "Science & Space", label: "SCIENCE" },
  { value: "Entertainment & Pop Culture", label: "ENTERTAINMENT" },
  { value: "Politics & Society", label: "POLITICS" },
  { value: "Health & Wellness", label: "HEALTH" },
  { value: "Gaming", label: "GAMING" },
  { value: "Education", label: "EDUCATION" },
];

export function OverviewTab() {
  const {
    isAutonomousMode,
    selectedNiches,
    agentStatuses,
    agentScores,
    activities,
    watchlist,
    commentInsights,
    memoryLog,
    setAutonomousMode,
    toggleNiche,
    clearNiches,
  } = useAgentStore();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);

  function handleGoRRQ() {
    setAutonomousMode(true);

    // GSAP cinematic sweep
    if (buttonRef.current && sweepRef.current) {
      gsap.fromTo(
        sweepRef.current,
        { x: "-100%", opacity: 0.6 },
        { x: "100%", opacity: 0, duration: 0.45, ease: "power2.out" }
      );
      gsap.to(buttonRef.current, {
        scale: 1.02,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      });
    }
  }

  // Poll dashboard every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/zeus/dashboard");
        if (!res.ok) return;
        const data = await res.json() as {
          agentScores?: AgentScore[];
          recentEpisodes?: Array<{ agentId?: string; text?: string; createdAt?: string }>;
          dashboard?: {
            watchlist?: WatchlistItem[];
            commentInsights?: {
              total: number;
              genuine: number;
              topRequest: string | null;
              topPraise: string | null;
              sentiment: { positive: number; neutral: number; negative: number };
            } | null;
          };
        };
        const store = useAgentStore.getState();
        if (data.agentScores) store.setAgentScores(data.agentScores);
        if (data.dashboard?.watchlist) store.setWatchlist(data.dashboard.watchlist);
        if (data.dashboard?.commentInsights) store.setCommentInsights(data.dashboard.commentInsights);
        if (data.recentEpisodes?.length) {
          const entries = data.recentEpisodes.slice(0, 5).map((e) => ({
            agent: (e.agentId ?? "zeus") as AgentName,
            lesson: e.text ?? "",
            timestamp: e.createdAt ? new Date(e.createdAt).getTime() : Date.now(),
          }));
          store.setMemoryLog(entries);
        }
      } catch {
        // Polling failure is non-fatal
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-12 gap-0 flex-1 divide-x divide-bg-border overflow-hidden">
      {/* Left col — Agent cards (35%) */}
      <div className="col-span-4 p-6 overflow-y-auto">
        <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
          Agent Performance
        </div>

        <div className="space-y-4">
          {["zeus", "rex", "regum", "qeon"].map((agentName) => {
            const score = agentScores.find((s) => s.agent === agentName);
            const status = agentStatuses[agentName as keyof typeof agentStatuses];

            return (
              <div
                key={agentName}
                className="bg-bg-surface border border-bg-border p-4 hover:border-accent-primary transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-syne font-bold text-accent-primary tracking-widest text-sm">
                      {agentName.toUpperCase()}
                    </div>
                    <div className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                      {agentName === "zeus"
                        ? "Head of Operations"
                        : agentName === "rex"
                        ? "Intelligence"
                        : agentName === "regum"
                        ? "Strategy"
                        : "Production"}
                    </div>
                  </div>
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      status === "running"
                        ? "bg-accent-primary animate-pulse-amber"
                        : status === "error"
                        ? "bg-accent-error"
                        : "bg-text-tertiary"
                    }`}
                  />
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-dm-mono text-[10px] text-text-tertiary">Score</span>
                    <div className="flex items-center gap-1">
                      <span className="font-dm-mono text-xs text-text-primary">
                        {score?.score ?? "--"}
                      </span>
                      {score?.trend === "improving" ? (
                        <TrendingUp size={10} className="text-accent-success" />
                      ) : score?.trend === "declining" ? (
                        <TrendingDown size={10} className="text-accent-error" />
                      ) : (
                        <Minus size={10} className="text-text-tertiary" />
                      )}
                    </div>
                  </div>
                  <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-primary rounded-full transition-all duration-800"
                      style={{ width: `${score?.score ?? 0}%` }}
                    />
                  </div>
                </div>

                {score?.lastWin && (
                  <p className="font-dm-mono text-[10px] text-text-tertiary leading-relaxed mt-2">
                    &quot;{score.lastWin}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Centre col — GO RRQ + feed (40%) */}
      <div className="col-span-5 flex flex-col">
        <div className="p-6 border-b border-bg-border">
          <div className="relative group">
            <button
              ref={buttonRef}
              onClick={handleGoRRQ}
              className="go-rrq-noise w-full py-8 bg-gradient-to-br from-accent-primary to-[#e8920f] text-text-inverse font-syne font-extrabold text-3xl tracking-[0.1em] relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(245,166,35,0.4)]"
            >
              {/* GSAP sweep overlay */}
              <span
                ref={sweepRef}
                className="absolute inset-0 bg-white/30 pointer-events-none"
                style={{ transform: "translateX(-100%)" }}
              />
              <span className="relative z-10 block">GO RRQ</span>
              <span className="relative z-10 block font-dm-mono text-xs font-400 tracking-[0.3em] uppercase opacity-70 mt-1">
                Full Autonomous Mode
              </span>
            </button>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
              <div className="flex flex-wrap gap-1 mb-1">
                <button
                  onClick={clearNiches}
                  className={`
                    font-dm-mono text-[10px] px-2 py-1 border tracking-widest transition-all duration-150
                    ${selectedNiches.length === 0
                      ? "border-accent-primary bg-accent-primary text-text-inverse"
                      : "border-bg-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary"
                    }
                  `}
                >
                  ALL NICHES
                </button>
                {NICHES.map((niche) => (
                  <button
                    key={niche.value}
                    onClick={() => toggleNiche(niche.value)}
                    className={`
                      font-dm-mono text-[10px] px-2 py-1 border tracking-widest transition-all duration-150
                      ${selectedNiches.includes(niche.value)
                        ? "border-accent-primary bg-accent-primary text-text-inverse"
                        : "border-bg-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary"
                      }
                    `}
                  >
                    {niche.label}
                  </button>
                ))}
              </div>
              {selectedNiches.length > 0 && (
                <p className="font-dm-mono text-[9px] text-text-tertiary pl-0.5">
                  {selectedNiches.length} niche{selectedNiches.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
            Live Activity
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-12">
              <div className="font-dm-mono text-xs text-text-tertiary">
                No activity yet. Click GO RRQ to start.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2 border-b border-bg-border/50"
                >
                  <div className="flex items-center gap-1.5 w-20 shrink-0">
                    <div className="w-1 h-1 rounded-full bg-accent-primary animate-pulse-amber" />
                    <span className="font-dm-mono text-[10px] text-accent-primary tracking-wider">
                      {activity.agent.toUpperCase()}
                    </span>
                  </div>
                  <span className="font-dm-mono text-xs text-text-secondary leading-relaxed">
                    {activity.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right col — insights (25%) */}
      <div className="col-span-3 overflow-y-auto">
        <div className="p-6 border-b border-bg-border">
          <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
            Monitoring ({watchlist.length})
          </div>

          {watchlist.length === 0 ? (
            <div className="font-dm-mono text-[10px] text-text-tertiary">
              Rex watchlist empty.
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map((item) => (
                <div key={item.topic} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-dm-mono text-[11px] text-text-primary truncate max-w-[130px]">
                      {item.topic}
                    </span>
                    <span
                      className={`font-dm-mono text-[10px] ${
                        item.status === "ready" ? "text-accent-success" : "text-text-tertiary"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="h-0.5 bg-bg-elevated rounded-full">
                    <div
                      className="h-full bg-accent-primary rounded-full"
                      style={{ width: `${item.confidence * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-b border-bg-border">
          <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
            Comment Intelligence
          </div>

          {!commentInsights ? (
            <div className="font-dm-mono text-[10px] text-text-tertiary">No data yet.</div>
          ) : (
            <div className="space-y-3">
              <div className="font-dm-mono text-[10px] text-text-secondary">
                {commentInsights.total} analysed · {commentInsights.genuine} genuine
              </div>
              {commentInsights.topRequest && (
                <div>
                  <span className="font-dm-mono text-[10px] text-text-tertiary block">
                    Top request
                  </span>
                  <span className="font-dm-mono text-[11px] text-text-primary">
                    &quot;{commentInsights.topRequest}&quot;
                  </span>
                </div>
              )}
              <div className="space-y-1">
                {[
                  { label: "Positive", value: commentInsights.sentiment.positive, color: "bg-accent-success" },
                  { label: "Neutral", value: commentInsights.sentiment.neutral, color: "bg-text-tertiary" },
                  { label: "Negative", value: commentInsights.sentiment.negative, color: "bg-accent-error" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-bg-elevated rounded-full">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
                    </div>
                    <span className="font-dm-mono text-[10px] text-text-tertiary w-8">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
            Recent Lessons
          </div>

          {memoryLog.length === 0 ? (
            <div className="font-dm-mono text-[10px] text-text-tertiary">
              No lessons written yet.
            </div>
          ) : (
            <div className="space-y-4">
              {memoryLog.map((entry, i) => (
                <div key={i} className="border-l border-bg-border pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-dm-mono text-[10px] text-accent-primary tracking-wider">
                      {entry.agent.toUpperCase()}
                    </span>
                    <span className="font-dm-mono text-[10px] text-text-tertiary">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-lora text-xs text-text-secondary leading-relaxed">
                    &quot;{entry.lesson}&quot;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
