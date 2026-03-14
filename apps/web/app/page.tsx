import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowRight, Zap, Wand2, Youtube, Clock } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base overflow-hidden">
      {/* Dot grid background */}
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-primary" />
          <span className="font-syne font-bold text-text-primary tracking-[0.2em] uppercase text-sm">
            RRQ
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="font-dm-mono text-xs text-text-secondary hover:text-text-primary transition-colors duration-200 tracking-widest uppercase"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="font-dm-mono text-xs text-text-inverse bg-accent-primary hover:bg-accent-primary-hover px-4 py-2 tracking-widest uppercase transition-colors duration-200"
            >
              Get Started
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/create"
              className="font-dm-mono text-xs text-text-inverse bg-accent-primary hover:bg-accent-primary-hover px-4 py-2 tracking-widest uppercase transition-colors duration-200"
            >
              Open Factory
            </Link>
          </Show>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-8 text-center">
        {/* Label */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />
          <span className="font-dm-mono text-xs text-text-secondary tracking-[0.3em] uppercase">
            Autonomous Content System
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-syne font-bold text-text-primary mb-6 leading-[0.9] tracking-tight"
          style={{ fontSize: "clamp(48px, 8vw, 96px)" }}
        >
          <span className="block">Rex Regum</span>
          <span className="block text-accent-primary">Qeon</span>
        </h1>

        {/* Subheadline */}
        <p className="font-lora text-text-secondary text-xl max-w-xl mb-12 leading-relaxed">
          Four AI agents that watch the world, identify opportunities, and
          publish YouTube videos — completely autonomously.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-8 py-4 tracking-widest uppercase transition-colors duration-200 group"
            >
              Start Building
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <Link
              href="/sign-in"
              className="font-dm-mono text-xs text-text-secondary hover:text-text-primary border border-bg-border hover:border-bg-border-hover px-8 py-4 tracking-widest uppercase transition-all duration-200"
            >
              Sign In
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/create"
              className="flex items-center gap-2 bg-accent-primary hover:bg-accent-primary-hover text-text-inverse font-syne font-bold text-sm px-8 py-4 tracking-widest uppercase transition-colors duration-200 group"
            >
              Open Factory
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <Link
              href="/zeus"
              className="flex items-center gap-2 border border-accent-primary text-accent-primary hover:bg-accent-primary hover:text-text-inverse font-syne font-bold text-sm px-8 py-4 tracking-widest uppercase transition-all duration-200"
            >
              <Zap size={16} />
              GO RRQ
            </Link>
          </Show>
        </div>

        {/* Cost callout */}
        <div className="mt-16 font-dm-mono text-xs text-text-tertiary tracking-widest">
          ~$0.15 per video · 100 videos/month · $14.50 total
        </div>
      </section>

      {/* Features row */}
      <section className="relative z-10 border-t border-bg-border">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-bg-border">
          {[
            {
              icon: <Wand2 size={20} className="text-accent-primary" />,
              label: "11-Step Pipeline",
              desc: "Research → Script → SEO → Audio → Avatar → Video → Upload",
            },
            {
              icon: <Zap size={20} className="text-accent-primary" />,
              label: "4 Autonomous Agents",
              desc: "Zeus, Rex, Regum, Qeon — running 24/7 without human input",
            },
            {
              icon: <Youtube size={20} className="text-accent-primary" />,
              label: "YouTube Native",
              desc: "Auto-uploads main video + Shorts, manages playlists and schedule",
            },
            {
              icon: <Clock size={20} className="text-accent-primary" />,
              label: "GO RRQ Mode",
              desc: "One button. Zero input. Full autonomous content factory.",
            },
          ].map((feature) => (
            <div key={feature.label} className="px-8 py-10 flex flex-col gap-4">
              {feature.icon}
              <div>
                <div className="font-syne font-bold text-text-primary text-sm mb-2">
                  {feature.label}
                </div>
                <div className="font-dm-mono text-xs text-text-secondary leading-relaxed">
                  {feature.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent list */}
      <section className="relative z-10 px-8 py-24 max-w-4xl mx-auto">
        <div className="font-dm-mono text-xs text-text-tertiary tracking-widest uppercase mb-12">
          The Team
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              name: "ZEUS",
              role: "Head of Operations",
              desc: "Never sleeps. Manages memory, scores agent performance, analyses every comment, monitors video health at 24h and 72h.",
              model: "Opus",
            },
            {
              name: "REX",
              role: "Intelligence & Scouting",
              desc: "Scans 6 signal sources every 30 minutes. Scores confidence across 7 dimensions. Flags opportunities before anyone else.",
              model: "Opus",
            },
            {
              name: "REGUM",
              role: "Strategy & Channel Management",
              desc: "Evaluates Rex's greenlights, picks the best angle, builds the production brief, manages playlists and upload schedule.",
              model: "Sonnet",
            },
            {
              name: "QEON",
              role: "Production Execution",
              desc: "Runs the full 11-step pipeline. Enforces the quality gate. Reports every step to Zeus. Never skips, never shortcuts.",
              model: "Opus + Sonnet + Haiku",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              className="border border-bg-border bg-bg-surface p-6 hover:border-accent-primary transition-colors duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-syne font-bold text-accent-primary text-lg tracking-widest">
                    {agent.name}
                  </div>
                  <div className="font-dm-mono text-xs text-text-secondary tracking-wider mt-0.5">
                    {agent.role}
                  </div>
                </div>
                <div className="font-dm-mono text-[10px] text-text-tertiary border border-bg-border px-2 py-1 tracking-wider">
                  {agent.model}
                </div>
              </div>
              <p className="font-lora text-text-secondary text-sm leading-relaxed">
                {agent.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-bg-border px-8 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
          <span className="font-syne font-bold text-text-primary text-xs tracking-[0.2em] uppercase">
            RRQ Content Factory
          </span>
        </div>
        <span className="font-dm-mono text-xs text-text-tertiary">
          King of Kings
        </span>
      </footer>
    </div>
  );
}
