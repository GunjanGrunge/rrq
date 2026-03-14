import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { RadarChart as RechartsRadar, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from "recharts";
import { THEME, CHART_COLORS } from "../theme";

interface RadarChartProps {
  data: {
    title: string;
    dimensions: string[];
    datasets: Array<{ name: string; values: number[] }>;
    citations?: string[];
  };
}

export const RadarChart: React.FC<RadarChartProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 70 } });
  const opacity = interpolate(reveal, [0, 1], [0, 1]);
  const scale = interpolate(reveal, [0, 1], [0.6, 1]);

  const chartData = data.dimensions.map((dim, i) => {
    const point: Record<string, string | number> = { dim };
    data.datasets.forEach((ds) => { point[ds.name] = ds.values[i] ?? 0; });
    return point;
  });

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px", fontFamily: THEME.fontSyne, boxSizing: "border-box",
      }}
    >
      <h1 style={{ color: THEME.text, fontSize: 52, fontWeight: 700, marginBottom: 48, letterSpacing: "-0.02em" }}>
        {data.title}
      </h1>

      <div style={{ width: "100%", height: 720, opacity, transform: `scale(${scale})` }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar data={chartData}>
            <PolarGrid stroke={THEME.border} />
            <PolarAngleAxis dataKey="dim" tick={{ fill: THEME.text, fontSize: 22, fontFamily: THEME.fontMono }} />
            <PolarRadiusAxis tick={{ fill: THEME.muted, fontSize: 16 }} />
            <Legend wrapperStyle={{ color: THEME.text, fontSize: 22 }} />
            {data.datasets.map((ds, i) => (
              <Radar
                key={ds.name}
                name={ds.name}
                dataKey={ds.name}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.25}
                strokeWidth={3}
              />
            ))}
          </RechartsRadar>
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
