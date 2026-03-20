"use client";

import { useEffect, useState } from "react";

interface JobCard {
  jobId: string;
  topic: string;
  niche: string;
  status: string;
  createdAt: string;
  councilVotes?: Array<{ agentId: string; verdict: string }>;
  retroOutcome?: "WIN_RECORD" | "MISS_RECORD";
}

const COLUMNS: Array<{ id: string; label: string; statuses: string[] }> = [
  { id: "briefed", label: "BRIEFED", statuses: ["pending", "briefed"] },
  { id: "council", label: "COUNCIL", statuses: ["council", "council_pending"] },
  {
    id: "production",
    label: "PRODUCTION",
    statuses: ["in_progress", "audio", "media", "av_sync"],
  },
  { id: "qa", label: "QA", statuses: ["vera_qa", "qa"] },
  { id: "done", label: "DONE", statuses: ["complete", "failed", "published"] },
];

const COUNCIL_AGENTS = ["rex", "zara", "aria", "qeon", "muse", "regum"];

function CouncilSignoffs({ votes }: { votes: Array<{ agentId: string; verdict: string }> }) {
  return (
    <div className="flex gap-1 mt-2">
      {COUNCIL_AGENTS.map((agentId) => {
        const vote = votes.find((v) => v.agentId === agentId);
        let color = "bg-bg-elevated";
        if (vote?.verdict === "APPROVED") color = "bg-accent-success";
        else if (vote?.verdict === "FLAG") color = "bg-accent-primary";
        else if (vote?.verdict === "REJECT") color = "bg-accent-error";

        return (
          <div
            key={agentId}
            className={`w-3 h-3 rounded-full ${color}`}
            title={`${agentId.toUpperCase()}: ${vote?.verdict ?? "pending"}`}
          />
        );
      })}
    </div>
  );
}

function Card({ job, columnId }: { job: JobCard; columnId: string }) {
  return (
    <div className="bg-bg-surface border border-bg-border p-3 hover:border-accent-primary/40 transition-colors duration-200">
      <div className="font-syne text-[11px] text-text-primary font-bold leading-tight mb-1 line-clamp-2">
        {job.topic}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-dm-mono text-[9px] text-accent-primary tracking-widest">
          {job.niche.toUpperCase().slice(0, 12)}
        </span>
        <span className="font-dm-mono text-[9px] text-text-tertiary">
          {new Date(job.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* COUNCIL column: sign-off indicators */}
      {columnId === "council" && job.councilVotes && (
        <CouncilSignoffs votes={job.councilVotes} />
      )}

      {/* DONE column: WIN/MISS retro badge */}
      {columnId === "done" && job.retroOutcome && (
        <div
          className={`font-dm-mono text-[9px] tracking-widest mt-2 ${
            job.retroOutcome === "WIN_RECORD" ? "text-accent-success" : "text-accent-error"
          }`}
        >
          {job.retroOutcome === "WIN_RECORD" ? "✦ WIN" : "✗ MISS"}
        </div>
      )}
    </div>
  );
}

export function KanbanTab() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/zeus/dashboard");
        if (res.ok) {
          const data = await res.json() as {
            jobQueue?: JobCard[];
          };
          setJobs(data.jobQueue ?? []);
        }
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

  const getColumnJobs = (column: (typeof COLUMNS)[number]) =>
    jobs.filter((j) => column.statuses.includes(j.status));

  return (
    <div className="p-6 overflow-x-auto flex-1">
      {loading ? (
        <div className="font-dm-mono text-[10px] text-text-tertiary">Loading…</div>
      ) : (
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map((col) => {
            const colJobs = getColumnJobs(col);
            return (
              <div key={col.id} className="w-52 flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
                    {col.label}
                  </span>
                  <span className="font-dm-mono text-[10px] text-text-tertiary">
                    {colJobs.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {colJobs.length === 0 ? (
                    <div className="border border-dashed border-bg-border p-3 text-center">
                      <span className="font-dm-mono text-[9px] text-text-tertiary">
                        Empty
                      </span>
                    </div>
                  ) : (
                    colJobs.map((job) => (
                      <Card key={job.jobId} job={job} columnId={col.id} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
