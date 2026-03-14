"use client";

import { useAgentStore } from "@/lib/agent-store";
import { TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";

const NICHES = [
  "FULL AUTO",
  "TECH",
  "NEWS",
  "SPORTS",
  "FINANCE",
  "SCIENCE",
  "ENTERTAINMENT",
  "POLITICS",
];

export default function ZeusPage() {
  const {
    isAutonomousMode,
    selectedNiche,
    agentStatuses,
    agentScores,
    activities,
    watchlist,
    commentInsights,
    memoryLog,
    setAutonomousMode,
    setNiche,
  } = useAgentStore();

  function handleGoRRQ() {
    setAutonomousMode(true);
    // Will wire to Inngest trigger in Phase 6+
  }

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Zeus sub-header */}
      <div className="border-b border-bg-border px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-syne font-bold text-lg text-text-primary tracking-wider">
            ZEUS COMMAND CENTER
          </span>
          <div
            className={`flex items-center gap-1.5 ${
              isAutonomousMode ? "text-accent-success" : "text-text-tertiary"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isAutonomousMode
                  ? "bg-accent-success animate-pulse"
                  : "bg-text-tertiary"
              }`}
            />
            <span className="font-dm-mono text-xs tracking-widest uppercase">
              {isAutonomousMode ? "Agents Active" : "Standby"}
            </span>
          </div>
        </div>
        <Brain size={20} className="text-accent-primary" />
      </div>

      <div className="grid grid-cols-12 gap-0 flex-1 divide-x divide-bg-border overflow-hidden">
        {/* Left col — Agent cards (35%) */}
        <div className="col-span-4 p-6 overflow-y-auto">
          <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-4">
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

                  {/* Score bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-dm-mono text-[10px] text-text-tertiary">
                        Score
                      </span>
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
          {/* GO RRQ button */}
          <div className="p-6 border-b border-bg-border">
            <div className="relative group">
              <button
                onClick={handleGoRRQ}
                className="go-rrq-noise w-full py-8 bg-gradient-to-br from-accent-primary to-[#e8920f] text-text-inverse font-syne font-extrabold text-3xl tracking-[0.1em] relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(245,166,35,0.4)]"
              >
                <span className="relative z-10 block">GO RRQ</span>
                <span className="relative z-10 block font-dm-mono text-xs font-400 tracking-[0.3em] uppercase opacity-70 mt-1">
                  Full Autonomous Mode
                </span>
              </button>

              {/* Niche selector — appears on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
                <div className="flex flex-wrap gap-1">
                  {NICHES.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => setNiche(niche === "FULL AUTO" ? null : niche)}
                      className={`
                        font-dm-mono text-[10px] px-2 py-1 border tracking-widest transition-all duration-150
                        ${(niche === "FULL AUTO" && selectedNiche === null) ||
                          selectedNiche === niche
                          ? "border-accent-primary bg-accent-primary text-text-inverse"
                          : "border-bg-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary"
                        }
                      `}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live activity feed */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-4">
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
          {/* Rex watchlist */}
          <div className="p-6 border-b border-bg-border">
            <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-4">
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
                          item.status === "ready"
                            ? "text-accent-success"
                            : "text-text-tertiary"
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

          {/* Comment insights */}
          <div className="p-6 border-b border-bg-border">
            <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-4">
              Comment Intelligence
            </div>

            {!commentInsights ? (
              <div className="font-dm-mono text-[10px] text-text-tertiary">
                No data yet.
              </div>
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
                        <div
                          className={`h-full rounded-full ${s.color}`}
                          style={{ width: `${s.value}%` }}
                        />
                      </div>
                      <span className="font-dm-mono text-[10px] text-text-tertiary w-8">
                        {s.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Memory log */}
          <div className="p-6">
            <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-4">
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
    </div>
  );
}
