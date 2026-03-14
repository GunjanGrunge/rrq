import React from "react";
import { useCurrentFrame, interpolate, spring, Sequence, useVideoConfig } from "remotion";
import { THEME, CHART_COLORS } from "../theme";

interface InfographicSection {
  heading: string;
  stat?: string;
  body: string;
  icon?: string; // emoji or unicode symbol
}

interface AnimatedInfographicProps {
  data: {
    title: string;
    subtitle?: string;
    sections: InfographicSection[];
    citations?: string[];
  };
}

const Section: React.FC<{ section: InfographicSection; index: number; accent: string }> = ({ section, index, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const opacity = interpolate(reveal, [0, 1], [0, 1]);
  const y = interpolate(reveal, [0, 1], [30, 0]);

  return (
    <div
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 16,
        padding: 40,
        border: `1px solid ${THEME.border}`,
        opacity,
        transform: `translateY(${y}px)`,
        borderTop: `3px solid ${accent}`,
      }}
    >
      {section.icon && (
        <div style={{ fontSize: 48, marginBottom: 16 }}>{section.icon}</div>
      )}
      {section.stat && (
        <div style={{ color: accent, fontSize: 64, fontWeight: 800, lineHeight: 1, marginBottom: 8, letterSpacing: "-0.03em" }}>
          {section.stat}
        </div>
      )}
      <h3 style={{ color: THEME.text, fontSize: 28, fontWeight: 700, margin: "0 0 12px 0" }}>
        {section.heading}
      </h3>
      <p style={{ color: THEME.muted, fontSize: 22, margin: 0, lineHeight: 1.5, fontFamily: THEME.fontLora }}>
        {section.body}
      </p>
    </div>
  );
};

export const AnimatedInfographic: React.FC<AnimatedInfographicProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleReveal = spring({ frame, fps, config: { damping: 20 } });
  // Stagger each section by 15 frames
  const sectionDelay = 15;
  const cols = data.sections.length <= 3 ? data.sections.length : Math.ceil(data.sections.length / 2);

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px", fontFamily: THEME.fontSyne, boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 56, opacity: interpolate(titleReveal, [0, 1], [0, 1]) }}>
        <h1 style={{ color: THEME.text, fontSize: 56, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          {data.title}
        </h1>
        {data.subtitle && (
          <p style={{ color: THEME.muted, fontSize: 28, margin: "12px 0 0 0", fontFamily: THEME.fontLora }}>
            {data.subtitle}
          </p>
        )}
      </div>

      {/* Sections grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 32,
          width: "100%",
          maxWidth: 1600,
        }}
      >
        {data.sections.map((section, i) => (
          <Sequence key={i} from={i * sectionDelay} layout="none">
            <Section section={section} index={i} accent={CHART_COLORS[i % CHART_COLORS.length]} />
          </Sequence>
        ))}
      </div>

      {data.citations && data.citations.length > 0 && (
        <div style={{ position: "absolute", bottom: 32, left: 80, right: 80, color: THEME.muted, fontSize: 18, fontFamily: THEME.fontMono }}>
          {data.citations.join(" · ")}
        </div>
      )}
    </div>
  );
};
