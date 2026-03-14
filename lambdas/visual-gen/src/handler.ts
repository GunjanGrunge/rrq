import type { Handler } from "aws-lambda";
import {
  VisualGenInput,
  type VisualGenInputType,
  type VisualGenOutputType,
} from "@rrq/lambda-types";
import { renderVisual } from "./renderer";
import { uploadToS3 } from "./s3";

/**
 * visual-gen Lambda (container deploy — includes Puppeteer + Chromium + Remotion)
 *
 * Primary: Remotion React compositions → animated MP4 (all visual types).
 * Fallback: Puppeteer HTML screenshot → PNG (if Remotion fails).
 *
 * Types: comparison-table, bar-chart, line-chart, radar-chart,
 *        flow-diagram, infographic-card, personality-card,
 *        news-timeline, stat-callout, animated-infographic, geo-map
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: VisualGenInputType = VisualGenInput.parse(event);
    console.log(
      `[visual-gen] Starting job ${input.jobId}, ${input.assets.length} assets`
    );

    const results: VisualGenOutputType["assets"] = [];

    for (const asset of input.assets) {
      console.log(
        `[visual-gen][${input.jobId}] Rendering ${asset.type} (${asset.id})`
      );

      try {
        const rendered = await renderVisual(asset);
        const ext = rendered.format;
        const s3Key = `jobs/${input.jobId}/visuals/${asset.id}.${ext}`;

        await uploadToS3(
          s3Key,
          rendered.buffer,
          ext === "mp4" ? "video/mp4" : "image/png"
        );

        results.push({
          id: asset.id,
          s3Key,
          format: rendered.format,
          width: rendered.width,
          height: rendered.height,
          durationMs: asset.animated ? asset.duration * 1000 : undefined,
        });
      } catch (err) {
        console.error(
          `[visual-gen][${input.jobId}] Asset ${asset.id} failed:`,
          err
        );
      }
    }

    console.log(
      `[visual-gen][${input.jobId}] Complete. ${results.length}/${input.assets.length} rendered`
    );

    const output: VisualGenOutputType = { assets: results };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[visual-gen][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};
