import React from "react";
import { Composition } from "remotion";
import { THEME } from "./theme";
import { ComparisonTable } from "./compositions/ComparisonTable";
import { BarChart } from "./compositions/BarChart";
import { LineChart } from "./compositions/LineChart";
import { RadarChart } from "./compositions/RadarChart";
import { StatCallout } from "./compositions/StatCallout";
import { PersonalityCard } from "./compositions/PersonalityCard";
import { NewsTimeline } from "./compositions/NewsTimeline";
import { FlowDiagram } from "./compositions/FlowDiagram";
import { AnimatedInfographic } from "./compositions/AnimatedInfographic";
import { GeoMap } from "./compositions/GeoMap";

// Default durations per type (seconds × fps)
const D = {
  still: 3 * THEME.fps,      // 3s — most charts
  medium: 5 * THEME.fps,     // 5s — timelines, personality cards
  long: 8 * THEME.fps,       // 8s — animated infographic, geo map
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ComparisonTable"
      component={ComparisonTable}
      durationInFrames={D.still}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Feature Comparison",
          headers: ["Product A", "Product B"],
          rows: [{ label: "Speed", values: ["Fast", "Slow"], winner: 0 }],
        },
      }}
    />
    <Composition
      id="BarChart"
      component={BarChart}
      durationInFrames={D.still}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Performance Benchmark",
          datasets: [{ name: "Score", values: [{ label: "A", value: 80 }, { label: "B", value: 60 }] }],
        },
      }}
    />
    <Composition
      id="LineChart"
      component={LineChart}
      durationInFrames={D.still}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Growth Over Time",
          datasets: [{ name: "Users", values: [{ label: "Q1", value: 100 }, { label: "Q2", value: 200 }] }],
        },
      }}
    />
    <Composition
      id="RadarChart"
      component={RadarChart}
      durationInFrames={D.still}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Capability Radar",
          dimensions: ["Speed", "Accuracy", "Cost"],
          datasets: [{ name: "Model A", values: [8, 9, 6] }],
        },
      }}
    />
    <Composition
      id="StatCallout"
      component={StatCallout}
      durationInFrames={D.still}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{ data: { stat: "$4.2B", label: "Global AI Market 2025", source: "Gartner" } }}
    />
    <Composition
      id="PersonalityCard"
      component={PersonalityCard}
      durationInFrames={D.medium}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          name: "Sam Altman",
          role: "CEO, OpenAI",
          facts: ["Raised $10B from Microsoft", "Launched ChatGPT in 2022"],
        },
      }}
    />
    <Composition
      id="NewsTimeline"
      component={NewsTimeline}
      durationInFrames={D.medium}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Key Events",
          events: [{ date: "Jan 2024", headline: "Event 1", highlight: true }],
        },
      }}
    />
    <Composition
      id="FlowDiagram"
      component={FlowDiagram}
      durationInFrames={D.medium}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Pipeline Flow",
          svgDataUri: "data:image/svg+xml;base64,",
        },
      }}
    />
    <Composition
      id="AnimatedInfographic"
      component={AnimatedInfographic}
      durationInFrames={D.long}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: {
          title: "Key Insights",
          sections: [
            { heading: "Growth", stat: "200%", body: "Year over year increase", icon: "📈" },
            { heading: "Users", stat: "1M+", body: "Active monthly users", icon: "👥" },
          ],
        },
      }}
    />
    <Composition
      id="GeoMap"
      component={GeoMap}
      durationInFrames={D.long}
      fps={THEME.fps}
      width={THEME.width}
      height={THEME.height}
      defaultProps={{
        data: { title: "Global Reach", markers: [] },
      }}
    />
  </>
);
