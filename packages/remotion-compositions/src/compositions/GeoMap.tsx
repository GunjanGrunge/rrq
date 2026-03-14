import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { THEME, CHART_COLORS } from "../theme";

// Note: @vnedyalk0v/react19-simple-maps is used here for React 19 compatibility.
// If the package is not yet installed, the Lambda falls back to a placeholder.
let ComposableMap: React.FC<{ width?: number; height?: number; style?: React.CSSProperties; children?: React.ReactNode }> | null = null;
let Geographies: React.FC<{ geography: string; children: (props: { geographies: unknown[] }) => React.ReactNode }> | null = null;
let Geography: React.FC<{ geography: unknown; style?: { default?: React.CSSProperties; hover?: React.CSSProperties } }> | null = null;
let Marker: React.FC<{ coordinates: [number, number]; children?: React.ReactNode }> | null = null;

try {
  const maps = require("@vnedyalk0v/react19-simple-maps");
  ComposableMap = maps.ComposableMap;
  Geographies = maps.Geographies;
  Geography = maps.Geography;
  Marker = maps.Marker;
} catch {
  // Package not installed yet — renders placeholder
}

interface MarkerData {
  name: string;
  coordinates: [number, number];
  value?: string;
  highlight?: boolean;
}

interface GeoMapProps {
  data: {
    title: string;
    markers?: MarkerData[];
    highlightCountries?: string[];
    caption?: string;
    citations?: string[];
  };
}

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export const GeoMap: React.FC<GeoMapProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = spring({ frame, fps, config: { damping: 20 } });
  const opacity = interpolate(reveal, [0, 1], [0, 1]);
  const scale = interpolate(reveal, [0, 1], [0.95, 1]);

  if (!ComposableMap || !Geographies || !Geography) {
    // Fallback placeholder when package not available
    return (
      <div style={{ width: THEME.width, height: THEME.height, backgroundColor: THEME.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.fontSyne }}>
        <div style={{ textAlign: "center", color: THEME.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺</div>
          <div style={{ fontSize: 32 }}>{data.title}</div>
          <div style={{ fontSize: 22, marginTop: 12 }}>Geo map — install @vnedyalk0v/react19-simple-maps</div>
        </div>
      </div>
    );
  }

  const CM = ComposableMap;
  const Geos = Geographies;
  const Geo = Geography;

  return (
    <div
      style={{
        width: THEME.width, height: THEME.height, backgroundColor: THEME.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px 80px 48px", fontFamily: THEME.fontSyne, boxSizing: "border-box",
      }}
    >
      <h1 style={{ color: THEME.text, fontSize: 52, fontWeight: 700, marginBottom: 32, letterSpacing: "-0.02em", opacity }}>
        {data.title}
      </h1>

      <div style={{ flex: 1, width: "100%", opacity, transform: `scale(${scale})` }}>
        <CM width={1760} height={700} style={{ width: "100%", height: "100%" }}>
          <Geos geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo: unknown) => (
                <Geo
                  key={(geo as { rsmKey: string }).rsmKey}
                  geography={geo}
                  style={{
                    default: { fill: THEME.surface, stroke: THEME.border, strokeWidth: 0.5 },
                    hover: { fill: `${THEME.amber}30`, stroke: THEME.amber, strokeWidth: 0.5 },
                  }}
                />
              ))
            }
          </Geos>
          {Marker && data.markers?.map((m, i) => (
            <Marker key={i} coordinates={m.coordinates}>
              <circle r={m.highlight ? 10 : 6} fill={m.highlight ? THEME.amber : CHART_COLORS[i % CHART_COLORS.length]} opacity={0.9} />
              {m.value && (
                <text
                  textAnchor="middle"
                  y={-16}
                  style={{ fontFamily: THEME.fontMono, fill: THEME.text, fontSize: 16 }}
                >
                  {m.name}: {m.value}
                </text>
              )}
            </Marker>
          ))}
        </CM>
      </div>

      {data.caption && (
        <div style={{ color: THEME.muted, fontSize: 24, fontFamily: THEME.fontLora, marginTop: 16, textAlign: "center" }}>
          {data.caption}
        </div>
      )}

      {data.citations && data.citations.length > 0 && (
        <div style={{ position: "absolute", bottom: 32, left: 80, right: 80, color: THEME.muted, fontSize: 18, fontFamily: THEME.fontMono }}>
          {data.citations.join(" · ")}
        </div>
      )}
    </div>
  );
};
