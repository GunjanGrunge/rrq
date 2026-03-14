import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { THEME } from "../theme";

interface ComparisonRow {
  label: string;
  values: (string | number)[];
  winner?: number; // index of winning column
}

interface ComparisonTableProps {
  data: {
    title: string;
    headers: string[];
    rows: ComparisonRow[];
    citations?: string[];
  };
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 15], [20, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: THEME.width,
        height: THEME.height,
        backgroundColor: THEME.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        fontFamily: THEME.fontSyne,
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <h1
        style={{
          color: THEME.text,
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 48,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        {data.title}
      </h1>

      {/* Table */}
      <div style={{ width: "100%", maxWidth: 1600 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `2fr ${data.headers.map(() => "1fr").join(" ")}`,
            gap: 2,
            marginBottom: 2,
          }}
        >
          <div style={{ padding: "16px 24px" }} />
          {data.headers.map((h, i) => {
            const headerOpacity = interpolate(frame, [10 + i * 5, 25 + i * 5], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  backgroundColor: THEME.surface,
                  padding: "16px 24px",
                  textAlign: "center",
                  color: THEME.amber,
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: THEME.fontMono,
                  opacity: headerOpacity,
                  borderRadius: 4,
                }}
              >
                {h}
              </div>
            );
          })}
        </div>

        {/* Data rows */}
        {data.rows.map((row, rowIdx) => {
          const rowProgress = spring({
            frame: frame - 20 - rowIdx * 8,
            fps,
            config: { damping: 18, stiffness: 100 },
          });
          const rowOpacity = interpolate(rowProgress, [0, 1], [0, 1]);
          const rowX = interpolate(rowProgress, [0, 1], [-40, 0]);

          return (
            <div
              key={rowIdx}
              style={{
                display: "grid",
                gridTemplateColumns: `2fr ${data.headers.map(() => "1fr").join(" ")}`,
                gap: 2,
                marginBottom: 2,
                opacity: rowOpacity,
                transform: `translateX(${rowX}px)`,
              }}
            >
              <div
                style={{
                  backgroundColor: THEME.surface,
                  padding: "20px 24px",
                  color: THEME.text,
                  fontSize: 26,
                  fontWeight: 600,
                  borderRadius: 4,
                }}
              >
                {row.label}
              </div>
              {row.values.map((val, colIdx) => (
                <div
                  key={colIdx}
                  style={{
                    backgroundColor: row.winner === colIdx ? `${THEME.amber}18` : THEME.surface,
                    padding: "20px 24px",
                    textAlign: "center",
                    color: row.winner === colIdx ? THEME.amber : THEME.text,
                    fontSize: 26,
                    fontWeight: row.winner === colIdx ? 700 : 400,
                    borderRadius: 4,
                    border: row.winner === colIdx ? `1px solid ${THEME.amber}40` : "1px solid transparent",
                  }}
                >
                  {String(val)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Citations */}
      {data.citations && data.citations.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 80,
            right: 80,
            color: THEME.muted,
            fontSize: 18,
            fontFamily: THEME.fontMono,
          }}
        >
          {data.citations.join(" · ")}
        </div>
      )}
    </div>
  );
};
