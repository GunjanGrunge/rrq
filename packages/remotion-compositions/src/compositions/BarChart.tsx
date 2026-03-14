import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { THEME, CHART_COLORS } from "../theme";

interface BarChartProps {
  data: {
    title: string;
    unit?: string;
    datasets: Array<{ name: string; values: Array<{ label: string; value: number }> }>;
    citations?: string[];
  };
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Animate bar height via spring — drives a CSS clip that reveals bars
  const barReveal = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 80 } });
  const clipPercent = interpolate(barReveal, [0, 1], [0, 100]);

  // Flatten datasets into recharts format
  const chartData = data.datasets[0].values.map((v, i) => {
    const point: Record<string, string | number> = { label: v.label };
    data.datasets.forEach((ds) => {
      point[ds.name] = ds.values[i]?.value ?? 0;
    });
    return point;
  });

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
      <h1
        style={{
          color: THEME.text,
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 48,
          opacity: titleOpacity,
          letterSpacing: "-0.02em",
        }}
      >
        {data.title}
        {data.unit && (
          <span style={{ color: THEME.muted, fontSize: 32, marginLeft: 12, fontFamily: THEME.fontMono }}>
            ({data.unit})
          </span>
        )}
      </h1>

      <div style={{ width: "100%", height: 700, clipPath: `inset(0 0 ${100 - clipPercent}% 0)` }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBar data={chartData} margin={{ top: 20, right: 40, left: 40, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
            <XAxis dataKey="label" tick={{ fill: THEME.text, fontSize: 22, fontFamily: THEME.fontMono }} axisLine={{ stroke: THEME.border }} />
            <YAxis tick={{ fill: THEME.muted, fontSize: 18, fontFamily: THEME.fontMono }} axisLine={{ stroke: THEME.border }} />
            <Legend wrapperStyle={{ color: THEME.text, fontSize: 22 }} />
            {data.datasets.map((ds, i) => (
              <Bar key={ds.name} dataKey={ds.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </RechartsBar>
        </ResponsiveContainer>
      </div>

      {data.citations && data.citations.length > 0 && (
        <div style={{ position: "absolute", bottom: 32, left: 80, right: 80, color: THEME.muted, fontSize: 18, fontFamily: THEME.fontMono }}>
          {data.citations.join(" · ")}
        </div>
      )}
    </div>
  );
};
