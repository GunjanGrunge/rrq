"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import { SiVercel, SiGithub, SiElevenlabs } from "react-icons/si";
import { usePipelineStore } from "@/lib/pipeline-store";

// ─── Full team roster ──────────────────────────────────────────────────────────
const TEAM = [
  {
    id: "zeus",
    name: "ZEUS",
    role: "Head of Operations",
    desc: "Leads the team. Holds the memory, tracks performance, reviews every video, and makes the final call. Always on.",
    tier: "core",
  },
  {
    id: "rex",
    name: "REX",
    role: "Intelligence & Scouting",
    desc: "Watches the world continuously. Surfaces high-confidence opportunities before they peak — so you're always ahead of the curve.",
    tier: "core",
  },
  {
    id: "regum",
    name: "REGUM",
    role: "Strategy & Channel Management",
    desc: "Turns opportunities into a sharp production angle, owns the content calendar, and keeps the channel growing with intention.",
    tier: "core",
  },
  {
    id: "qeon",
    name: "QEON",
    role: "Production Lead",
    desc: "Runs production end-to-end — from first research pass to final upload. Every quality gate cleared before anything goes live.",
    tier: "core",
  },
  {
    id: "muse",
    name: "MUSE",
    role: "Script & Visual Architect",
    desc: "Writes the script and designs the full visual plan. Every word and every frame has a purpose.",
    tier: "specialist",
  },
  {
    id: "oracle",
    name: "ORACLE",
    role: "Learning & Discovery",
    desc: "Tracks what works, spots what's changing, and keeps the team sharp. The team gets smarter with every video.",
    tier: "specialist",
  },
  {
    id: "aria",
    name: "ARIA",
    role: "Market Intelligence",
    desc: "Keeps your channel positioned correctly across markets. Reads signals, tracks outcomes, adjusts strategy — continuously.",
    tier: "specialist",
  },
  {
    id: "sniper",
    name: "SNIPER",
    role: "Geo-Linguistic Targeting",
    desc: "Identifies the highest-value audience for every topic. Aligns content and ad strategy to the right market, every time.",
    tier: "specialist",
  },
  {
    id: "vera",
    name: "VERA",
    role: "Quality & Standards",
    desc: "Reviews every video before it goes live — audio, visuals, and platform standards. Nothing ships unless it clears her gate.",
    tier: "specialist",
  },
  {
    id: "tony",
    name: "TONY",
    role: "Visuals & Data",
    desc: "Builds the charts, infographics, section cards, and thumbnails that make your content stand out. Data made visual.",
    tier: "specialist",
  },
  {
    id: "theo",
    name: "THEO",
    role: "Channel Manager",
    desc: "Handles comments, community engagement, title and thumbnail testing, and weekly performance reporting.",
    tier: "specialist",
  },
  {
    id: "jason",
    name: "JASON",
    role: "Team Coordinator",
    desc: "Keeps everyone on track. Runs planning, monitors progress, and makes sure nothing falls through the cracks.",
    tier: "specialist",
  },
];

// ─── Council agents (review panel) ─────────────────────────────────────────────
const COUNCIL = [
  { id: "muse", name: "Muse" },
  { id: "oracle", name: "Oracle" },
  { id: "vera", name: "Vera" },
  { id: "aria", name: "Aria" },
  { id: "rex", name: "Rex" },
  { id: "zeus", name: "Zeus" },
];

// ─── Stats ─────────────────────────────────────────────────────────────────────
const STATS = [
  { value: "12", label: "Team members" },
  { value: "3", label: "Production modes" },
  { value: "100%", label: "Done for you" },
  { value: "24/7", label: "Always on" },
];

// ─── Marquee text ──────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "Research", "Strategy", "Scripting", "Visuals", "Audio", "Editing",
  "Thumbnails", "Publishing", "Analytics", "Growth", "Engagement", "Optimization",
  "Research", "Strategy", "Scripting", "Visuals", "Audio", "Editing",
  "Thumbnails", "Publishing", "Analytics", "Growth", "Engagement", "Optimization",
];

// ─── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

// ─── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={visible ? { animation: `revealUp 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards` } : { opacity: 0 }}
    >
      {children}
    </div>
  );
}

