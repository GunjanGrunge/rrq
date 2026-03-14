// Public exports — used by visual-gen Lambda and any agent composing visuals
export { THEME, CHART_COLORS } from "./theme";
export { ComparisonTable } from "./compositions/ComparisonTable";
export { BarChart } from "./compositions/BarChart";
export { LineChart } from "./compositions/LineChart";
export { RadarChart } from "./compositions/RadarChart";
export { StatCallout } from "./compositions/StatCallout";
export { PersonalityCard } from "./compositions/PersonalityCard";
export { NewsTimeline } from "./compositions/NewsTimeline";
export { FlowDiagram } from "./compositions/FlowDiagram";
export { AnimatedInfographic } from "./compositions/AnimatedInfographic";
export { GeoMap } from "./compositions/GeoMap";

// Root.tsx is intentionally NOT exported here — it is for Remotion CLI (npx remotion preview) only
