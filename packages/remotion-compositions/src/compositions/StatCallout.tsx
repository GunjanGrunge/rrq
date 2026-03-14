import React from "react";
import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { THEME } from "../theme";

interface StatCalloutProps {
  data: {
    stat: string;
    label: string;
    context?: string;
    source?: string;
    accent?: string; // override amber
  };
}

export const StatCallout: React.FC<StatCalloutProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleIn = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const scale = interpolate(scaleIn, [0, 1], [0.4, 1]);
  const opacity = interpolate(scaleIn, [0, 1], [0, 1]);

  const labelReveal = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 100 } });
  const labelOpacity = interpolate(labelReveal, [0, 1], [0, 1]);
  const labelY = interpolate(labelReveal, [0, 1], [20, 0]);

  const accent = data.accent ?? THEME.amber;

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: THEME.fontSyne, boxSizing: "border-box",
      }}
    >
      {/* Big stat number */}
      <div
        style={{
          fontSize: 180,
          fontWeight: 800,
          color: accent,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {data.stat}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 600,
          color: THEME.text,
          marginTop: 32,
          textAlign: "center",
          maxWidth: 1200,
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {data.label}
      </div>

      {/* Context */}
      {data.context && (
        <div
          style={{
            fontSize: 32,
            color: THEME.muted,
            marginTop: 24,
            textAlign: "center",
            maxWidth: 1000,
            fontFamily: THEME.fontLora,
            opacity: labelOpacity,
          }}
        >
          {data.context}
        </div>
      )}

      {/* Source */}
      {data.source && (
        <div style={{ position: "absolute", bottom: 48, color: THEME.muted, fontSize: 22, fontFamily: THEME.fontMono }}>
          Source: {data.source}
        </div>
      )}
    </div>
  );
};