// ─── Step labels ───────────────────────────────────────────────────────────────
const STEP_LABELS: Record<number, string> = {
  1: "Research", 2: "Script", 3: "SEO", 4: "Quality Gate",
  5: "Voiceover", 6: "Avatar", 7: "B-Roll", 8: "Images",
  9: "Visuals", 10: "AV Sync", 11: "QA", 12: "Shorts", 13: "Upload",
};

const STEP_ROUTES: Record<number, string> = {
  1: "/create/research", 2: "/create/script", 3: "/create/seo",
  4: "/create/quality", 5: "/create/audio", 6: "/create/avatar",
  7: "/create/broll", 8: "/create/images", 9: "/create/visuals",
  10: "/create/av-sync", 11: "/create/qa", 12: "/create/shorts",
  13: "/create/upload",
};

// ─── Pipeline resume banner ────────────────────────────────────────────────────
function PipelineResumeBanner() {
  const { isSignedIn } = useAuth();
  const { activeJobId, currentStep, stepStatuses, brief } = usePipelineStore();
  const [visible, setVisible] = useState(false);

  // Determine if there's an in-progress job to show
  const hasActiveJob = !!(activeJobId && currentStep > 0);
  const completedSteps = hasActiveJob
    ? Object.values(stepStatuses).filter((s) => s === "complete").length
    : 0;
  const isRunning = hasActiveJob && Object.values(stepStatuses).some((s) => s === "running");
  const resumeRoute = hasActiveJob ? (STEP_ROUTES[currentStep] ?? "/create") : "/create";
  const stepLabel = STEP_LABELS[currentStep] ?? "Pipeline";

  useEffect(() => {
    if (isSignedIn && hasActiveJob && currentStep > 0 && currentStep < 13) {
      // Short delay so it feels intentional, not jarring
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [isSignedIn, hasActiveJob, currentStep]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
      style={{ animation: "revealUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards" }}
    >
      <div className="bg-bg-elevated border border-bg-border shadow-2xl flex items-center gap-4 px-5 py-4">
        {/* Status dot */}
        <div className="shrink-0 flex items-center justify-center">
          {isRunning ? (
            <Loader2 size={14} className="text-accent-primary animate-spin" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase mb-0.5">
            {isRunning ? "Pipeline running" : "Pipeline paused"}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-syne font-bold text-text-primary text-sm truncate">
              Step {currentStep} — {stepLabel}
            </span>
            {brief?.topic && (
              <span className="font-dm-mono text-[10px] text-text-tertiary truncate hidden sm:block">
                · {brief.topic.slice(0, 40)}{brief.topic.length > 40 ? "…" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Progress pills */}
        <div className="shrink-0 flex items-center gap-1">
          {Array.from({ length: 13 }, (_, i) => {
            const step = i + 1;
            const status = stepStatuses[step];
            return (
              <div
                key={step}
                className={`h-1 w-3 ${
                  status === "complete"
                    ? "bg-accent-success"
                    : status === "running"
                    ? "bg-accent-primary animate-pulse"
                    : status === "error"
                    ? "bg-red-500"
                    : "bg-bg-border"
                }`}
              />
            );
          })}
        </div>

        {/* CTA */}
        <Link
          href={resumeRoute}
          className="shrink-0 flex items-center gap-1 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-dm-mono text-[10px] tracking-widest uppercase px-4 py-2 transition-colors"
        >
          Resume
          <ChevronRight size={12} />
        </Link>
      </div>

      {/* Completed count */}
      <div className="text-center mt-2">
        <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest">
          {completedSteps} of 13 steps complete
        </span>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [loaderDone, setLoaderDone] = useState(false);
  const [loaderExiting, setLoaderExiting] = useState(false);
  const [fillStarted, setFillStarted] = useState(false);

  // Loader sequence
  useEffect(() => {
    const t1 = setTimeout(() => setFillStarted(true), 300);
    const t2 = setTimeout(() => setLoaderExiting(true), 1800);
    const t3 = setTimeout(() => setLoaderDone(true), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <>
      {/* ─── Loader ────────────────────────────────────────────────────────── */}
      {!loaderDone && (
        <div
          className={`fixed inset-0 z-[9999] bg-bg-base flex items-center justify-center ${loaderExiting ? "loader-exit" : ""}`}
        >
          <div className="relative select-none">
            {/* Base text — outline / dark */}
            <span
              className="font-syne font-bold text-[120px] leading-none tracking-[-0.04em] text-bg-elevated"
              style={{ WebkitTextStroke: "1px #222222" }}
            >
              RRQ
            </span>
            {/* Fill layer — amber sweep */}
            <span
              className="font-syne font-bold text-[120px] leading-none tracking-[-0.04em] text-accent-primary absolute inset-0"
              style={{
                clipPath: fillStarted ? undefined : "inset(0 100% 0 0)",
                animation: fillStarted ? "rrqFill 1.2s cubic-bezier(0.16,1,0.3,1) forwards" : "none",
                WebkitTextStroke: "none",
              }}
            >
              RRQ
            </span>
            {/* Tagline */}
            <p
              className="font-dm-mono text-xs text-text-tertiary tracking-[0.4em] uppercase text-center mt-4"
              style={{
                opacity: fillStarted ? 1 : 0,
                transition: "opacity 0.6s ease 0.8s",
              }}
            >
              Rex Regum Qeon
            </p>
          </div>
        </div>
      )}

      {/* ─── Page ──────────────────────────────────────────────────────────── */}
      <div
        className="min-h-screen bg-bg-base overflow-x-hidden"
        style={{ opacity: loaderDone ? 1 : 0, transition: "opacity 0.4s ease" }}
      >
        {/* Dot grid */}
        <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

        {/* Pipeline resume banner — shows when user navigates away mid-pipeline */}
        <PipelineResumeBanner />

        {/* ─── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="relative z-20 flex items-center justify-between px-8 py-6 border-b border-bg-border/40">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-accent-primary" />
            <span className="font-syne font-bold text-text-primary tracking-[0.25em] uppercase text-sm">
              RRQ
            </span>
          </div>
          <div className="flex items-center gap-6">
            {isSignedIn ? (
              <>
                <Link
                  href="/create"
                  className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors tracking-widest uppercase"
                >
                  Studio
                </Link>
                <Link
                  href="/analytics"
                  className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors tracking-widest uppercase"
                >
                  Analytics
                </Link>
                <Link
                  href="/zeus"
                  className="font-dm-mono text-xs text-text-inverse bg-accent-primary hover:bg-accent-primary-hover px-5 py-2 tracking-widest uppercase transition-colors"
                >
                  GO RRQ
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors tracking-widest uppercase"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="font-dm-mono text-xs text-text-inverse bg-accent-primary hover:bg-accent-primary-hover px-5 py-2 tracking-widest uppercase transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* ─── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative z-10 flex flex-col items-center justify-center min-h-[92vh] px-8 pb-24 text-center">
          {/* Ambient glow behind headline */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(245,166,35,0.06) 0%, transparent 70%)",
            }}
          />

          {/* Status pill */}
          <div
            className="flex items-center gap-2 mb-10 border border-bg-border px-4 py-2"
            style={{ animation: "revealUp 0.6s cubic-bezier(0.16,1,0.3,1) 2.4s both" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />
            <span className="font-dm-mono text-[10px] text-text-secondary tracking-[0.35em] uppercase">
              Your AI Content Team — Always On
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-syne font-bold text-text-primary tracking-tight mb-6"
            style={{
              fontSize: "clamp(48px, 7.5vw, 100px)",
              lineHeight: 1.2,
              animation: "revealUp 0.7s cubic-bezier(0.16,1,0.3,1) 2.5s both",
            }}
          >
            <span className="block">Rex Regum</span>
            <span className="block text-accent-primary">Qeon.</span>
          </h1>

          {/* Subline */}
          <p
            className="font-lora text-text-secondary text-xl max-w-lg mb-12 leading-relaxed"
            style={{ animation: "revealUp 0.7s cubic-bezier(0.16,1,0.3,1) 2.65s both" }}
          >
            A team of 12 AI agents that research, write, produce, and
            publish your channel — while you focus on what matters.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center gap-4"
            style={{ animation: "revealUp 0.7s cubic-bezier(0.16,1,0.3,1) 2.8s both" }}
          >
            {isSignedIn ? (
              <>
                <Link
                  href="/create"
                  className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-10 py-4 tracking-widest uppercase transition-colors group"
                >
                  Open Studio
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/zeus"
                  className="font-dm-mono text-xs text-text-secondary hover:text-text-primary border border-bg-border hover:border-bg-border-hover px-10 py-4 tracking-widest uppercase transition-all"
                >
                  Command Center
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-10 py-4 tracking-widest uppercase transition-colors group"
                >
                  Start Building
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/sign-in"
                  className="font-dm-mono text-xs text-text-secondary hover:text-text-primary border border-bg-border hover:border-bg-border-hover px-10 py-4 tracking-widest uppercase transition-all"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Scroll cue */}
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            style={{ animation: "revealUp 0.6s ease 3.2s both" }}
          >
            <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.4em] uppercase">Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-bg-border to-transparent" />
          </div>
        </section>

        {/* ─── Stats bar ───────────────────────────────────────────────────── */}
        <Reveal>
          <div className="relative z-10 border-t border-b border-bg-border grid grid-cols-2 md:grid-cols-4 divide-x divide-bg-border">
            {STATS.map((s) => (
              <div key={s.label} className="px-8 py-10 text-center">
                <div className="font-syne font-bold text-accent-primary stat-flicker" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>
                  {s.value}
                </div>
                <div className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase mt-2">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ─── Pipeline marquee ─────────────────────────────────────────────── */}
        <Reveal>
          <div className="relative z-10 border-b border-bg-border py-5 overflow-hidden">
            <div className="marquee-track">
              {MARQUEE_ITEMS.map((item, i) => (
                <span key={i} className="flex items-center gap-6 px-6 font-dm-mono text-[10px] tracking-[0.3em] uppercase text-text-tertiary whitespace-nowrap">
                  {item}
                  <span className="text-accent-primary opacity-40">◆</span>
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ─── Modes section ────────────────────────────────────────────────── */}
        <section className="relative z-10 px-8 py-28 max-w-6xl mx-auto">
          <Reveal>
            <div className="mb-16 flex flex-col gap-3">
              <span className="font-dm-mono text-[10px] text-accent-primary tracking-[0.4em] uppercase">
                How you work with us
              </span>
              <h2 className="font-syne font-bold text-text-primary" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.2 }}>
                Three ways to run<br />your channel.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px bg-bg-border">
            {[
              {
                badge: "01",
                name: "Studio Mode",
                tagline: "You lead. We execute.",
                desc: "Enter a topic. The team produces and uploads a complete YouTube video — research, script, visuals, audio, editing, and all. You stay in the driver's seat.",
                accent: false,
              },
              {
                badge: "02",
                name: "Director Mode",
                tagline: "You approve. We produce.",
                desc: "The team does the work, you make the creative calls. Review the script, visuals, and final cut at every key moment. Edit, approve, or ask for a redo.",
                accent: true,
              },
              {
                badge: "03",
                name: "Autopilot",
                tagline: "One button. Zero input.",
                desc: "The team watches the world around the clock. When the right opportunity shows up, they move — and you get notified when the video is live.",
                accent: false,
              },
            ].map((mode) => (
              <div
                key={mode.name}
                className={`p-8 bg-bg-base hover-glow transition-all duration-300 group ${mode.accent ? "border-t-2 border-accent-primary" : ""}`}
              >
                <Reveal delay={mode.accent ? 100 : 0}>
                  <div className="font-dm-mono text-[10px] text-text-tertiary tracking-[0.4em] mb-6">{mode.badge}</div>
                  <h3 className={`font-syne font-bold text-lg mb-1 ${mode.accent ? "text-accent-primary" : "text-text-primary"}`}>
                    {mode.name}
                  </h3>
                  <div className="font-dm-mono text-[10px] text-text-tertiary tracking-wider uppercase mb-5">{mode.tagline}</div>
                  <p className="font-lora text-text-secondary text-sm leading-relaxed">{mode.desc}</p>
                </Reveal>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Team — full org chart ─────────────────────────────────────────── */}
        <section className="relative z-10 py-28 border-t border-bg-border">
          <div className="px-8 max-w-6xl mx-auto">

            {/* Section header */}
            <Reveal>
              <div className="mb-16 flex flex-col gap-3">
                <span className="font-dm-mono text-[10px] text-accent-primary tracking-[0.4em] uppercase">
                  The team
                </span>
                <h2 className="font-syne font-bold text-text-primary" style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.2 }}>
                  12 specialists.<br />One shared goal.
                </h2>
              </div>
            </Reveal>

            {/* ── Core tier label ── */}
            <Reveal>
              <div className="flex items-center gap-4 mb-px py-3 border-t border-bg-border">
                <span className="font-dm-mono text-[9px] text-accent-primary tracking-[0.4em] uppercase shrink-0">
                  Core
                </span>
                <div className="flex-1 h-px bg-bg-border" />
                <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest">
                  Ops · Intelligence · Strategy · Production
                </span>
              </div>
            </Reveal>

            {/* Core four — larger cards with amber left accent */}
            <div className="grid md:grid-cols-4 gap-px bg-bg-border mb-8">
              {TEAM.filter((a) => a.tier === "core").map((agent, i) => (
                <Reveal key={agent.id} delay={i * 80}>
                  <div className="bg-bg-base p-7 border-l-2 border-accent-primary hover:bg-bg-elevated transition-all duration-200 group h-full">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="font-syne font-bold text-accent-primary text-xl tracking-widest mb-1">
                          {agent.name}
                        </div>
                        <div className="font-dm-mono text-[9px] text-text-tertiary tracking-wider uppercase">
                          {agent.role}
                        </div>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-success mt-1.5 animate-pulse shrink-0" />
                    </div>
                    <p className="font-lora text-text-secondary text-sm leading-relaxed">{agent.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* ── Specialists tier label ── */}
            <Reveal>
              <div className="flex items-center gap-4 mb-px py-3 border-t border-bg-border">
                <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.4em] uppercase shrink-0">
                  Specialists
                </span>
                <div className="flex-1 h-px bg-bg-border" />
                <span className="font-dm-mono text-[9px] text-text-tertiary tracking-widest">
                  Script · Learning · Market · Quality · Visuals · Channel · Coordination
                </span>
              </div>
            </Reveal>

            {/* Specialists — two rows of 4 */}
            <div className="grid md:grid-cols-4 gap-px bg-bg-border mb-px">
              {TEAM.filter((a) => a.tier === "specialist").slice(0, 4).map((agent, i) => (
                <Reveal key={agent.id} delay={i * 60}>
                  <div className="bg-bg-surface p-6 border-l border-bg-border hover:border-l-accent-primary/40 hover:bg-bg-elevated transition-all duration-200 group h-full">
                    <div className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase mb-3">
                      {agent.role}
                    </div>
                    <div className="font-syne font-bold text-text-primary text-base tracking-widest mb-3 group-hover:text-accent-primary transition-colors">
                      {agent.name}
                    </div>
                    <p className="font-lora text-text-tertiary text-xs leading-relaxed group-hover:text-text-secondary transition-colors">
                      {agent.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="grid md:grid-cols-4 gap-px bg-bg-border">
              {TEAM.filter((a) => a.tier === "specialist").slice(4).map((agent, i) => (
                <Reveal key={agent.id} delay={i * 60}>
                  <div className="bg-bg-surface p-6 border-l border-bg-border hover:border-l-accent-primary/40 hover:bg-bg-elevated transition-all duration-200 group h-full">
                    <div className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase mb-3">
                      {agent.role}
                    </div>
                    <div className="font-syne font-bold text-text-primary text-base tracking-widest mb-3 group-hover:text-accent-primary transition-colors">
                      {agent.name}
                    </div>
                    <p className="font-lora text-text-tertiary text-xs leading-relaxed group-hover:text-text-secondary transition-colors">
                      {agent.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Council strip ────────────────────────────────────────────────── */}
        <Reveal>
          <div className="relative z-10 border-t border-b border-bg-border px-8 py-10 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="shrink-0">
                <div className="font-dm-mono text-[10px] text-accent-primary tracking-[0.4em] uppercase mb-1">
                  Built-in quality
                </div>
                <div className="font-syne font-bold text-text-primary text-lg">
                  Every video reviewed before it goes live.
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 flex-wrap">
                {COUNCIL.map((agent, i) => (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="font-dm-mono text-[10px] text-text-secondary tracking-wider border border-bg-border px-3 py-1.5">
                      {agent.name}
                    </div>
                    {i < COUNCIL.length - 1 && (
                      <div className="w-4 h-px bg-bg-border" />
                    )}
                  </div>
                ))}
              </div>
              <div className="shrink-0 font-lora text-text-tertiary text-xs max-w-[220px] leading-relaxed hidden md:block">
                The whole team signs off before anything reaches your audience.
              </div>
            </div>
          </div>
        </Reveal>

        {/* ─── Powered by ───────────────────────────────────────────────────── */}
        <Reveal>
          <div className="relative z-10 border-t border-bg-border px-8 py-16">
            <div className="max-w-6xl mx-auto flex flex-col items-center gap-10">
              <span className="font-dm-mono text-[10px] text-text-tertiary tracking-[0.4em] uppercase">
                Powered by
              </span>
              <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">

                {/* AWS */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <svg width="60" height="32" viewBox="0 0 60 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <text x="0" y="26" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="28" fill="#FF9900" letterSpacing="-1">aws</text>
                  </svg>
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">AWS</span>
                </div>

                {/* Anthropic */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <svg width="40" height="36" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* A — two angled strokes meeting at top, crossbar */}
                    <path d="M6 38L20 4L34 38" stroke="#f0ece4" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
                    <line x1="11" y1="26" x2="29" y2="26" stroke="#f0ece4" strokeWidth="5" strokeLinecap="square"/>
                    {/* \ — backslash */}
                    <line x1="37" y1="6" x2="48" y2="38" stroke="#f0ece4" strokeWidth="5" strokeLinecap="square"/>
                  </svg>
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">Anthropic</span>
                </div>

                {/* ElevenLabs */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <SiElevenlabs size={36} color="#f0ece4" />
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">ElevenLabs</span>
                </div>

                {/* Vercel */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <SiVercel size={32} color="#f0ece4" />
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">Vercel</span>
                </div>

                {/* Claude */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Starburst — 8 spokes radiating from centre */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                      <line
                        key={angle}
                        x1="18"
                        y1="18"
                        x2={18 + 14 * Math.cos((angle * Math.PI) / 180)}
                        y2={18 + 14 * Math.sin((angle * Math.PI) / 180)}
                        stroke="#CC785C"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    ))}
                    <circle cx="18" cy="18" r="2.5" fill="#CC785C"/>
                  </svg>
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">Claude</span>
                </div>

                {/* GitHub */}
                <div className="flex flex-col items-center gap-3 opacity-40 hover:opacity-70 transition-opacity duration-300">
                  <SiGithub size={34} color="#f0ece4" />
                  <span className="font-dm-mono text-[9px] text-text-tertiary tracking-[0.3em] uppercase">GitHub</span>
                </div>

              </div>
            </div>
          </div>
        </Reveal>

        {/* ─── CTA section ──────────────────────────────────────────────────── */}
        <section className="relative z-10 flex flex-col items-center justify-center py-36 px-8 text-center">
          {/* Ambient glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.07) 0%, transparent 70%)" }}
          />
          <Reveal>
            <div className="font-dm-mono text-[10px] text-text-tertiary tracking-[0.4em] uppercase mb-8">
              Ready when you are
            </div>
            <h2
              className="font-syne font-bold text-text-primary mb-8"
              style={{ fontSize: "clamp(36px, 6vw, 80px)", lineHeight: 1.2 }}
            >
              Your channel.<br />
              <span className="text-accent-primary">Their expertise.</span>
            </h2>
            <p className="font-lora text-text-secondary text-lg max-w-md mb-12 leading-relaxed mx-auto">
              Start with one video. Scale to a channel. The team handles
              the rest — every step, every time.
            </p>
            {isSignedIn ? (
              <Link
                href="/create"
                className="inline-flex items-center gap-3 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-12 py-5 tracking-widest uppercase transition-colors group"
              >
                Open Studio
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-3 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-12 py-5 tracking-widest uppercase transition-colors group"
              >
                Get Started Free
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </Reveal>
        </section>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <footer className="relative z-10 border-t border-bg-border px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-accent-primary" />
            <span className="font-syne font-bold text-text-primary text-xs tracking-[0.25em] uppercase">
              RRQ
            </span>
          </div>
          <span className="font-dm-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            Rex Regum Qeon · King of Kings
          </span>
        </footer>
      </div>
    </>
  );
}
