"use client";

/**
 * RRQSignature
 *
 * Tokyo graffiti-style draw-on animation for "RRQ".
 * Each letter has:
 *   - Filled block body (dark, slightly transparent)
 *   - Thick amber outline that draws on via stroke-dashoffset
 *   - Inner chrome highlight stroke (thin white, offset inward)
 *   - Soft radial glow that fades in behind the letter
 *
 * Letters are wide, slightly italic, with angular wildstyle cuts.
 * All paths hand-tuned in a 360×100 viewBox.
 */

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterLayer {
  /** Filled polygon/path for the letter body */
  fill: string;
  /** Outer outline path (thick, draws on) */
  outline: string;
  /** Inner highlight path (thin, draws on after outline) */
  highlight: string;
  /** cx/cy for the radial glow circle */
  glowCx: number;
  glowCy: number;
  /** Stagger offset in seconds for this letter */
  letterDelay: number;
}

// ─── Letter path data ─────────────────────────────────────────────────────────
// ViewBox: 360 × 100. Letters are ~80px tall, bold, italic (~10° skew).
// R letters: wide bowl, angular kicked leg (wildstyle detail).
// Q: thick oval with a thick diagonal tail slash that extends past the ring.

const LETTERS: LetterLayer[] = [
  // ── R1 (x: 10–90) ──────────────────────────────────────────────────────────
  {
    // Body: spine + bowl filled as one closed shape, plus leg triangle
    fill: [
      // Main body (spine + bowl area)
      "M 20 10 L 28 10 L 28 45 L 55 45 L 55 52 L 30 52 L 52 88 L 40 88 L 18 52 L 18 88 L 8 88 L 8 10 Z",
      // Bowl fill
      "M 28 10 L 62 16 C 74 20 78 30 72 40 C 66 50 55 52 28 52 Z",
    ].join(" "),
    outline:
      "M 8 10 L 8 88 M 8 10 L 28 10 C 65 10 82 20 82 36 C 82 52 65 55 28 55 M 42 52 L 62 88",
    highlight:
      "M 16 18 L 16 40 M 16 18 C 40 15 70 20 72 34",
    glowCx: 45,
    glowCy: 49,
    letterDelay: 0,
  },

  // ── R2 (x: 110–190) ────────────────────────────────────────────────────────
  {
    fill: [
      "M 118 10 L 126 10 L 126 45 L 153 45 L 153 52 L 128 52 L 150 88 L 138 88 L 116 52 L 116 88 L 106 88 L 106 10 Z",
      "M 126 10 L 160 16 C 172 20 176 30 170 40 C 164 50 153 52 126 52 Z",
    ].join(" "),
    outline:
      "M 106 10 L 106 88 M 106 10 L 126 10 C 163 10 180 20 180 36 C 180 52 163 55 126 55 M 140 52 L 160 88",
    highlight:
      "M 114 18 L 114 40 M 114 18 C 138 15 168 20 170 34",
    glowCx: 143,
    glowCy: 49,
    letterDelay: 0.55,
  },

  // ── Q (x: 220–350) ─────────────────────────────────────────────────────────
  {
    fill: [
      // Outer ring fill (thick ring = two arcs)
      "M 285 14 C 320 14 345 30 345 50 C 345 70 320 86 285 86 C 250 86 225 70 225 50 C 225 30 250 14 285 14 Z",
    ].join(" "),
    // Outer oval outline + tail slash
    outline:
      "M 285 14 C 320 14 345 30 345 50 C 345 70 320 86 285 86 C 250 86 225 70 225 50 C 225 30 250 14 285 14 Z M 305 68 L 350 96",
    highlight:
      "M 285 22 C 312 22 336 35 338 50 M 316 72 L 345 92",
    glowCx: 285,
    glowCy: 50,
    letterDelay: 1.1,
  },
];

// ─── Animated outline path ────────────────────────────────────────────────────

function AnimatedPath({
  d,
  stroke,
  strokeWidth,
  opacity,
  delay,
  started,
  duration = 0.65,
}: {
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  delay: number;
  started: boolean;
  duration?: number;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.style.transition = "none";
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !started) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    const t = setTimeout(() => {
      el.style.transition = `stroke-dashoffset ${duration}s cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.strokeDashoffset = "0";
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [started, delay, duration]);

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      style={{ strokeDasharray: 1200, strokeDashoffset: 1200 }}
    />
  );
}

// ─── Animated fill (fades + scales in) ───────────────────────────────────────

function AnimatedFill({
  d,
  delay,
  started,
}: {
  d: string;
  delay: number;
  started: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <path
      d={d}
      fill="var(--bg-elevated)"
      fillOpacity={visible ? 0.75 : 0}
      stroke="none"
      style={{
        transition: visible
          ? "fill-opacity 0.3s ease-out"
          : "none",
      }}
    />
  );
}

// ─── Glow circle ─────────────────────────────────────────────────────────────

function GlowCircle({
  cx,
  cy,
  delay,
  started,
}: {
  cx: number;
  cy: number;
  delay: number;
  started: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={55}
      ry={42}
      fill="url(#rrqGlow)"
      opacity={visible ? 1 : 0}
      style={{
        transition: visible ? "opacity 0.5s ease-out" : "none",
      }}
    />
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RRQSignature() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex justify-center py-2" aria-hidden="true">
      <svg
        viewBox="0 0 360 100"
        width="320"
        height="88"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Radial glow — amber */}
          <radialGradient id="rrqGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5a623" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
          </radialGradient>
        </defs>

        {LETTERS.map((letter, i) => (
          <g key={i}>
            {/* 1. Glow behind letter */}
            <GlowCircle
              cx={letter.glowCx}
              cy={letter.glowCy}
              delay={letter.letterDelay}
              started={started}
            />

            {/* 2. Letter body fill */}
            <AnimatedFill
              d={letter.fill}
              delay={letter.letterDelay}
              started={started}
            />

            {/* 3. Thick outer outline — draws on */}
            <AnimatedPath
              d={letter.outline}
              stroke="var(--accent-primary)"
              strokeWidth={5.5}
              opacity={0.9}
              delay={letter.letterDelay + 0.05}
              started={started}
              duration={0.7}
            />

            {/* 4. Inner chrome highlight — draws on slightly after */}
            <AnimatedPath
              d={letter.highlight}
              stroke="#ffffff"
              strokeWidth={1.5}
              opacity={0.3}
              delay={letter.letterDelay + 0.35}
              started={started}
              duration={0.45}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
