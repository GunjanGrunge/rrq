"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Eye, Users, Clock,
  DollarSign, MousePointerClick, Play, RefreshCw, Minus,
  Youtube, AlertCircle, Loader2,
} from "lucide-react";
import Link from "next/link";
import AnalyticsNav from "@/components/analytics/AnalyticsNav";
import SetTargetModal from "@/components/analytics/SetTargetModal";

// ─── API response types ─────────────────────────────────────────────────────

interface DailyMetric {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
}

interface TopVideo {
  videoId: string;
  title: string;
  views: number;
  watchTimeMinutes: number;
  averageViewDuration: number;
  clickThroughRate: number | null;
  averageViewPercentage: number;
  estimatedRevenue: number | null;
}

interface AnalyticsData {
  connected: boolean;
  channelStats?: {
    viewCount: number;
    subscriberCount: number;
    videoCount: number;
  };
  analytics?: {
    dailyMetrics: DailyMetric[];
    totalViews: number;
    totalWatchHours: number;
    totalSubscribers: number;
    subscribersGained: number;
    estimatedRevenue: number | null;
    rpm: number | null;
    cpm: number | null;
  };
  topVideos?: TopVideo[];
  monetisationProgress?: {
    subscriberCount: number;
    watchHours: number;
    subscriberGoal: number;
    watchHourGoal: number;
  };
}

