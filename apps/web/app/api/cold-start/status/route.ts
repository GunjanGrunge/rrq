// GET /api/cold-start/status — poll sprint progress

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getColdStartSprint } from "@/lib/cold-start/trigger";

const PHASE_LABELS: Record<string, string> = {
  REX_SCAN: "Rex — Trend & Narrative Mapping",
  SNIPER_AUDIT: "SNIPER — Competitor & Market Intelligence",
  ORACLE_PATTERNS: "Oracle — Historical Pattern Analysis",
  THE_LINE_SYNTHESIS: "The Line — Content Gap Map",
  SHORTLIST: "First Video Shortlist",
  COUNCIL_SEEDING: "Council Index Seeding",
  COMPLETE: "Sprint Complete",
};

const PHASE_ORDER = [
  "REX_SCAN",
  "SNIPER_AUDIT",
  "ORACLE_PATTERNS",
  "THE_LINE_SYNTHESIS",
  "SHORTLIST",
  "COUNCIL_SEEDING",
  "COMPLETE",
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sprint = await getColdStartSprint(userId);

  if (!sprint) {
    return NextResponse.json({ sprint: null });
  }

  const phaseIndex = PHASE_ORDER.indexOf(sprint.currentPhase);

  return NextResponse.json({
    sprint: {
      status: sprint.status,
      currentPhase: sprint.currentPhase,
      currentPhaseLabel: PHASE_LABELS[sprint.currentPhase] ?? sprint.currentPhase,
      phaseIndex,
      totalPhases: PHASE_ORDER.length,
      progressPct: Math.round((phaseIndex / (PHASE_ORDER.length - 1)) * 100),
      sprintStartedAt: sprint.sprintStartedAt,
      sprintCompletedAt: sprint.sprintCompletedAt ?? null,
      rexScanSummary: sprint.rexScanSummary ?? null,
      sniperAuditSummary: sprint.sniperAuditSummary ?? null,
      // Only included when COMPLETE
      contentGapMap: sprint.status === "COMPLETE" ? (sprint.contentGapMap ?? []) : [],
      oversaturatedAngles: sprint.status === "COMPLETE" ? (sprint.oversaturatedAngles ?? []) : [],
      firstVideoShortlist: sprint.status === "COMPLETE" ? (sprint.firstVideoShortlist ?? []) : [],
      coldStartStrategy: sprint.status === "COMPLETE" ? (sprint.coldStartStrategy ?? null) : null,
      syntheticRecordsSeeded: sprint.syntheticRecordsSeeded ?? 0,
      error: sprint.error ?? null,
      selectedNiches: sprint.selectedNiches,
      channelMode: sprint.channelMode,
    },
  });
}
