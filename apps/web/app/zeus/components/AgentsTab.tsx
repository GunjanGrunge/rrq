"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AgentCardData {
  id: string;
  name: string;
  role: string;
  model: "OPUS" | "SONNET" | "HAIKU";
  score: number;
  trend: "improving" | "declining" | "stable";
  lastActive?: string;
  councilVerdict?: string;
  councilRationale?: string;
  veraStatus?: string;
  veraDomains?: Array<{ domain: string; score: number; verdict: string }>;
}

const MODEL_COLOR: Record<string, string> = {
  OPUS: "text-accent-primary border-accent-primary/60",
  SONNET: "text-[#a78bfa] border-[#a78bfa]/60",
  HAIKU: "text-text-tertiary border-bg-border",
};

const COUNCIL_VERDICT_COLOR: Record<string, string> = {
  APPROVED: "text-accent-success",
  FLAG: "text-accent-primary",
  REJECT: "text-accent-error",
};

const STATIC_AGENTS: Omit<AgentCardData, "score" | "trend" | "lastActive" | "councilVerdict" | "councilRationale">[] = [
  { id: "zeus", name: "ZEUS", role: "Head of Operations", model: "OPUS" },
  { id: "rex", name: "REX", role: "Intelligence", model: "OPUS" },
  { id: "regum", name: "REGUM", role: "Strategy", model: "SONNET" },
  { id: "qeon", name: "QEON", role: "Production", model: "OPUS" },
  { id: "vera", name: "VERA", role: "QA & Standards", model: "HAIKU" },
  { id: "aria", name: "ARIA", role: "Distribution", model: "SONNET" },
  { id: "sniper", name: "SNIPER", role: "Geo-Linguistic", model: "SONNET" },
  { id: "muse", name: "MUSE", role: "Creative Director", model: "OPUS" },
  { id: "oracle", name: "ORACLE", role: "L&D Intelligence", model: "SONNET" },
  { id: "theo", name: "THEO", role: "Channel Manager", model: "SONNET" },
  { id: "the-line", name: "THE LINE", role: "Synthesis Layer", model: "OPUS" },
];

function AgentCard({ agent }: { agent: AgentCardData }) {
  const [showCouncil, setShowCouncil] = useState(false);

  return (
    <div className="bg-bg-surface border border-bg-border p-4 hover:border-accent-primary/40 transition-colors duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-syne font-bold text-accent-primary tracking-widest text-sm">
            {agent.name}
          </div>
          <div className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
            {agent.role}
          </div>
        </div>
        <span
          className={`font-dm-mono text-[9px] px-1.5 py-0.5 border tracking-widest shrink-0 ${MODEL_COLOR[agent.model] ?? "text-text-tertiary border-bg-border"}`}
        >
          {agent.model}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-dm-mono text-[9px] text-text-tertiary">Score</span>
          <div className="flex items-center gap-1">
            <span className="font-dm-mono text-[10px] text-text-primary">{agent.score}</span>
            {agent.trend === "improving" ? (
              <TrendingUp size={8} className="text-accent-success" />
            ) : agent.trend === "declining" ? (
              <TrendingDown size={8} className="text-accent-error" />
            ) : (
              <Minus size={8} className="text-text-tertiary" />
            )}
          </div>
        </div>
        <div className="h-0.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-primary rounded-full"
            style={{ width: `${agent.score}%` }}
          />
        </div>
      </div>

      {/* Council status */}
      {agent.councilVerdict && (
        <button
          className="w-full text-left"
          onClick={() => setShowCouncil(!showCouncil)}
        >
          <div className="flex items-center justify-between">
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase">
              Last Council Vote
            </span>
            <span
              className={`font-dm-mono text-[10px] tracking-widest ${COUNCIL_VERDICT_COLOR[agent.councilVerdict] ?? "text-text-tertiary"}`}
            >
              {agent.councilVerdict}
            </span>
          </div>
          {showCouncil && agent.councilRationale && (
            <p className="font-dm-mono text-[9px] text-text-secondary leading-relaxed mt-1">
              {agent.councilRationale}
            </p>
          )}
        </button>
      )}

      {/* Vera-specific: domain scores */}
      {agent.id === "vera" && agent.veraDomains && (
        <div className="flex gap-2 mt-2">
          {agent.veraDomains.map((d) => (
            <div key={d.domain} className="flex-1">
              <div className="font-dm-mono text-[8px] text-text-tertiary tracking-widest">
                {d.domain.slice(0, 3)}
              </div>
              <div
                className={`font-dm-mono text-[9px] ${d.verdict === "PASS" ? "text-accent-success" : "text-accent-error"}`}
              >
                {d.score}/10
              </div>
            </div>
          ))}
        </div>
      )}

      {agent.lastActive && (
        <div className="font-dm-mono text-[9px] text-text-tertiary mt-2">
          {new Date(agent.lastActive).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export function AgentsTab() {
  const [agents, setAgents] = useState<AgentCardData[]>(
    STATIC_AGENTS.map((a) => ({ ...a, score: 50, trend: "stable" as const }))
  );

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, veraRes, councilRes] = await Promise.allSettled([
          fetch("/api/zeus/dashboard"),
          fetch("/api/vera/result?jobId=latest"),
          fetch("/api/council/status"),
        ]);

        const agentMap = new Map<string, Partial<AgentCardData>>();

        if (dashRes.status === "fulfilled" && dashRes.value.ok) {
          const data = await dashRes.value.json() as {
            agentScores?: Array<{ agent: string; score: number; trend: string; lastWin?: string }>;
            dashboard?: { agentStatuses?: Record<string, { lastActive?: string }> };
          };

          data.agentScores?.forEach((s) => {
            agentMap.set(s.agent, {
              score: s.score,
              trend: s.trend as AgentCardData["trend"],
            });
          });
        }

        // Vera: inject last QA result
        if (veraRes.status === "fulfilled" && veraRes.value.ok) {
          const data = await veraRes.value.json() as { result?: { domains?: Array<{ domain: string; score: number; verdict: string }> } };
          if (data.result?.domains) {
            agentMap.set("vera", {
              ...(agentMap.get("vera") ?? {}),
              veraDomains: data.result.domains,
            });
          }
        }

        // Council: inject each agent's last vote verdict
        if (councilRes.status === "fulfilled" && councilRes.value.ok) {
          const data = await councilRes.value.json() as { sessions?: Array<{ votes?: Array<{ agentId: string; verdict: string; rationale: string }> }> };
          const lastSession = data.sessions?.[0];
          if (lastSession?.votes) {
            for (const vote of lastSession.votes) {
              agentMap.set(vote.agentId, {
                ...(agentMap.get(vote.agentId) ?? {}),
                councilVerdict: vote.verdict,
                councilRationale: vote.rationale,
              });
            }
          }
        }

        setAgents(
          STATIC_AGENTS.map((a) => ({
            ...a,
            score: 50,
            trend: "stable" as const,
            ...(agentMap.get(a.id) ?? {}),
          }))
        );
      } catch {
        // Non-fatal
      }
    }

    void load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
        All Agents ({agents.length})
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