interface AdSenseData {
  connected: boolean;
  accountId?: string | null;
  currentMonthEstimated?: number | null;
  lastMonthFinalised?: number | null;
  monthlyHistory?: Array<{ month: string; estimated: number | null; finalised: number | null }>;
  paymentThreshold?: number;
  currentBalance?: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const AMBER = "#f5a623";
const AMBER_DIM = "#f5a62340";
const SUCCESS = "#22c55e";
const INFO = "#3b82f6";
const ERROR = "#ef4444";
const SURFACE = "#111111";
const BORDER = "#222222";
const TEXT_TERTIARY = "#6b6560";

type TrendDir = "up" | "down" | "neutral";

function formatK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatHours(minutes: number) {
  return Math.round(minutes / 60);
}

// Format YYYY-MM-DD from Analytics API to readable "Mar 17"
function formatDate(ymd: string) {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  trendDir,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendDir?: TrendDir;
  icon: React.ElementType;
  accent?: string;
}) {
  const trendColor =
    trendDir === "up" ? SUCCESS : trendDir === "down" ? ERROR : TEXT_TERTIARY;
  const TrendIcon =
    trendDir === "up" ? TrendingUp : trendDir === "down" ? TrendingDown : Minus;

  return (
    <div className="bg-bg-surface border border-bg-border rounded-xl p-5 flex flex-col gap-3 hover:border-bg-border-hover transition-all duration-200">
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent ?? AMBER}18`, border: `1px solid ${accent ?? AMBER}30` }}
        >
          <Icon size={16} style={{ color: accent ?? AMBER }} />
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 text-[10px] font-dm-mono px-2 py-1 rounded-full"
            style={{ color: trendColor, background: `${trendColor}15` }}
          >
            <TrendIcon size={10} />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="font-syne font-bold text-2xl text-text-primary leading-none">{value}</div>
        <div className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase mt-1">{label}</div>
        {sub && <div className="font-dm-mono text-[10px] text-text-secondary mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub, lastUpdated }: { title: string; sub?: string; lastUpdated?: string }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="font-syne font-bold text-base text-text-primary">{title}</h2>
        {sub && <p className="font-dm-mono text-[10px] text-text-tertiary tracking-wider mt-0.5">{sub}</p>}
      </div>
      {lastUpdated && (
        <div className="flex items-center gap-1.5 text-[10px] font-dm-mono text-text-tertiary">
          <RefreshCw size={10} />
          {lastUpdated}
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-dm-mono text-text-tertiary mb-1 tracking-wider">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-dm-mono text-text-secondary capitalize">{p.name}</span>
          <span className="font-syne font-bold text-text-primary ml-auto">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Connect gate ────────────────────────────────────────────────────────────

function ConnectGate() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="max-w-md w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-bg-border"
          style={{ background: "var(--bg-surface)" }}
        >
          <Youtube size={28} style={{ color: AMBER }} />
        </div>
        <h2 className="font-syne font-bold text-xl text-text-primary mb-3">
          Connect your YouTube channel
        </h2>
        <p className="font-dm-mono text-xs text-text-secondary leading-relaxed mb-8">
          Sign in with Google to pull live channel stats, analytics, and revenue data directly from your account.
        </p>
        <a
          href="/api/youtube/connect"
          className="inline-flex items-center gap-2 bg-accent-primary text-bg-base font-dm-mono text-xs font-bold px-6 py-3 rounded-lg hover:bg-accent-primary/90 transition-colors"
        >
          <Youtube size={14} />
          Connect YouTube Account
        </a>
        <p className="font-dm-mono text-[10px] text-text-tertiary mt-4 leading-relaxed">
          Read-only access. We never post or modify your channel.
        </p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-8 max-w-[1200px] mx-auto w-full animate-pulse">
      <div className="flex items-start justify-between pt-2">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-bg-border rounded" />
          <div className="h-7 w-52 bg-bg-border rounded" />
          <div className="h-3 w-44 bg-bg-border rounded" />
        </div>
        <div className="h-9 w-36 bg-bg-border rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-bg-surface border border-bg-border rounded-xl p-5 h-28" />
        ))}
      </div>
      <div className="bg-bg-surface border border-bg-border rounded-xl p-5 h-64" />
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="max-w-sm w-full text-center">
        <AlertCircle size={32} className="mx-auto mb-4 text-text-tertiary" />
        <p className="font-dm-mono text-sm text-text-secondary mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="font-dm-mono text-xs text-accent-primary hover:text-accent-primary/80 transition-colors border border-accent-primary/30 px-4 py-2 rounded-lg"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type DateRange = "7d" | "28d" | "90d";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChannelAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("28d");
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [adsenseData, setAdsenseData] = useState<AdSenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ytRes, adsRes] = await Promise.all([
        fetch("/api/youtube/analytics"),
        fetch("/api/youtube/adsense"),
      ]);

      if (!ytRes.ok) throw new Error("Failed to fetch analytics");

      const yt: AnalyticsData = await ytRes.json();
      setData(yt);

      if (adsRes.ok) {
        const ads: AdSenseData = await adsRes.json();
        setAdsenseData(ads);
      }

      setLastFetched(
        new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />
      <LoadingSkeleton />
    </div>
  );

  if (error) return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />
      <ErrorState message={error} onRetry={fetchData} />
    </div>
  );

  if (!data?.connected) return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />
      <ConnectGate />
    </div>
  );

  // ── Data shortcuts ─────────────────────────────────────────────────────────

  const stats = data.channelStats!;
  const analytics = data.analytics!;
  const topVideos = data.topVideos ?? [];
  const monetisation = data.monetisationProgress;
  const adsEnabled = adsenseData?.connected && adsenseData?.accountId != null;

  // Build chart-friendly daily data
  const dailyChart = analytics.dailyMetrics.map((d) => ({
    date: formatDate(d.date),
    views: d.views,
    subs: d.subscribersGained,
    watchHours: Math.round(d.estimatedMinutesWatched / 60),
  }));

  // AdSense monthly history for bar chart
  const adsenseMonthly = adsenseData?.monthlyHistory ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />

      <div className="flex-1 p-6 space-y-8 max-w-[1200px] mx-auto w-full">

        {/* Header */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <p className="font-dm-mono text-[10px] text-accent-primary tracking-[3px] uppercase">
              Channel Intelligence
            </p>
            <h1 className="font-syne font-bold text-2xl text-text-primary mt-1">
              Channel Analytics
            </h1>
            <p className="font-dm-mono text-xs text-text-tertiary mt-1">
              {stats.videoCount} videos · Last sync: {lastFetched}
            </p>
          </div>

          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-bg-surface border border-bg-border rounded-lg p-1">
            {(["7d", "28d", "90d"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-md font-dm-mono text-[10px] tracking-widest uppercase transition-all duration-150 ${
                  dateRange === r
                    ? "bg-accent-primary text-bg-base font-bold"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Views"
            value={formatK(analytics.totalViews)}
            icon={Eye}
          />
          <KpiCard
            label="Subscribers"
            value={formatK(stats.subscriberCount)}
            sub={`+${analytics.subscribersGained.toLocaleString()} this period`}
            icon={Users}
            accent={SUCCESS}
          />
          <KpiCard
            label="Watch Hours"
            value={`${formatK(analytics.totalWatchHours)}h`}
            sub={monetisation ? `Goal: ${(monetisation.watchHourGoal).toLocaleString()}h` : undefined}
            icon={Clock}
            accent={INFO}
          />
          <KpiCard
            label="Est. Revenue"
            value={analytics.estimatedRevenue != null ? `$${analytics.estimatedRevenue.toFixed(2)}` : "—"}
            sub={analytics.estimatedRevenue != null ? "This period" : "Not monetised"}
            icon={DollarSign}
            accent={SUCCESS}
          />
        </div>

        {/* Views + Subscribers area chart */}
        {dailyChart.length > 0 && (
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <SectionHeader
              title="Views & Subscriber Growth"
              sub="Daily performance — last 28 days"
              lastUpdated={lastFetched ?? undefined}
            />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AMBER} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SUCCESS} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={SUCCESS} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="date" tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono", paddingTop: 12, color: TEXT_TERTIARY }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="views" stroke={AMBER} strokeWidth={2} fill="url(#gradViews)" name="Views" dot={false} activeDot={{ r: 4, fill: AMBER }} />
                <Area type="monotone" dataKey="subs" stroke={SUCCESS} strokeWidth={2} fill="url(#gradSubs)" name="Subscribers" dot={false} activeDot={{ r: 4, fill: SUCCESS }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Watch hours + RPM side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Watch hours */}
          {dailyChart.length > 0 && (
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
              <SectionHeader title="Watch Hours" sub="Daily hours — last 28 days" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="watchHours" name="Watch Hours" fill={INFO} radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
              {monetisation && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-dm-mono text-[10px] text-text-tertiary tracking-wider">Progress to {monetisation.watchHourGoal.toLocaleString()}h</span>
                    <span className="font-dm-mono text-[10px] text-text-secondary">{analytics.totalWatchHours.toLocaleString()} / {monetisation.watchHourGoal.toLocaleString()}h</span>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((analytics.totalWatchHours / monetisation.watchHourGoal) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${INFO}, ${AMBER})`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RPM / CPM */}
          {(analytics.rpm != null || analytics.cpm != null) ? (
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
              <SectionHeader title="RPM & CPM" sub="Revenue per 1,000 views" />
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-bg-elevated border border-bg-border rounded-lg px-4 py-5 text-center">
                  <div className="font-syne font-bold text-2xl text-text-primary">
                    {analytics.rpm != null ? `$${analytics.rpm.toFixed(2)}` : "—"}
                  </div>
                  <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider uppercase mt-1">RPM</div>
                </div>
                <div className="bg-bg-elevated border border-bg-border rounded-lg px-4 py-5 text-center">
                  <div className="font-syne font-bold text-2xl text-text-primary">
                    {analytics.cpm != null ? `$${analytics.cpm.toFixed(2)}` : "—"}
                  </div>
                  <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider uppercase mt-1">CPM</div>
                </div>
              </div>
              <p className="font-dm-mono text-[9px] text-text-tertiary mt-4 text-center">
                Based on last 28 days
              </p>
            </div>
          ) : (
            <div className="bg-bg-surface border border-bg-border rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3">
              <DollarSign size={24} className="text-text-tertiary" />
              <div>
                <p className="font-syne font-bold text-sm text-text-primary">Revenue data unavailable</p>
                <p className="font-dm-mono text-[10px] text-text-tertiary mt-1">
                  Available once your channel is monetised via YPP
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Top Videos table */}
        {topVideos.length > 0 && (
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <SectionHeader title="Top Performing Videos" sub="Ranked by views · Last 28 days" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bg-border">
                    {["Video", "Views", "Avg %", "Watch Time", "Revenue"].map((h) => (
                      <th
                        key={h}
                        className="pb-2.5 text-left font-dm-mono text-[9px] tracking-widest uppercase text-text-tertiary first:pl-0 pl-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topVideos.map((v, i) => {
                    const retentionColor =
                      v.averageViewPercentage >= 50 ? SUCCESS
                      : v.averageViewPercentage >= 35 ? AMBER
                      : ERROR;
                    return (
                      <tr
                        key={v.videoId}
                        className="border-b border-bg-border hover:bg-bg-elevated transition-colors duration-150"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="font-dm-mono text-[10px] text-text-tertiary w-4 shrink-0">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <a
                              href={`https://www.youtube.com/watch?v=${v.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-5 rounded bg-bg-elevated border border-bg-border flex items-center justify-center shrink-0 hover:border-accent-primary/40 transition-colors"
                            >
                              <Play size={8} className="text-text-tertiary" />
                            </a>
                            <span className="font-syne text-[11px] text-text-primary leading-tight line-clamp-1 max-w-[200px]">
                              {v.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pl-4">
                          <span className="font-dm-mono text-text-secondary">{formatK(v.views)}</span>
                        </td>
                        <td className="py-3 pl-4">
                          <div className="flex items-center gap-2">
                            <span className="font-dm-mono font-bold" style={{ color: retentionColor }}>
                              {v.averageViewPercentage.toFixed(1)}%
                            </span>
                            <div className="w-14 h-1 bg-bg-elevated rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(v.averageViewPercentage, 100)}%`, background: retentionColor }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pl-4">
                          <span className="font-dm-mono text-text-secondary">
                            {v.watchTimeMinutes >= 60
                              ? `${(v.watchTimeMinutes / 60).toFixed(1)}h`
                              : `${v.watchTimeMinutes.toFixed(0)}m`}
                          </span>
                        </td>
                        <td className="py-3 pl-4">
                          <span className="font-dm-mono text-text-secondary">
                            {v.estimatedRevenue != null ? `$${v.estimatedRevenue.toFixed(2)}` : "—"}
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

        {/* AdSense section */}
        {adsEnabled && adsenseData && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-bg-border" />
              <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[3px] uppercase">AdSense</span>
              <div className="h-px flex-1 bg-bg-border" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Est. This Month"
                value={adsenseData.currentMonthEstimated != null ? `$${adsenseData.currentMonthEstimated.toFixed(2)}` : "—"}
                sub="Estimated earnings"
                icon={DollarSign}
                accent={AMBER}
              />
              <KpiCard
                label="Last Month"
                value={adsenseData.lastMonthFinalised != null ? `$${adsenseData.lastMonthFinalised.toFixed(2)}` : "—"}
                sub="Finalised"
                icon={DollarSign}
                accent={SUCCESS}
              />
              <KpiCard
                label="Current Balance"
                value={adsenseData.currentBalance != null ? `$${adsenseData.currentBalance.toFixed(2)}` : "—"}
                sub={adsenseData.paymentThreshold ? `Threshold: $${adsenseData.paymentThreshold}` : undefined}
                icon={DollarSign}
                accent={INFO}
              />
              <KpiCard
                label="RPM"
                value={analytics.rpm != null ? `$${analytics.rpm.toFixed(2)}` : "—"}
                sub="Per 1,000 views"
                icon={MousePointerClick}
                accent={AMBER}
              />
            </div>

            {adsenseMonthly.length > 0 && (
              <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
                <SectionHeader title="AdSense Earnings" sub="Monthly estimated + finalised revenue" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={adsenseMonthly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono", paddingTop: 8, color: TEXT_TERTIARY }} iconType="circle" iconSize={8} />
                    <Bar dataKey="estimated" name="Estimated" fill={AMBER} radius={[3, 3, 0, 0]} fillOpacity={0.7} />
                    <Bar dataKey="finalised" name="Finalised" fill={SUCCESS} radius={[3, 3, 0, 0]} fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Monetisation mission progress */}
        {monetisation && (
          <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="font-syne font-bold text-base text-text-primary">Monetisation Mission</h2>
                <p className="font-dm-mono text-[10px] text-text-tertiary tracking-wider mt-0.5">YouTube Partner Program requirements</p>
              </div>
              <button
                onClick={() => setTargetModalOpen(true)}
                className="flex items-center gap-1.5 font-dm-mono text-[10px] tracking-widest uppercase font-bold px-3 py-1.5 rounded-lg border transition-all duration-150 hover:bg-accent-primary/10"
                style={{ borderColor: `${AMBER}50`, color: AMBER }}
              >
                <span style={{ fontSize: 11 }}>✦</span>
                Set Target
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  label: "Subscribers",
                  current: monetisation.subscriberCount,
                  target: monetisation.subscriberGoal,
                  unit: "",
                  color: AMBER,
                },
                {
                  label: "Watch Hours",
                  current: analytics.totalWatchHours,
                  target: monetisation.watchHourGoal,
                  unit: "h",
                  color: INFO,
                },
              ].map(({ label, current, target, unit, color }) => {
                const pct = Math.min((current / target) * 100, 100);
                return (
                  <div key={label} className="bg-bg-elevated border border-bg-border rounded-xl p-4">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase">{label}</div>
                        <div className="font-syne font-bold text-2xl mt-0.5" style={{ color }}>
                          {current.toLocaleString()}{unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-dm-mono text-[9px] text-text-tertiary">Goal</div>
                        <div className="font-syne font-bold text-lg text-text-secondary">
                          {target.toLocaleString()}{unit}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-bg-border rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}99, ${color})`,
                          boxShadow: `0 0 8px ${color}60`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="font-dm-mono text-[10px]" style={{ color }}>
                        {pct.toFixed(1)}% complete
                      </span>
                      <span className="font-dm-mono text-[10px] text-text-tertiary">
                        {(target - current).toLocaleString()}{unit} to go
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <SetTargetModal
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
      />
    </div>
  );
}
