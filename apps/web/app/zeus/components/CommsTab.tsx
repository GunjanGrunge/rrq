"use client";

import { useEffect, useState } from "react";
import type { CouncilSession, AgentVote } from "@/lib/council/types";

const VERDICT_COLOR: Record<string, string> = {
  APPROVED: "text-accent-success border-accent-success",
  FLAG: "text-accent-primary border-accent-primary",
  REJECT: "text-accent-error border-accent-error",
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: "bg-accent-success/20 text-accent-success border-accent-success/40",
  DEFERRED: "bg-accent-primary/20 text-accent-primary border-accent-primary/40",
  DEADLOCKED: "bg-accent-error/20 text-accent-error border-accent-error/40",
  IN_PROGRESS: "bg-text-tertiary/20 text-text-tertiary border-text-tertiary/40",
  PENDING: "bg-text-tertiary/20 text-text-tertiary border-text-tertiary/40",
};

function VoteBadge({ vote }: { vote: AgentVote }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="relative">
      <button
        className={`font-dm-mono text-[10px] px-2 py-0.5 border tracking-widest ${VERDICT_COLOR[vote.verdict] ?? "text-text-tertiary border-bg-border"}`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        {vote.agentId.toUpperCase()}
      </button>
      {showTip && (
        <div className="absolute bottom-full left-0 mb-1 z-10 bg-bg-elevated border border-bg-border p-2 w-48 shadow-lg">
          <p className="font-dm-mono text-[9px] text-text-secondary leading-relaxed">
            {vote.rationale}
          </p>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: CouncilSession }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-bg-surface border border-bg-border hover:border-accent-primary/40 transition-colors duration-200">
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-syne text-sm text-text-primary font-bold truncate">
              {session.topic}
            </div>
            <div className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
              {new Date(session.createdAt).toLocaleString()}
            </div>
          </div>
          <span
            className={`font-dm-mono text-[10px] px-2 py-0.5 border shrink-0 ${STATUS_COLOR[session.status] ?? "text-text-tertiary border-bg-border"}`}
          >
            {session.status}
          </span>
        </div>

        {/* Vote badges row */}
        {session.votes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {session.votes.map((v) => (
              <VoteBadge key={v.agentId} vote={v} />
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-bg-border space-y-3">
          {/* Deadlock card */}
          {session.status === "DEADLOCKED" && session.deadlockReason && (
            <div className="bg-accent-error/10 border border-accent-error/30 p-3 mt-3">
              <div className="font-dm-mono text-[10px] text-accent-error tracking-widest uppercase mb-1">
                Deadlock Detected
              </div>
              <p className="font-dm-mono text-[11px] text-text-secondary leading-relaxed">
                {session.deadlockReason}
              </p>
            </div>
          )}

          {/* The Line synthesis */}
          {session.theLineSynthesis && (
            <div className="mt-3">
              <div className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase mb-1">
                The Line
              </div>
              <p className="font-lora text-xs text-text-secondary leading-relaxed">
                {session.theLineSynthesis}
              </p>
            </div>
          )}

          {/* Zeus verdict */}
          {session.zeusVerdict && (
            <div>
              <div className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase mb-1">
                Zeus
              </div>
              <p className="font-dm-mono text-xs text-text-primary leading-relaxed">
                {session.zeusVerdict}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CommsTab() {
  const [sessions, setSessions] = useState<CouncilSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/council/status");
        if (res.ok) {
          const data = await res.json() as { sessions?: CouncilSession[] };
          setSessions(data.sessions ?? []);
        }
      } catch {
        // Table not provisioned — empty state
      } finally {
        setLoading(false);
      }
    }
    void load();

    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="font-dm-mono text-xs text-accent-primary tracking-widest uppercase mb-4">
        Council Sessions
      </div>

      {loading ? (
        <div className="font-dm-mono text-[10px] text-text-tertiary">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="font-dm-mono text-xs text-text-tertiary mb-2">
            No council sessions yet
          </div>
          <div className="font-dm-mono text-[10px] text-text-tertiary/60 max-w-xs">
            Council fires automatically after Quality Gate passes — before audio and video production begins.
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {sessions.map((s) => (
            <SessionCard key={s.sessionId} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
