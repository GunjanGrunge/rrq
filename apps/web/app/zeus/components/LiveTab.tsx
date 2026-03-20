"use client";

import { useEffect, useState } from "react";
import type { RetroSession } from "@/lib/retro/types";
import type { VeraQAResult } from "@/lib/vera/types";

const RETRO_STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "text-accent-success",
  CONCERN: "text-accent-primary",
  EMERGENCY: "text-accent-error",
  MONITORING: "text-text-tertiary",
  COMPLETED: "text-text-tertiary",
};

const VERA_STATUS_COLOR: Record<string, string> = {
  CLEARED: "text-accent-success border-accent-success",
  WARNING: "text-accent-primary border-accent-primary",
  HOLD: "text-accent-error border-accent-error",
};

interface DashboardData {
  channelConfidence?: number;
  activeRetros?: RetroSession[];
  veraResults?: VeraQAResult[];
}

export function LiveTab() {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, retroRes] = await Promise.allSettled([
          fetch("/api/zeus/dashboard"),
          fetch("/api/retro/status"),
        ]);

        const next: DashboardData = {};

        if (dashRes.status === "fulfilled" && dashRes.value.ok) {
          const dash = await dashRes.value.json() as {
            dashboard?: { channelConfidence?: number; veraResults?: VeraQAResult[] };
          };
          next.channelConfidence = dash.dashboard?.channelConfidence;
          next.veraResults = dash.dashboard?.veraResults ?? [];
        }

        if (retroRes.status === "fulfilled" && retroRes.value.ok) {
          const retro = await retroRes.value.json() as { sessions?: RetroSession[] };
          next.activeRetros = retro.sessions ?? [];
        }

        setData(next);
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const confidence = data.channelConfidence ?? 97.5;

  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-8">
      {/* Autopilot confidence display */}
      <div>
        <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
          Autopilot Status
        </div>
        <div className="bg-bg-surface border border-bg-border p-6 flex items-center gap-6">
          <div>
            <div className="font-syne font-extrabold text-4xl text-accent-primary tracking-tight">
              {confidence.toFixed(1)}%
            </div>
            <div className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase mt-1">
              Autopilot Confidence
            </div>
          </div>
          <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-1000"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active retro monitoring */}
      <div>
        <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
          RRQ Retro Monitoring
        </div>

        {loading ? (
          <div className="font-dm-mono text-[10px] text-text-tertiary">Loading…</div>
        ) : !data.activeRetros?.length ? (
          <div className="font-dm-mono text-[10px] text-text-tertiary">
            No active retros — monitoring begins 48h after upload.
          </div>
        ) : (
          <div className="space-y-3">
            {data.activeRetros.map((retro) => (
              <div
                key={retro.sessionId}
                className="bg-bg-surface border border-bg-border p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-syne text-sm text-text-primary font-bold truncate max-w-xs">
                      {retro.topic}
                    </div>
                    <div
                      className={`font-dm-mono text-[10px] tracking-widest uppercase mt-0.5 ${RETRO_STATUS_COLOR[retro.status] ?? "text-text-tertiary"}`}
                    >
                      {retro.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-dm-mono text-xs text-text-primary">
                      Day {retro.currentDay}/7
                    </div>
                    {retro.targetHit && (
                      <div className="font-dm-mono text-[10px] text-accent-success">
                        TARGET HIT ✦
                      </div>
                    )}
                  </div>
                </div>

                {/* Day progress bar */}
                <div className="h-1 bg-bg-elevated rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-accent-primary rounded-full transition-all duration-500"
                    style={{ width: `${(retro.currentDay / 7) * 100}%` }}
                  />
                </div>

                {retro.day2Result && (
                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="font-dm-mono text-[9px] text-text-tertiary block">CTR</span>
                      <span className="font-dm-mono text-[11px] text-text-primary">
                        {retro.day2Result.ctr.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="font-dm-mono text-[9px] text-text-tertiary block">Impressions</span>
                      <span className="font-dm-mono text-[11px] text-text-primary">
                        {retro.day2Result.impressions.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-dm-mono text-[9px] text-text-tertiary block">Retention</span>
                      <span className="font-dm-mono text-[11px] text-text-primary">
                        {retro.day2Result.retention.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vera QA section */}
      <div>
        <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
          Vera QA — Last 3 Runs
        </div>

        {!data.veraResults?.length ? (
          <div className="font-dm-mono text-[10px] text-text-tertiary">
            No QA runs yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.veraResults.slice(0, 3).map((result) => (
              <div
                key={result.jobId}
                className="bg-bg-surface border border-bg-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-dm-mono text-[11px] text-text-primary">
                    Job: {result.jobId.slice(-8)}
                  </span>
                  <span
                    className={`font-dm-mono text-[10px] px-2 py-0.5 border ${VERA_STATUS_COLOR[result.status] ?? "text-text-tertiary border-bg-border"}`}
                  >
                    {result.status}
                  </span>
                </div>
                <div className="flex gap-3">
                  {result.domains.map((d) => (
                    <div key={d.domain} className="flex-1">
                      <div className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase mb-0.5">
                        {d.domain}
                      </div>
                      <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.verdict === "PASS" ? "bg-accent-success" : "bg-accent-error"}`}
                          style={{ width: `${d.score * 10}%` }}
                        />
                      </div>
                      <div className="font-dm-mono text-[9px] text-text-tertiary mt-0.5">
                        {d.score}/10
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
