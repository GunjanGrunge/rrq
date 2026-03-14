import React from "react";
import { useCurrentFrame, spring, interpolate, useVideoConfig, Img } from "remotion";
import { THEME } from "../theme";

interface PersonalityCardProps {
  data: {
    name: string;
    role: string;
    org?: string;
    imageUrl?: string;
    facts: string[];
    accent?: string;
  };
}

export const PersonalityCard: React.FC<PersonalityCardProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const cardX = interpolate(slideIn, [0, 1], [-200, 0]);
  const cardOpacity = interpolate(slideIn, [0, 1], [0, 1]);

  const accent = data.accent ?? THEME.amber;

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: THEME.fontSyne, boxSizing: "border-box", padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 80,
          alignItems: "center",
          opacity: cardOpacity,
          transform: `translateX(${cardX}px)`,
          backgroundColor: THEME.surface,
          borderRadius: 24,
          padding: 64,
          border: `1px solid ${THEME.border}`,
          maxWidth: 1400,
          width: "100%",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            border: `4px solid ${accent}`,
            backgroundColor: THEME.border,
          }}
        >
          {data.imageUrl && (
            <Img src={data.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ color: accent, fontSize: 22, fontFamily: THEME.fontMono, marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {data.org ?? ""}
          </div>
          <h2 style={{ color: THEME.text, fontSize: 72, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{data.name}</h2>
          <div style={{ color: THEME.muted, fontSize: 32, marginTop: 8, marginBottom: 40, fontFamily: THEME.fontLora }}>{data.role}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.facts.map((fact, i) => {
              const factReveal = spring({ frame: frame - 15 - i * 6, fps, config: { damping: 20 } });
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    opacity: interpolate(factReveal, [0, 1], [0, 1]),
                    transform: `translateX(${interpolate(factReveal, [0, 1], [20, 0])}px)`,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: accent, flexShrink: 0 }} />
                  <span style={{ color: THEME.text, fontSize: 26 }}>{fact}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
