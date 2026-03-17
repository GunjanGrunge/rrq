"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bot, Shield, ArrowRight, Activity, CheckCircle } from "lucide-react";

// ─── Mini preview rows (labels only — values load on the full page) ──────────

const CHANNEL_PREVIEW_LABELS = ["Views (28d)", "Subscribers", "Watch Hours", "Est. Revenue"];

const AGENTS_PREVIEW_NAMES = ["Zeus", "Rex", "Regum", "Qeon"];

const POLICIES_PREVIEW_LABELS = [
  "Oracle Promotion Threshold",
  "Rex Confidence Floor",
  "Harvy Quality Gate Floor",
  "Accuracy Weight",
];

// ─── Flip Card ──────────────────────────────────────────────────────────────

interface FlipCardProps {
  href: string;
  icon: React.ElementType;
  label: string;
  tagline: string;
  back: React.ReactNode;
  accentColor: string;
  index: number;
}

function FlipCard({ href, icon: Icon, label, tagline, back, accentColor, index }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const router = useRouter();

  return (
    <div
      className="relative cursor-pointer"
      style={{ perspective: "1200px", animationDelay: `${index * 120}ms` }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => router.push(href)}
    >
      {/* Card wrapper — 3D flip */}
      <div
        className="relative w-full"
        style={{
          height: "360px",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.34,1.20,0.64,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── Front ── */}
        <div
          className="absolute inset-0 flex flex-col justify-between p-8 border border-bg-border"
          style={{
            background: "var(--bg-surface)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderTop: `3px solid ${accentColor}`,
          }}
        >
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div
              className="w-10 h-10 flex items-center justify-center border border-bg-border"
              style={{ background: "var(--bg-elevated)" }}
            >
              <Icon size={18} style={{ color: accentColor }} />
            </div>
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.35em] uppercase">
              Hover to preview
            </span>
          </div>

          {/* Label */}
          <div>
            <div className="font-dm-mono text-[10px] tracking-[0.4em] uppercase mb-3" style={{ color: accentColor }}>
              Analytics
            </div>
            <h2 className="font-syne font-bold text-text-primary text-3xl tracking-tight mb-3">
              {label}
            </h2>
            <p className="font-lora text-text-secondary text-sm leading-relaxed">
              {tagline}
            </p>
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
              Open full view
            </span>
            <ArrowRight size={12} className="text-text-tertiary" />
          </div>
        </div>

        {/* ── Back ── */}
        <div
          className="absolute inset-0 flex flex-col p-6 border border-bg-border overflow-hidden"
          style={{
            background: "var(--bg-elevated)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderTop: `3px solid ${accentColor}`,
          }}
        >
          {/* Back header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Icon size={13} style={{ color: accentColor }} />
              <span className="font-dm-mono text-[10px] tracking-[0.35em] uppercase" style={{ color: accentColor }}>
                {label}
              </span>
            </div>
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest uppercase">
              Click to open →
            </span>
          </div>

          {/* Back content */}
          <div className="flex-1 overflow-hidden">
            {back}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Back content: Channel ───────────────────────────────────────────────────

function ChannelBack() {
  return (
    <div className="flex flex-col gap-2.5">
      {CHANNEL_PREVIEW_LABELS.map((label) => (
        <div
          key={label}
          className="flex items-center justify-between px-3 py-2.5 border border-bg-border"
          style={{ background: "var(--bg-surface)" }}
        >
          <span className="font-dm-mono text-[10px] text-text-secondary tracking-wider">{label}</span>
          <span className="font-dm-mono text-[10px] text-text-tertiary">—</span>
        </div>
      ))}
      <div className="mt-1 pt-3 border-t border-bg-border flex items-center gap-2">
        <Activity size={10} className="text-text-tertiary" />
        <span className="font-dm-mono text-[9px] text-text-tertiary tracking-wider">
          Views · Revenue · Ad Performance · Top Videos
        </span>
      </div>
    </div>
  );
}

// ─── Back content: Agents ────────────────────────────────────────────────────

function AgentsBack() {
  return (
    <div className="flex flex-col gap-2.5">
      {AGENTS_PREVIEW_NAMES.map((name) => (
        <div
          key={name}
          className="flex items-center justify-between px-3 py-2.5 border border-bg-border"
          style={{ background: "var(--bg-surface)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-bg-border-hover" />
            <span className="font-dm-mono text-[10px] text-text-primary tracking-wider">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1 bg-bg-border rounded-full" />
            <span className="font-dm-mono text-[10px] text-text-tertiary w-7 text-right">—</span>
          </div>
        </div>
      ))}
      <div className="mt-1 pt-3 border-t border-bg-border flex items-center gap-2">
        <Bot size={10} className="text-text-tertiary" />
        <span className="font-dm-mono text-[9px] text-text-tertiary tracking-wider">
          Scores · Versions · Decisions · Registry
        </span>
      </div>
    </div>
  );
}

// ─── Back content: Policies ──────────────────────────────────────────────────

function PoliciesBack() {
  return (
    <div className="flex flex-col gap-2.5">
      {POLICIES_PREVIEW_LABELS.map((label) => (
        <div
          key={label}
          className="flex items-center justify-between px-3 py-2.5 border border-bg-border"
          style={{ background: "var(--bg-surface)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-bg-border-hover shrink-0" />
            <span className="font-dm-mono text-[10px] text-text-secondary tracking-wider truncate">{label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary">—</span>
            <Shield size={9} className="text-text-tertiary" />
          </div>
        </div>
      ))}
      <div className="mt-1 pt-3 border-t border-bg-border flex items-center gap-2">
        <CheckCircle size={10} className="text-text-tertiary" />
        <span className="font-dm-mono text-[9px] text-text-tertiary tracking-wider">
          Oracle editable · Agent-owned (view only) · Tier 1 locked
        </span>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const CARDS = [
  {
    href: "/analytics/channel",
    icon: BarChart3,
    label: "Channel",
    tagline: "Views, watch hours, revenue, and ad performance — the full picture of how your channel is growing.",
    back: <ChannelBack />,
    accentColor: "#f5a623",
  },
  {
    href: "/analytics/agents",
    icon: Bot,
    label: "Agents",
    tagline: "Composite performance scores, version registry, and decision quality across the entire team.",
    back: <AgentsBack />,
    accentColor: "#3b82f6",
  },
  {
    href: "/analytics/policies",
    icon: Shield,
    label: "Policies",
    tagline: "System thresholds and governance rules. Oracle evaluation policies are user-tunable — all others are agent-owned.",
    back: <PoliciesBack />,
    accentColor: "#22c55e",
  },
];

export default function AnalyticsHub() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-14">
          <div className="font-dm-mono text-[10px] text-accent-primary tracking-[0.4em] uppercase mb-3">
            Analytics
          </div>
          <h1 className="font-syne font-bold text-text-primary mb-4" style={{ fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.15 }}>
            Your channel.<br />
            <span className="text-text-secondary font-normal" style={{ fontSize: "0.7em" }}>
              Every signal in one place.
            </span>
          </h1>
          <p className="font-lora text-text-secondary text-base max-w-xl leading-relaxed">
            Hover a card to preview the section. Click to open the full view. Use the tabs at the top of each page to switch between sections.
          </p>
        </div>

        {/* 3 flip cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {CARDS.map((card, i) => (
            <FlipCard key={card.href} {...card} index={i} />
          ))}
        </div>

        {/* Footnote */}
        <div className="mt-10 pt-8 border-t border-bg-border flex items-center gap-3">
          <div className="w-1 h-1 bg-accent-primary" />
          <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.35em] uppercase">
            All data refreshed on page load
          </span>
        </div>
      </div>
    </div>
  );
}
