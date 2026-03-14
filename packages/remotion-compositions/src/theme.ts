// Single source of truth for all RRQ design tokens used inside Remotion compositions.
// Matches globals.css CSS variables exactly — update both if colours change.

export const THEME = {
  // Colours
  bg:      "#0a0a0a",
  surface: "#111111",
  border:  "#1a1a1a",
  amber:   "#f5a623",
  success: "#22c55e",
  text:    "#f0ece4",
  muted:   "#666666",
  danger:  "#ef4444",

  // Typography
  fontSyne: "Syne",
  fontMono: "DM Mono",
  fontLora: "Lora",

  // Canvas
  width:  1920,
  height: 1080,
  fps:    30,
} as const;

// Chart colour palette — amber-led, dark-theme optimised
export const CHART_COLORS = [
  "#f5a623", // amber (primary)
  "#22c55e", // success green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ef4444", // red
  "#f97316", // orange
] as const;
