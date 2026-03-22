import path from "path";
import fs from "fs";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { renderMedia, selectComposition } from "@remotion/renderer";
import chromium from "@sparticuz/chromium";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

/**
 * Downloads the pre-built Remotion bundle from S3 to /tmp and returns the path.
 * The bundle is a single HTML file + assets built by remotion bundle.
 * REMOTION_BUNDLE_S3_KEY = S3 key of the bundle index.html parent dir (zip)
 */
async function downloadBundleFromS3(): Promise<string> {
  const s3Key = process.env.REMOTION_BUNDLE_S3_KEY;
  const bucket = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";
  if (!s3Key) throw new Error("[visual-gen] REMOTION_BUNDLE_S3_KEY not set");

  const localZip = "/tmp/remotion-bundle.zip";
  const localDir = "/tmp/remotion-bundle";

  // Already extracted on a warm invocation
  const indexHtml = path.join(localDir, "index.html");
  if (fs.existsSync(indexHtml)) return indexHtml;

  console.log(`[visual-gen] Downloading Remotion bundle from s3://${bucket}/${s3Key}`);
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  if (!Body) throw new Error("[visual-gen] Empty S3 body for bundle zip");

  // Write zip to /tmp
  await pipeline(Body as NodeJS.ReadableStream, createWriteStream(localZip));

  // Unzip
  const { execSync } = await import("child_process");
  fs.mkdirSync(localDir, { recursive: true });
  execSync(`unzip -q -o ${localZip} -d ${localDir}`);
  fs.unlinkSync(localZip);

  console.log(`[visual-gen] Bundle extracted to ${localDir}`);
  return indexHtml;
}

async function getBundleLocation(): Promise<string> {
  // 1. Env-var override (e.g. local dev or pre-baked Docker path)
  const prebaked = process.env.REMOTION_BUNDLE_PATH;
  if (prebaked && fs.existsSync(prebaked)) return prebaked;

  // 2. S3-hosted pre-built bundle (production path — avoids bundling at runtime)
  if (process.env.REMOTION_BUNDLE_S3_KEY) {
    if (!cachedBundleLocation) {
      cachedBundleLocation = await downloadBundleFromS3();
    }
    return cachedBundleLocation;
  }

  // 3. Runtime bundle fallback (requires @remotion/bundler — development only)
  if (cachedBundleLocation) return cachedBundleLocation;

  console.log("[visual-gen] Bundling Remotion compositions (cold start)...");
  // Dynamic import so bundler is not required in production
  const { bundle } = await import("@remotion/bundler");
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
    browserExecutable: executablePath,
    chromiumOptions: {
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
    browserExecutable: executablePath,
    chromiumOptions: {
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
