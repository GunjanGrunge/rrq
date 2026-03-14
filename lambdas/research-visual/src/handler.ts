import type { Handler } from "aws-lambda";
import {
  ResearchVisualInput,
  type ResearchVisualInputType,
  type ResearchVisualOutputType,
} from "@rrq/lambda-types";
import { fetchOfficialImage } from "./official-image";
import { captureScreenRecording } from "./screen-capture";
import { fetchStockImage } from "./stock";
import { uploadToS3 } from "./s3";

/**
 * research-visual Lambda (container deploy — includes Puppeteer + Chromium)
 *
 * Handles beats with visualType: IMAGE or SCREEN_RECORD.
 * Sources real-world visuals: paper figures, official press images,
 * screen recordings of live demos, and stock footage fallback.
 */
export const handler: Handler = async (event) => {
  const jobId = event.jobId ?? "unknown";

  try {
    const input: ResearchVisualInputType = ResearchVisualInput.parse(event);
    console.log(
      `[research-visual] Starting job ${input.jobId}, ${input.beats.length} beats, niche: ${input.niche}`
    );

    const assets: ResearchVisualOutputType["assets"] = [];

    // Process beats sequentially — Puppeteer needs serialised access
    for (const beat of input.beats) {
      console.log(
        `[research-visual][${input.jobId}] Processing beat ${beat.id}: ${beat.visualType}`
      );

      try {
        if (beat.visualType === "SCREEN_RECORD" && beat.sourceUrl) {
          // Screen recording of a live demo / playground
          const videoBuffer = await captureScreenRecording(
            beat.sourceUrl,
            beat.topicContext
          );
          const s3Key = `jobs/${input.jobId}/research-visuals/${beat.id}.mp4`;
          await uploadToS3(s3Key, videoBuffer, "video/mp4");

          assets.push({
            beatId: beat.id,
            s3Key,
            type: "video",
            source: beat.sourceUrl,
            durationMs: 30_000, // default 30s recording
          });
        } else if (beat.visualType === "IMAGE" && beat.sourceUrl) {
          // Official image / paper figure fetch
          const imageBuffer = await fetchOfficialImage(beat.sourceUrl);
          const s3Key = `jobs/${input.jobId}/research-visuals/${beat.id}.png`;
          await uploadToS3(s3Key, imageBuffer, "image/png");

          assets.push({
            beatId: beat.id,
            s3Key,
            type: "image",
            source: beat.sourceUrl,
            attribution: extractDomain(beat.sourceUrl),
          });
        } else if (beat.stockSearchTerms && beat.stockSearchTerms.length > 0) {
          // Stock image fallback
          const result = await fetchStockImage(beat.stockSearchTerms);
          if (result) {
            const s3Key = `jobs/${input.jobId}/research-visuals/${beat.id}.jpg`;
            await uploadToS3(s3Key, result.buffer, "image/jpeg");

            assets.push({
              beatId: beat.id,
              s3Key,
              type: "image",
              source: result.sourceUrl,
              attribution: result.attribution,
            });
          } else {
            console.warn(
              `[research-visual][${input.jobId}] No stock result for beat ${beat.id}`
            );
          }
        } else {
          // Screenshot of the source URL as fallback
          if (beat.sourceUrl) {
            const screenshotBuffer = await captureScreenshot(beat.sourceUrl);
            const s3Key = `jobs/${input.jobId}/research-visuals/${beat.id}.png`;
            await uploadToS3(s3Key, screenshotBuffer, "image/png");

            assets.push({
              beatId: beat.id,
              s3Key,
              type: "screenshot",
              source: beat.sourceUrl,
            });
          }
        }
      } catch (err) {
        console.error(
          `[research-visual][${input.jobId}] Beat ${beat.id} failed:`,
          err
        );
        // Individual beat failure doesn't stop the pipeline
      }
    }

    console.log(
      `[research-visual][${input.jobId}] Complete. ${assets.length}/${input.beats.length} beats sourced`
    );

    const output: ResearchVisualOutputType = { assets };

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: output }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[research-visual][${jobId}] FAILED:`, message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: message }),
    };
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

async function captureScreenshot(url: string): Promise<Buffer> {
  const { getBrowser } = await import("./browser");
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
