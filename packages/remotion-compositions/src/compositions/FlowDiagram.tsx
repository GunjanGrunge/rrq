import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Img } from "remotion";
import { THEME } from "../theme";

interface FlowDiagramProps {
  data: {
    title: string;
    // Mermaid is pre-rendered to SVG string by the Lambda (via Puppeteer) before Remotion renders.
    // The Lambda sets svgDataUri = "data:image/svg+xml;base64,<base64>" and passes it here.
    svgDataUri: string;
    caption?: string;
    citations?: string[];
  };
}

export const FlowDiagram: React.FC<FlowDiagramProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleReveal = spring({ frame, fps, config: { damping: 20 } });
  const diagramReveal = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 80 } });

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
          color: THEME.text, fontSize: 52, fontWeight: 700, marginBottom: 48,
          opacity: interpolate(titleReveal, [0, 1], [0, 1]),
          letterSpacing: "-0.02em",
        }}
      >
        {data.title}
      </h1>

      {/* SVG pre-rendered from Mermaid via Puppeteer in the Lambda */}
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(diagramReveal, [0, 1], [0, 1]),
          transform: `scale(${interpolate(diagramReveal, [0, 1], [0.92, 1])})`,
        }}
      >
        <Img
          src={data.svgDataUri}
          style={{ maxWidth: "100%", maxHeight: 700, objectFit: "contain" }}
        />
      </div>

      {data.caption && (
        <div style={{ color: THEME.muted, fontSize: 26, fontFamily: THEME.fontLora, marginTop: 24, textAlign: "center" }}>
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
