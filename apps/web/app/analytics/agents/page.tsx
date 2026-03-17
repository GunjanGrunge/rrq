"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell,
} from "recharts";
import {
  CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown,
  Minus, ChevronDown, ChevronRight, Award, Cpu, GitBranch,
} from "lucide-react";
import AnalyticsNav from "@/components/analytics/AnalyticsNav";

// ─── Constants ─────────────────────────────────────────────────────────────

const AMBER = "#f5a623";
const SUCCESS = "#22c55e";
const INFO = "#3b82f6";
const ERROR = "#ef4444";
const WARNING = "#f59e0b";
const BORDER = "#222222";
const TEXT_TERTIARY = "#6b6560";

// ─── Mock agent data ────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  role: string;
  version: string;
  status: "active" | "idle" | "error";
  score: number;
  trend: "up" | "down" | "neutral";
  trendDelta: string;
  runsLast7d: number;
  successRate: number;
  avgLatencyMs: number;
  lastRunAt: string;
  color: string;
  dimensions: { subject: string; score: number }[];
  weeklyScores: { day: string; score: number }[];
  recentDecisions: { action: string; outcome: "win" | "miss" | "pending"; confidence: number; at: string }[];
}

const AGENTS: Agent[] = [
  {
    id: "zeus",
    name: "Zeus",
    role: "Command & Memory",
    version: "2.4.1",
    status: "active",
    score: 94,
    trend: "up",
    trendDelta: "+3",
    runsLast7d: 42,
    successRate: 97.6,
    avgLatencyMs: 2840,
    lastRunAt: "2 min ago",
    color: AMBER,
    dimensions: [
      { subject: "Accuracy", score: 96 },
      { subject: "Speed", score: 78 },
      { subject: "Memory", score: 98 },
      { subject: "Coordination", score: 94 },
      { subject: "Decisions", score: 91 },
      { subject: "Escalation", score: 89 },
    ],
    weeklyScores: [
      { day: "Mon", score: 88 }, { day: "Tue", score: 91 }, { day: "Wed", score: 93 },
      { day: "Thu", score: 90 }, { day: "Fri", score: 94 }, { day: "Sat", score: 94 }, { day: "Sun", score: 94 },
    ],
    recentDecisions: [
      { action: "Scaled campaign #4 budget 2×", outcome: "win", confidence: 0.89, at: "Mar 16" },
      { action: "Paused underperforming ad #7", outcome: "win", confidence: 0.94, at: "Mar 15" },
      { action: "Requested MUSE script rewrite", outcome: "pending", confidence: 0.72, at: "Mar 17" },
    ],
  },
  {
    id: "rex",
    name: "Rex",
    role: "Trend Intelligence",
    version: "1.8.0",
    status: "active",
    score: 87,
    trend: "up",
    trendDelta: "+5",
    runsLast7d: 336,
    successRate: 91.4,
    avgLatencyMs: 3200,
    lastRunAt: "28 min ago",
    color: INFO,
    dimensions: [
      { subject: "Accuracy", score: 88 },
      { subject: "Speed", score: 82 },
      { subject: "Memory", score: 79 },
      { subject: "Coordination", score: 84 },
      { subject: "Decisions", score: 91 },
      { subject: "Escalation", score: 76 },
    ],
    weeklyScores: [
      { day: "Mon", score: 80 }, { day: "Tue", score: 82 }, { day: "Wed", score: 85 },
      { day: "Thu", score: 84 }, { day: "Fri", score: 87 }, { day: "Sat", score: 86 }, { day: "Sun", score: 87 },
    ],
    recentDecisions: [
      { action: "Greenlit topic: AI replacing jobs", outcome: "win", confidence: 0.91, at: "Mar 14" },
      { action: "Held topic: climate controversy", outcome: "win", confidence: 0.78, at: "Mar 13" },
      { action: "Flagged finance niche trend", outcome: "pending", confidence: 0.85, at: "Mar 17" },
    ],
  },
  {
    id: "regum",
    name: "Regum",
    role: "Strategy & Schedule",
    version: "1.5.2",
    status: "idle",
    score: 81,
    trend: "neutral",
    trendDelta: "0",
    runsLast7d: 14,
    successRate: 88.9,
    avgLatencyMs: 1980,
    lastRunAt: "4 hrs ago",
    color: "#8b5cf6",
    dimensions: [
      { subject: "Accuracy", score: 83 },
      { subject: "Speed", score: 88 },
      { subject: "Memory", score: 74 },
      { subject: "Coordination", score: 85 },
      { subject: "Decisions", score: 79 },
      { subject: "Escalation", score: 82 },
    ],
    weeklyScores: [
      { day: "Mon", score: 79 }, { day: "Tue", score: 81 }, { day: "Wed", score: 80 },
      { day: "Thu", score: 82 }, { day: "Fri", score: 81 }, { day: "Sat", score: 81 }, { day: "Sun", score: 81 },
    ],
    recentDecisions: [
      { action: "Scheduled 3 videos for next week", outcome: "win", confidence: 0.88, at: "Mar 16" },
      { action: "Assigned niche: Finance", outcome: "win", confidence: 0.82, at: "Mar 15" },
      { action: "Delayed upload due to quality gate", outcome: "win", confidence: 0.91, at: "Mar 14" },
    ],
  },
  {
    id: "qeon",
    name: "Qeon",
    role: "Production Execution",
    version: "3.1.0",
    status: "active",
    score: 89,
    trend: "up",
    trendDelta: "+2",
    runsLast7d: 21,
    successRate: 94.1,
    avgLatencyMs: 890000,
    lastRunAt: "1 hr ago",
    color: "#06b6d4",
    dimensions: [
      { subject: "Accuracy", score: 90 },
      { subject: "Speed", score: 72 },
      { subject: "Memory", score: 81 },
      { subject: "Coordination", score: 94 },
      { subject: "Decisions", score: 88 },
      { subject: "Escalation", score: 93 },
    ],
    weeklyScores: [
      { day: "Mon", score: 84 }, { day: "Tue", score: 86 }, { day: "Wed", score: 88 },
      { day: "Thu", score: 87 }, { day: "Fri", score: 89 }, { day: "Sat", score: 90 }, { day: "Sun", score: 89 },
    ],
    recentDecisions: [
      { action: "Completed 13-step pipeline (Job #87)", outcome: "win", confidence: 0.96, at: "Mar 17" },
      { action: "Escalated TONY failure — step 8", outcome: "win", confidence: 0.99, at: "Mar 15" },
      { action: "Quality gate retry — passed 2nd attempt", outcome: "win", confidence: 0.88, at: "Mar 14" },
    ],
  },
  {
    id: "muse",
    name: "Muse",
    role: "Script & Blueprint",
    version: "2.0.3",
    status: "idle",
    score: 92,
    trend: "up",
    trendDelta: "+1",
    runsLast7d: 21,
    successRate: 95.2,
    avgLatencyMs: 5100,
    lastRunAt: "2 hrs ago",
    color: "#ec4899",
    dimensions: [
      { subject: "Accuracy", score: 95 },
      { subject: "Speed", score: 68 },
      { subject: "Memory", score: 88 },
      { subject: "Coordination", score: 91 },
      { subject: "Decisions", score: 94 },
      { subject: "Escalation", score: 87 },
    ],
    weeklyScores: [
      { day: "Mon", score: 89 }, { day: "Tue", score: 90 }, { day: "Wed", score: 91 },
      { day: "Thu", score: 91 }, { day: "Fri", score: 92 }, { day: "Sat", score: 92 }, { day: "Sun", score: 92 },
    ],
    recentDecisions: [
      { action: "Generated script — 2,400 word finance", outcome: "win", confidence: 0.93, at: "Mar 16" },
      { action: "Council sign-off received", outcome: "win", confidence: 0.97, at: "Mar 15" },
      { action: "Rewrote intro after Zeus feedback", outcome: "win", confidence: 0.88, at: "Mar 14" },
    ],
  },
  {
    id: "vera",
    name: "Vera",
    role: "QA & Standards",
    version: "1.2.1",
    status: "active",
    score: 78,
    trend: "down",
    trendDelta: "-3",
    runsLast7d: 63,
    successRate: 84.2,
    avgLatencyMs: 420,
    lastRunAt: "45 min ago",
    color: ERROR,
    dimensions: [
      { subject: "Accuracy", score: 82 },
      { subject: "Speed", score: 98 },
      { subject: "Memory", score: 62 },
      { subject: "Coordination", score: 78 },
      { subject: "Decisions", score: 76 },
      { subject: "Escalation", score: 80 },
    ],
    weeklyScores: [
      { day: "Mon", score: 82 }, { day: "Tue", score: 81 }, { day: "Wed", score: 80 },
      { day: "Thu", score: 79 }, { day: "Fri", score: 78 }, { day: "Sat", score: 78 }, { day: "Sun", score: 78 },
    ],
    recentDecisions: [
      { action: "Flagged audio sync issue — step 11", outcome: "miss", confidence: 0.68, at: "Mar 16" },
      { action: "Cleared visual QA — 3 videos", outcome: "win", confidence: 0.91, at: "Mar 15" },
      { action: "Standards gate: AI detection CLEAR", outcome: "win", confidence: 0.87, at: "Mar 15" },
    ],
  },
];

