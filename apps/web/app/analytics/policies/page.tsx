"use client";

import { useState } from "react";
import {
  Shield, AlertTriangle, Lock, Eye, ChevronDown, ChevronRight,
  Info, Edit3, Check, X, Clock, Zap, BookOpen, ToggleLeft, ToggleRight,
} from "lucide-react";
import AnalyticsNav from "@/components/analytics/AnalyticsNav";

// ─── Constants ─────────────────────────────────────────────────────────────

const AMBER = "#f5a623";
const SUCCESS = "#22c55e";
const INFO = "#3b82f6";
const ERROR = "#ef4444";
const WARNING = "#f59e0b";
const TEXT_TERTIARY = "#6b6560";

type WarnLevel = "ADVISORY" | "CAUTION" | "HIGH_IMPACT";

interface PolicyItem {
  key: string;
  label: string;
  description: string;
  value: string | number;
  unit?: string;
  type: "number" | "percent" | "days" | "readonly";
  min?: number;
  max?: number;
  warnLevel: WarnLevel;
  impact: string;
  tier: 1 | 2;
  agentId?: string;
  observerMode?: boolean;
  observerDaysLeft?: number;
}

// ─── Mock Policy Data ───────────────────────────────────────────────────────

const TIER1_POLICIES: PolicyItem[] = [
  {
    key: "score_weight_accuracy",
    label: "Accuracy Weight",
    description: "Proportion of the composite score driven by accuracy dimensions. Hard-coded to prevent gaming.",
    value: 0.35,
    type: "readonly",
    tier: 1,
    warnLevel: "HIGH_IMPACT",
    impact: "Changing this alters how Oracle ranks every agent decision retroactively.",
    agentId: "oracle",
  },
  {
    key: "score_weight_latency",
    label: "Latency Penalty Weight",
    description: "How much latency degrades an agent's score. Calibrated across 1,200 historical runs.",
    value: 0.12,
    type: "readonly",
    tier: 1,
    warnLevel: "HIGH_IMPACT",
    impact: "Adjusting latency weight changes the incentive for speed vs quality trade-offs.",
    agentId: "oracle",
  },
  {
    key: "trust_band_floor",
    label: "Trust Band Floor",
    description: "Minimum Oracle confidence score before a recommendation is surfaced to agents. Never user-modifiable.",
    value: 0.55,
    type: "readonly",
    tier: 1,
    warnLevel: "HIGH_IMPACT",
    impact: "Lowering this surfaces low-confidence guidance. Cannot be changed without code deploy.",
    agentId: "oracle",
  },
  {
    key: "hardcoded_zeus_spend_guard",
    label: "Zeus Daily Spend Guard",
    description: "Maximum % of account balance Zeus can allocate to ads in a single day. Hard limit.",
    value: 50,
    unit: "%",
    type: "readonly",
    tier: 1,
    warnLevel: "HIGH_IMPACT",
    impact: "This guard prevents runaway ad spend. Cannot be relaxed without a code deploy.",
    agentId: "zeus",
  },
];

