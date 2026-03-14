import path from "path";
import fs from "fs";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import chromium from "@sparticuz/chromium";

// Composition ID mapping — VisualAssetType → Remotion composition id in Root.tsx
const TYPE_TO_COMPOSITION: Record<string, string> = {
  "comparison-table":   "ComparisonTable",
  "bar-chart":          "BarChart",
  "line-chart":         "LineChart",
  "radar-chart":        "RadarChart",
  "flow-diagram":       "FlowDiagram",
  "infographic-card":   "AnimatedInfographic",
  "stat-callout":       "StatCallout",
  "personality-card":   "PersonalityCard",
  "news-timeline":      "NewsTimeline",
  "animated-infographic": "AnimatedInfographic",
  "geo-map":            "GeoMap",
};

interface VisualAssetInput {
  id: string;
  type: string;
  duration: number;
  data: Record<string, unknown>;
  citations?: string[];
}

interface RenderResult {
  buffer: Buffer;
  format: "mp4";
  width: number;
  height: number;
}

// Module-level bundle cache — survives Lambda warm invocations
let cachedBundleLocation: string | null = null;

async function getBundleLocation(): Promise<string> {
  // Check for pre-baked bundle (Docker build-time optimisation)
  const prebaked = process.env.REMOTION_BUNDLE_PATH;
  if (prebaked && fs.existsSync(prebaked)) {
    return prebaked;
  }

  // Use module-level cache if available
  if (cachedBundleLocation) return cachedBundleLocation;

  console.log("[visual-gen] Bundling Remotion compositions (cold start)...");
  const entryPoint = require.resolve("@rrq/remotion-compositions/src/Root");
  cachedBundleLocation = await bundle({ entryPoint });
  console.log(`[visual-gen] Bundle ready at: ${cachedBundleLocation}`);
  return cachedBundleLocation;
}

export async function renderWithRemotion(asset: VisualAssetInput): Promise<RenderResult> {
  const compositionId = TYPE_TO_COMPOSITION[asset.type];
  if (!compositionId) {
    throw new Error(`[visual-gen] No Remotion composition mapped for type: ${asset.type}`);
  }

  const bundleLocation = await getBundleLocation();
  const outputPath = `/tmp/remotion-${asset.id}-${Date.now()}.mp4`;

  // Get Chrome executable from @sparticuz/chromium (same binary Puppeteer uses)
  const executablePath = await chromium.executablePath();

  // Resolve composition metadata
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps: { data: asset.data, citations: asset.citations ?? [] },
    chromiumOptions: {
      executablePath,
      args: chromium.args,
      headless: true,
    },
  });

  console.log(
    `[visual-gen] Rendering ${compositionId} — ${composition.durationInFrames} frames at ${composition.fps}fps`
  );

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { data: asset.data, citations: asset.citations ?? [] },
    chromiumOptions: {
      executablePath,
      args: chromium.args,
      headless: true,
    },
    // Concurrency 1 — Lambda has limited CPU, avoid thrashing
    concurrency: 1,
    // Mute verbose Remotion logs — keep CloudWatch clean
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 25 === 0) {
        console.log(`[visual-gen] ${compositionId} render progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  const buffer = fs.readFileSync(outputPath);
  // Clean up tmp file
  try { fs.unlinkSync(outputPath); } catch { /* best-effort */ }

  return {
    buffer,
    format: "mp4",
    width: composition.width,
    height: composition.height,
  };
}
