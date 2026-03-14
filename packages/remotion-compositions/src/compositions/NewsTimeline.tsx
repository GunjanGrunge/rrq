import React from "react";
import { useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { THEME } from "../theme";

interface TimelineEvent {
  date: string;
  headline: string;
  detail?: string;
  highlight?: boolean;
}

interface NewsTimelineProps {
  data: {
    title: string;
    events: TimelineEvent[];
    citations?: string[];
  };
}

export const NewsTimeline: React.FC<NewsTimelineProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleReveal = spring({ frame, fps, config: { damping: 20 } });

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px", fontFamily: THEME.fontSyne, boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: THEME.text, fontSize: 52, fontWeight: 700, marginBottom: 56,
          opacity: interpolate(titleReveal, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleReveal, [0, 1], [-20, 0])}px)`,
          letterSpacing: "-0.02em",
        }}
      >
        {data.title}
      </h1>

      {/* Timeline */}
      <div style={{ position: "relative", width: "100%", maxWidth: 1400 }}>
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: 200,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: THEME.border,
          }}
        />

        {data.events.map((event, i) => {
          const eventReveal = spring({ frame: frame - 10 - i * 10, fps, config: { damping: 18, stiffness: 100 } });
          const opacity = interpolate(eventReveal, [0, 1], [0, 1]);
          const x = interpolate(eventReveal, [0, 1], [40, 0]);

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                marginBottom: 36,
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              {/* Date */}
              <div style={{ width: 180, textAlign: "right", paddingRight: 32, color: THEME.muted, fontSize: 20, fontFamily: THEME.fontMono, paddingTop: 4, flexShrink: 0 }}>
                {event.date}
              </div>

              {/* Dot */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: event.highlight ? THEME.amber : THEME.muted,
                  flexShrink: 0,
                  marginTop: 6,
                  zIndex: 1,
                  boxShadow: event.highlight ? `0 0 12px ${THEME.amber}80` : "none",
                }}
              />

              {/* Content */}
              <div style={{ paddingLeft: 28, flex: 1 }}>
                <div
                  style={{
                    color: event.highlight ? THEME.amber : THEME.text,
                    fontSize: 28,
                    fontWeight: event.highlight ? 700 : 600,
                    lineHeight: 1.3,
                  }}
                >
                  {event.headline}
                </div>
                {event.detail && (
                  <div style={{ color: THEME.muted, fontSize: 22, marginTop: 6, fontFamily: THEME.fontLora }}>
                    {event.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data.citations && data.citations.length > 0 && (
        <div style={{ position: "absolute", bottom: 32, left: 80, right: 80, color: THEME.muted, fontSize: 18, fontFamily: THEME.fontMono }}>
          {data.citations.join(" · ")}
        </div>
      )}
    </div>
  );
};