// Aggregate weekly comparison for all agents
const ALL_WEEKLY = AGENTS[0].weeklyScores.map((d, i) => {
  const obj: Record<string, string | number> = { day: d.day };
  AGENTS.forEach((a) => { obj[a.name] = a.weeklyScores[i].score; });
  return obj;
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusDot(status: Agent["status"]) {
  const map = { active: SUCCESS, idle: TEXT_TERTIARY, error: ERROR } as const;
  return <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: map[status] }} />;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 shadow-xl text-xs max-w-xs">
      <p className="font-dm-mono text-text-tertiary mb-1 tracking-wider">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="font-dm-mono text-text-secondary">{p.name}</span>
          <span className="font-syne font-bold text-text-primary ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Component: Agent Detail Card ──────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);
  const TrendIcon = agent.trend === "up" ? TrendingUp : agent.trend === "down" ? TrendingDown : Minus;
  const trendColor = agent.trend === "up" ? SUCCESS : agent.trend === "down" ? ERROR : TEXT_TERTIARY;

  const outcomeIcon = (o: "win" | "miss" | "pending") => {
    if (o === "win") return <CheckCircle size={12} style={{ color: SUCCESS }} />;
    if (o === "miss") return <XCircle size={12} style={{ color: ERROR }} />;
    return <AlertTriangle size={12} style={{ color: WARNING }} />;
  };

  const scoreColor = agent.score >= 90 ? SUCCESS : agent.score >= 80 ? AMBER : agent.score >= 70 ? WARNING : ERROR;

  const formatLatency = (ms: number) =>
    ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div
      className="border border-bg-border rounded-xl overflow-hidden transition-colors duration-200 hover:border-bg-border-hover"
      style={{ background: "var(--bg-surface)", borderLeft: `3px solid ${agent.color}` }}
    >
      {/* Summary row */}
      <button
        className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-bg-elevated transition-colors duration-150"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Score ring */}
        <div className="relative shrink-0">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke={BORDER} strokeWidth="3" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke={scoreColor} strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 20 * agent.score / 100} ${2 * Math.PI * 20}`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center font-syne font-bold text-[11px]"
            style={{ color: scoreColor }}
          >
            {agent.score}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {statusDot(agent.status)}
            <span className="font-syne font-bold text-sm text-text-primary">{agent.name}</span>
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase">
              {agent.role}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="font-dm-mono text-[9px] text-text-tertiary">v{agent.version}</span>
            <span className="font-dm-mono text-[9px] text-text-tertiary">{agent.runsLast7d} runs/7d</span>
            <span className="font-dm-mono text-[9px] text-text-tertiary">{agent.successRate}% success</span>
            <span className="font-dm-mono text-[9px] text-text-tertiary">
              avg {formatLatency(agent.avgLatencyMs)}
            </span>
          </div>
        </div>

        {/* Trend + expand */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div
            className="flex items-center gap-1 text-[10px] font-dm-mono px-2 py-0.5 rounded-full"
            style={{ color: trendColor, background: `${trendColor}15` }}
          >
            <TrendIcon size={9} />
            {agent.trendDelta}
          </div>
          {expanded
            ? <ChevronDown size={14} className="text-text-tertiary" />
            : <ChevronRight size={14} className="text-text-tertiary" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-bg-border px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Radar */}
          <div>
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-3">
              Performance Dimensions
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={agent.dimensions}>
                <PolarGrid stroke={BORDER} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: TEXT_TERTIARY, fontSize: 9, fontFamily: "DM Mono" }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name={agent.name}
                  dataKey="score"
                  stroke={agent.color}
                  fill={agent.color}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly score line */}
          <div>
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-3">
              Score This Week
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={agent.weeklyScores} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: TEXT_TERTIARY, fontSize: 9, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fill: TEXT_TERTIARY, fontSize: 9, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="score" name="Score"
                  stroke={agent.color} strokeWidth={2}
                  dot={{ r: 3, fill: agent.color }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Recent decisions */}
            <div className="mt-4">
              <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-2">
                Recent Decisions
              </div>
              <div className="space-y-1.5">
                {agent.recentDecisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 group">
                    <div className="mt-0.5 shrink-0">{outcomeIcon(d.outcome)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-dm-mono text-[10px] text-text-secondary line-clamp-1">
                        {d.action}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-dm-mono text-[9px] text-text-tertiary">{d.at}</div>
                      <div className="font-dm-mono text-[9px]" style={{ color: agent.color }}>
                        {Math.round(d.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AgentAnalyticsPage() {
  const [view, setView] = useState<"cards" | "compare">("cards");

  const avgScore = Math.round(AGENTS.reduce((s, a) => s + a.score, 0) / AGENTS.length);
  const activeCount = AGENTS.filter((a) => a.status === "active").length;
  const topAgent = [...AGENTS].sort((a, b) => b.score - a.score)[0];

  return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />

      <div className="flex-1 p-6 space-y-8 max-w-[1200px] mx-auto w-full">

        {/* Header */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <p className="font-dm-mono text-[10px] text-accent-primary tracking-[3px] uppercase">
              Intelligence Layer
            </p>
            <h1 className="font-syne font-bold text-2xl text-text-primary mt-1">
              Agent Performance
            </h1>
            <p className="font-dm-mono text-xs text-text-tertiary mt-1">
              Updated weekly · {activeCount} agents active right now
            </p>
          </div>
          <div className="flex items-center gap-1 bg-bg-surface border border-bg-border rounded-lg p-1">
            {(["cards", "compare"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md font-dm-mono text-[10px] tracking-widest uppercase transition-all duration-150
                  ${view === v
                    ? "bg-accent-primary text-text-inverse font-bold"
                    : "text-text-tertiary hover:text-text-secondary"
                  }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-2">Avg Team Score</div>
            <div className="font-syne font-bold text-3xl" style={{ color: AMBER }}>{avgScore}</div>
            <div className="font-dm-mono text-[10px] text-text-secondary mt-1">/ 100</div>
          </div>
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-2">Active Agents</div>
            <div className="font-syne font-bold text-3xl" style={{ color: SUCCESS }}>{activeCount}</div>
            <div className="font-dm-mono text-[10px] text-text-secondary mt-1">/ {AGENTS.length} total</div>
          </div>
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-2 flex items-center gap-1">
              <Award size={10} /> Top Agent
            </div>
            <div className="font-syne font-bold text-xl" style={{ color: topAgent.color }}>{topAgent.name}</div>
            <div className="font-dm-mono text-[10px] text-text-secondary mt-1">Score {topAgent.score}</div>
          </div>
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-2 flex items-center gap-1">
              <Cpu size={10} /> Total Runs/7d
            </div>
            <div className="font-syne font-bold text-3xl text-text-primary">
              {AGENTS.reduce((s, a) => s + a.runsLast7d, 0)}
            </div>
            <div className="font-dm-mono text-[10px] text-text-secondary mt-1">across all agents</div>
          </div>
        </div>

        {view === "cards" ? (
          /* Cards view — expandable agent cards */
          <div className="space-y-3">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          /* Compare view — all agents on the same chart */
          <div className="space-y-6">
            {/* Weekly score comparison */}
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
              <div className="mb-4">
                <div className="font-syne font-bold text-base text-text-primary">Weekly Score Comparison</div>
                <div className="font-dm-mono text-[10px] text-text-tertiary tracking-wider mt-0.5">
                  All agents · daily performance score
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={ALL_WEEKLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono", paddingTop: 12, color: TEXT_TERTIARY }} iconType="circle" iconSize={8} />
                  {AGENTS.map((a) => (
                    <Line
                      key={a.id}
                      type="monotone"
                      dataKey={a.name}
                      stroke={a.color}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Success rate bar chart */}
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
              <div className="mb-4">
                <div className="font-syne font-bold text-base text-text-primary">Success Rate by Agent</div>
                <div className="font-dm-mono text-[10px] text-text-tertiary tracking-wider mt-0.5">
                  Last 7 days · % of runs without errors
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={AGENTS.map((a) => ({ name: a.name, rate: a.successRate, color: a.color }))}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 100]} tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" name="Success Rate %" radius={[4, 4, 0, 0]}>
                    {AGENTS.map((a) => (
                      <Cell key={a.id} fill={a.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Version registry table */}
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch size={14} className="text-text-tertiary" />
                <div>
                  <div className="font-syne font-bold text-base text-text-primary">Agent Version Registry</div>
                  <div className="font-dm-mono text-[10px] text-text-tertiary tracking-wider">
                    Active versions · Oracle evaluation status
                  </div>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bg-border">
                    {["Agent", "Version", "Status", "Success Rate", "Score", "Oracle Verdict"].map((h) => (
                      <th key={h} className="pb-2.5 text-left font-dm-mono text-[9px] tracking-widest uppercase text-text-tertiary pl-2 first:pl-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((a) => {
                    const scoreColor = a.score >= 90 ? SUCCESS : a.score >= 80 ? AMBER : a.score >= 70 ? WARNING : ERROR;
                    return (
                      <tr key={a.id} className="border-b border-bg-border hover:bg-bg-elevated transition-colors duration-150">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                            <span className="font-syne font-bold text-text-primary text-[11px]">{a.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pl-2">
                          <span className="font-dm-mono text-[10px] text-text-secondary">v{a.version}</span>
                        </td>
                        <td className="py-3 pl-2">
                          <span
                            className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded-full tracking-widest uppercase"
                            style={{
                              color: a.status === "active" ? SUCCESS : a.status === "error" ? ERROR : TEXT_TERTIARY,
                              background: `${a.status === "active" ? SUCCESS : a.status === "error" ? ERROR : TEXT_TERTIARY}18`,
                            }}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 pl-2">
                          <span className="font-dm-mono text-[10px] text-text-secondary">{a.successRate}%</span>
                        </td>
                        <td className="py-3 pl-2">
                          <span className="font-syne font-bold text-[11px]" style={{ color: scoreColor }}>{a.score}</span>
                        </td>
                        <td className="py-3 pl-2">
                          <span
                            className="font-dm-mono text-[9px] px-1.5 py-0.5 rounded-full tracking-widest uppercase"
                            style={{ color: SUCCESS, background: `${SUCCESS}18` }}
                          >
                            PROMOTE
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