const TIER2_POLICIES: PolicyItem[] = [
  {
    key: "oracle_promotion_threshold",
    label: "Agent Promotion Threshold",
    description: "Minimum composite score an agent version must maintain over the 7-day evaluation window before Oracle emits a PROMOTE verdict.",
    value: 80,
    type: "number",
    min: 60,
    max: 95,
    tier: 2,
    warnLevel: "CAUTION",
    impact: "Lowering this may promote underperforming agent versions. Raising it delays promotions on healthy agents.",
    agentId: "oracle",
  },
  {
    key: "oracle_rollback_trigger",
    label: "Rollback Trigger Score",
    description: "If an agent's score drops below this threshold during the 7-day window, Oracle emits ROLLBACK_REQUIRED.",
    value: 65,
    type: "number",
    min: 40,
    max: 80,
    tier: 2,
    warnLevel: "HIGH_IMPACT",
    impact: "Raising this makes Oracle more aggressive about rolling back. Lowering it tolerates more degradation.",
    agentId: "oracle",
  },
  {
    key: "oracle_eval_window_days",
    label: "Evaluation Window",
    description: "How many days Oracle collects decision data before emitting a version verdict. Minimum 3 days.",
    value: 7,
    unit: "days",
    type: "days",
    min: 3,
    max: 30,
    tier: 2,
    warnLevel: "CAUTION",
    impact: "Shorter windows reduce data confidence. Longer windows delay promotions but improve signal quality.",
    agentId: "oracle",
  },
  {
    key: "harvy_quality_gate_floor",
    label: "Harvy Quality Gate Floor",
    description: "Minimum traffic quality score (0–100) a campaign must achieve before Harvy allows budget scaling.",
    value: 40,
    type: "number",
    min: 20,
    max: 70,
    tier: 2,
    warnLevel: "CAUTION",
    impact: "Lowering this allows lower-quality traffic to scale. Raising it blocks more campaigns.",
    agentId: "harvy",
  },
  {
    key: "harvy_dr_decay_threshold",
    label: "Harvy DR Decay Threshold",
    description: "ROAS decay rate (%) that triggers Harvy's diminishing returns flag, leading to a 30% budget reduction.",
    value: 25,
    unit: "%",
    type: "percent",
    min: 10,
    max: 50,
    tier: 2,
    warnLevel: "HIGH_IMPACT",
    impact: "Lower threshold = more aggressive budget reductions on decaying campaigns.",
    agentId: "harvy",
  },
  {
    key: "rex_confidence_floor",
    label: "Rex Confidence Floor",
    description: "Minimum confidence score Rex must reach before surfacing a topic to Regum as a greenlight.",
    value: 72,
    type: "number",
    min: 50,
    max: 90,
    tier: 2,
    warnLevel: "ADVISORY",
    impact: "Lowering this increases Rex's topic volume at the cost of accuracy.",
    agentId: "rex",
    observerMode: true,
    observerDaysLeft: 9,
  },
  {
    key: "vera_qa_retry_limit",
    label: "Vera QA Retry Limit",
    description: "Maximum number of times Vera can request a re-render before escalating to Zeus.",
    value: 2,
    type: "number",
    min: 1,
    max: 4,
    tier: 2,
    warnLevel: "ADVISORY",
    impact: "Increasing this delays pipeline. Decreasing escalates more aggressively.",
    agentId: "vera",
  },
];

// ─── Warning Badge ───────────────────────────────────────────────────────────

function WarnBadge({ level }: { level: WarnLevel }) {
  const config = {
    ADVISORY: { color: INFO, label: "Advisory" },
    CAUTION: { color: WARNING, label: "Caution" },
    HIGH_IMPACT: { color: ERROR, label: "High Impact" },
  } as const;
  const { color, label } = config[level];
  return (
    <span
      className="font-dm-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-full"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  );
}

// ─── Tier 1 Policy Row ───────────────────────────────────────────────────────

function Tier1Row({ policy }: { policy: PolicyItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-bg-border last:border-0">
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-bg-elevated transition-colors duration-150"
        onClick={() => setOpen((o) => !o)}
      >
        <Lock size={12} className="text-text-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-syne text-[11px] text-text-secondary">{policy.label}</span>
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-wider">
              {policy.agentId} · Tier 1
            </span>
          </div>
        </div>
        <span className="font-syne font-bold text-sm text-text-tertiary mr-3">
          {typeof policy.value === "number"
            ? policy.value < 1
              ? policy.value.toFixed(2)
              : `${policy.value}${policy.unit ?? ""}`
            : policy.value}
        </span>
        {open ? <ChevronDown size={12} className="text-text-tertiary shrink-0" /> : <ChevronRight size={12} className="text-text-tertiary shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 bg-bg-elevated">
          <div className="ml-[28px] space-y-2">
            <p className="font-dm-mono text-[10px] text-text-secondary leading-relaxed">{policy.description}</p>
            <div className="flex items-start gap-2 bg-bg-elevated border border-error/20 rounded-lg px-3 py-2">
              <Lock size={10} className="text-accent-error mt-0.5 shrink-0" />
              <p className="font-dm-mono text-[9px] text-text-tertiary">
                This is a <span className="text-accent-error font-bold">Tier 1 hard-coded constant</span>. It cannot be modified without a code deploy. Changes require Oracle's evaluation and Zeus approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tier 2 Policy Row ───────────────────────────────────────────────────────

function Tier2Row({ policy, editable = false }: { policy: PolicyItem; editable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(policy.value));
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    // Simulate save
    setSaved(true);
    setConfirming(false);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    setEditing(false);
    setConfirming(false);
    setDraftValue(String(policy.value));
  };

  return (
    <div className="border-b border-bg-border last:border-0">
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-bg-elevated transition-colors duration-150"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Row icon */}
        {policy.observerMode ? (
          <Eye size={12} style={{ color: INFO }} className="shrink-0" />
        ) : editable ? (
          <Edit3 size={12} className="text-accent-primary shrink-0" />
        ) : (
          <Lock size={12} className="text-text-tertiary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-syne text-[11px] text-text-primary">{policy.label}</span>
            <WarnBadge level={policy.warnLevel} />
            {policy.observerMode && (
              <span
                className="font-dm-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                style={{ color: INFO, background: `${INFO}18`, border: `1px solid ${INFO}30` }}
              >
                Observer · {policy.observerDaysLeft}d left
              </span>
            )}
            {saved && (
              <span
                className="font-dm-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                style={{ color: SUCCESS, background: `${SUCCESS}18` }}
              >
                Saved
              </span>
            )}
          </div>
          <div className="font-dm-mono text-[9px] text-text-tertiary mt-0.5 tracking-wider">
            {policy.agentId} · Tier 2
          </div>
        </div>
        <span className="font-syne font-bold text-sm text-text-primary mr-3">
          {policy.value}{policy.unit ?? ""}
        </span>
        {open ? <ChevronDown size={12} className="text-text-tertiary shrink-0" /> : <ChevronRight size={12} className="text-text-tertiary shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 bg-bg-elevated">
          <div className="ml-[28px] space-y-3">
            <p className="font-dm-mono text-[10px] text-text-secondary leading-relaxed">{policy.description}</p>

            {/* Observer mode warning */}
            {policy.observerMode && (
              <div className="flex items-start gap-2 bg-bg-elevated border rounded-lg px-3 py-2" style={{ borderColor: `${INFO}30` }}>
                <Clock size={10} style={{ color: INFO }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-dm-mono text-[9px] font-bold" style={{ color: INFO }}>
                    Observer Mode — {policy.observerDaysLeft} days remaining
                  </p>
                  <p className="font-dm-mono text-[9px] text-text-tertiary mt-0.5">
                    This metric was recently activated. It is collecting signal for 14 days before influencing agent scoring. Oracle will evaluate signal quality and either promote it to active scoring or archive it.
                  </p>
                </div>
              </div>
            )}

            {/* Impact preview */}
            <div className="flex items-start gap-2 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
              <AlertTriangle size={10} style={{ color: WARNING }} className="mt-0.5 shrink-0" />
              <p className="font-dm-mono text-[9px] text-text-secondary">
                <span className="font-bold" style={{ color: WARNING }}>Oracle Impact Preview: </span>
                {policy.impact}
              </p>
            </div>

            {/* Edit controls */}
            {!editable ? (
              <div className="flex items-start gap-2 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
                <Lock size={10} className="text-text-tertiary mt-0.5 shrink-0" />
                <p className="font-dm-mono text-[9px] text-text-tertiary leading-relaxed">
                  This policy is <span className="text-text-secondary font-bold">managed by Oracle</span> and can only be tuned through Oracle's own evaluation engine. You can observe its current value and impact above.
                </p>
              </div>
            ) : !editing ? (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); setOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/40
                  text-accent-primary hover:bg-accent-primary hover:text-text-inverse transition-all duration-150 rounded-lg
                  font-dm-mono text-[10px] tracking-widest uppercase"
              >
                <Edit3 size={10} />
                Modify value
              </button>
            ) : (
              <div className="space-y-3">
                {/* Confirmation gate */}
                {confirming ? (
                  <div className="bg-bg-elevated border rounded-xl p-4 space-y-3" style={{ borderColor: `${ERROR}30` }}>
                    <div className="flex items-start gap-2">
                      <Zap size={12} style={{ color: ERROR }} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-syne font-bold text-[11px]" style={{ color: ERROR }}>
                          With power comes responsibility.
                        </p>
                        <p className="font-dm-mono text-[10px] text-text-secondary mt-1 leading-relaxed">
                          You are about to change <span className="text-text-primary font-bold">{policy.label}</span> from{" "}
                          <span style={{ color: AMBER }}>{policy.value}{policy.unit ?? ""}</span> to{" "}
                          <span style={{ color: SUCCESS }}>{draftValue}{policy.unit ?? ""}</span>.{" "}
                          This will immediately affect how <span className="text-text-primary">{policy.agentId}</span> operates.
                          Oracle will track this change in the policy audit log and evaluate impact over the next 7 days.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-error/20 border border-accent-error/50
                          text-accent-error hover:bg-accent-error hover:text-white transition-all duration-150 rounded-lg
                          font-dm-mono text-[10px] tracking-widest uppercase font-bold"
                      >
                        <Check size={10} />
                        Confirm change
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-text-tertiary hover:text-text-secondary
                          transition-colors duration-150 font-dm-mono text-[10px] tracking-widest uppercase"
                      >
                        <X size={10} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2">
                      <input
                        type="number"
                        value={draftValue}
                        min={policy.min}
                        max={policy.max}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftValue(e.target.value)}
                        className="bg-transparent font-syne font-bold text-text-primary w-16 focus:outline-none text-sm"
                      />
                      {policy.unit && (
                        <span className="font-dm-mono text-[10px] text-text-tertiary">{policy.unit}</span>
                      )}
                    </div>
                    {policy.min !== undefined && (
                      <span className="font-dm-mono text-[9px] text-text-tertiary">
                        Range: {policy.min}–{policy.max}{policy.unit ?? ""}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSave(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/40
                        text-accent-primary hover:bg-accent-primary hover:text-text-inverse transition-all duration-150 rounded-lg
                        font-dm-mono text-[10px] tracking-widest uppercase"
                    >
                      <Check size={10} />
                      Review
                    </button>
                    <button
                      onClick={handleCancel}
                      className="text-text-tertiary hover:text-text-secondary transition-colors duration-150"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [showTier1, setShowTier1] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  return (
    <div className="flex flex-col min-h-full">
      <AnalyticsNav />

      <div className="flex-1 p-6 space-y-8 max-w-[1000px] mx-auto w-full">

        {/* Header */}
        <div className="pt-2">
          <p className="font-dm-mono text-[10px] text-accent-primary tracking-[3px] uppercase">
            Oracle Intelligence
          </p>
          <h1 className="font-syne font-bold text-2xl text-text-primary mt-1">
            Agent Policies
          </h1>
          <p className="font-dm-mono text-xs text-text-tertiary mt-1">
            Tier 2 thresholds are user-configurable. Tier 1 is hard-coded and Oracle-owned.
          </p>
        </div>

        {/* Power disclaimer banner */}
        {!disclaimerDismissed && (
          <div
            className="relative bg-bg-surface border rounded-xl p-5 overflow-hidden"
            style={{ borderColor: `${WARNING}40` }}
          >
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{ background: `radial-gradient(ellipse at top left, ${WARNING}, transparent 60%)` }}
            />
            <div className="relative flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${WARNING}18`, border: `1px solid ${WARNING}40` }}
              >
                <Shield size={18} style={{ color: WARNING }} />
              </div>
              <div className="flex-1">
                <p className="font-syne font-bold text-base text-text-primary mb-1">
                  With great power comes great responsibility.
                </p>
                <p className="font-dm-mono text-[11px] text-text-secondary leading-relaxed">
                  The policies on this page directly control how your AI agents think, decide, and act. Every change is logged in the policy audit trail and evaluated by Oracle over the next 7 days.
                  Aggressive changes can degrade channel performance, increase ad spend, or delay video production. Oracle will predict the impact of any change before you confirm it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {[
                    { icon: Info, label: "Advisory", color: INFO, text: "Low risk. Affects non-critical tuning." },
                    { icon: AlertTriangle, label: "Caution", color: WARNING, text: "Moderate impact. Oracle will monitor." },
                    { icon: Zap, label: "High Impact", color: ERROR, text: "Major change. Confirmation required." },
                  ].map(({ icon: Icon, label, color, text }) => (
                    <div
                      key={label}
                      className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5 flex items-start gap-2"
                    >
                      <Icon size={12} style={{ color }} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="font-dm-mono text-[9px] font-bold tracking-widest uppercase" style={{ color }}>
                          {label}
                        </div>
                        <div className="font-dm-mono text-[9px] text-text-tertiary mt-0.5">{text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 mt-4 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2.5">
                  <Lock size={10} className="text-text-tertiary mt-0.5 shrink-0" />
                  <p className="font-dm-mono text-[9px] text-text-tertiary leading-relaxed">
                    <span className="text-text-secondary font-bold">Deletions are not allowed.</span> Policies can only be modified within safe ranges. Metric weights and trust bands (Tier 1) are read-only. New user-defined metrics enter 14-day observer mode before influencing agent scoring.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDisclaimerDismissed(true)}
                className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Tier 2 — Oracle-Configurable (user can modify) */}
        {(() => {
          const oraclePolicies = TIER2_POLICIES.filter((p) => p.agentId === "oracle");
          return (
            <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${AMBER}18`, border: `1px solid ${AMBER}30` }}
                  >
                    <Edit3 size={14} style={{ color: AMBER }} />
                  </div>
                  <div>
                    <div className="font-syne font-bold text-sm text-text-primary">Oracle Evaluation Policies</div>
                    <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5">
                      You are the evaluator — modify Oracle's scoring thresholds based on your performance goals
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="font-dm-mono text-[9px] px-2 py-1 rounded-full tracking-widest uppercase"
                      style={{ color: AMBER, background: `${AMBER}15` }}
                    >
                      {oraclePolicies.length} configurable
                    </span>
                  </div>
                </div>
              </div>
              {oraclePolicies.length === 0 ? (
                <div className="px-5 py-8 text-center font-dm-mono text-[10px] text-text-tertiary">
                  No Oracle policies match this filter.
                </div>
              ) : (
                oraclePolicies.map((p) => <Tier2Row key={p.key} policy={p} editable={true} />)
              )}
            </div>
          );
        })()}

        {/* Tier 2 — Agent-Owned (view only) */}
        {(() => {
          const agentPolicies = TIER2_POLICIES.filter((p) => p.agentId !== "oracle");
          if (agentPolicies.length === 0) return null;
          return (
            <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${INFO}18`, border: `1px solid ${INFO}30` }}
                  >
                    <Eye size={14} style={{ color: INFO }} />
                  </div>
                  <div>
                    <div className="font-syne font-bold text-sm text-text-primary">Agent-Owned Thresholds</div>
                    <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5">
                      Internal operating parameters — managed by each agent autonomously · View only
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="font-dm-mono text-[9px] px-2 py-1 rounded-full tracking-widest uppercase"
                      style={{ color: INFO, background: `${INFO}15` }}
                    >
                      {agentPolicies.length} read-only
                    </span>
                  </div>
                </div>
              </div>
              {agentPolicies.map((p) => <Tier2Row key={p.key} policy={p} editable={false} />)}
            </div>
          );
        })()}

        {/* Tier 1 — Read Only */}
        <div className="bg-bg-surface border border-bg-border rounded-xl overflow-hidden">
          <button
            className="w-full px-5 py-4 border-b border-bg-border flex items-center gap-3 hover:bg-bg-elevated transition-colors duration-150"
            onClick={() => setShowTier1((s) => !s)}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${ERROR}18`, border: `1px solid ${ERROR}30` }}
            >
              <Lock size={14} style={{ color: ERROR }} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-syne font-bold text-sm text-text-primary">Tier 1 — Hard-Coded Constants</div>
              <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5">
                Read-only · Code deploy required to change · Oracle-owned
              </div>
            </div>
            <span
              className="font-dm-mono text-[9px] px-2 py-1 rounded-full tracking-widest uppercase mr-2"
              style={{ color: ERROR, background: `${ERROR}15` }}
            >
              {TIER1_POLICIES.length} locked
            </span>
            {showTier1
              ? <ChevronDown size={14} className="text-text-tertiary" />
              : <ChevronRight size={14} className="text-text-tertiary" />
            }
          </button>
          {showTier1 && (
            TIER1_POLICIES.length === 0 ? (
              <div className="px-5 py-8 text-center font-dm-mono text-[10px] text-text-tertiary">
                No Tier 1 policies for this agent.
              </div>
            ) : (
              TIER1_POLICIES.map((p) => <Tier1Row key={p.key} policy={p} />)
            )
          )}
        </div>

        {/* Observer Mode section */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${INFO}18`, border: `1px solid ${INFO}30` }}
            >
              <Eye size={14} style={{ color: INFO }} />
            </div>
            <div>
              <div className="font-syne font-bold text-sm text-text-primary">Observer Mode</div>
              <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5">
                New metrics collecting signal before active scoring · Oracle evaluates at day 14
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {TIER2_POLICIES.filter((p) => p.observerMode).map((p) => (
              <div
                key={p.key}
                className="bg-bg-elevated border rounded-xl px-4 py-3 flex items-center gap-4"
                style={{ borderColor: `${INFO}25` }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-syne text-[11px] text-text-primary">{p.label}</span>
                    <WarnBadge level={p.warnLevel} />
                  </div>
                  <div className="font-dm-mono text-[9px] text-text-tertiary mt-0.5 tracking-wider">
                    {p.agentId} · Activated Mar 8, 2026
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-syne font-bold text-text-primary text-sm">
                    {p.value}{p.unit ?? ""}
                  </div>
                  <div className="font-dm-mono text-[9px] mt-1" style={{ color: INFO }}>
                    {p.observerDaysLeft}d until eval
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="w-24">
                    <div className="flex justify-between mb-1">
                      <span className="font-dm-mono text-[8px] text-text-tertiary">Day 5</span>
                      <span className="font-dm-mono text-[8px] text-text-tertiary">Day 14</span>
                    </div>
                    <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((14 - (p.observerDaysLeft ?? 0)) / 14) * 100}%`,
                          background: INFO,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {TIER2_POLICIES.filter((p) => p.observerMode).length === 0 && (
              <div className="text-center py-4 font-dm-mono text-[10px] text-text-tertiary">
                No metrics currently in observer mode.
              </div>
            )}
          </div>
        </div>

        {/* Audit log section */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${SUCCESS}18`, border: `1px solid ${SUCCESS}30` }}
            >
              <BookOpen size={14} style={{ color: SUCCESS }} />
            </div>
            <div>
              <div className="font-syne font-bold text-sm text-text-primary">Policy Audit Log</div>
              <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider mt-0.5">
                Every change logged · 365-day retention · Oracle impact predictions included
              </div>
            </div>
          </div>

          {/* Mock audit entries */}
          <div className="space-y-2">
            {[
              { date: "Mar 15, 2026", policy: "Rex Confidence Floor", from: "70", to: "72", agent: "rex", warnLevel: "ADVISORY" as WarnLevel, oracleNote: "Impact minimal. Rex greenlit 2 more topics/week. Monitoring." },
              { date: "Mar 10, 2026", policy: "Oracle Eval Window", from: "5", to: "7", agent: "oracle", warnLevel: "CAUTION" as WarnLevel, oracleNote: "Eval window extended. Promotions now take 2 extra days but signal confidence improved." },
            ].map((entry, i) => (
              <div key={i} className="bg-bg-elevated border border-bg-border rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-syne text-[11px] text-text-primary">{entry.policy}</span>
                      <WarnBadge level={entry.warnLevel} />
                      <span className="font-dm-mono text-[9px] text-text-tertiary">{entry.agent}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-dm-mono text-[10px] text-text-tertiary">{entry.from}</span>
                      <span className="text-text-tertiary">→</span>
                      <span className="font-dm-mono text-[10px] font-bold" style={{ color: AMBER }}>{entry.to}</span>
                    </div>
                  </div>
                  <span className="font-dm-mono text-[9px] text-text-tertiary shrink-0">{entry.date}</span>
                </div>
                <div className="flex items-start gap-2 mt-2.5">
                  <Zap size={9} style={{ color: SUCCESS }} className="mt-0.5 shrink-0" />
                  <p className="font-dm-mono text-[9px] text-text-secondary">{entry.oracleNote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
