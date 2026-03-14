import { getBrowser } from "./browser";
import { buildHTML } from "./templates";
import { renderWithRemotion } from "./remotion-renderer";

interface VisualAssetInput {
  id: string;
  sectionId: string;
  type: string;
  duration: number;
  animated: boolean;
  data: Record<string, unknown>;
  citations?: string[];
}

interface RenderResult {
  buffer: Buffer;
  format: "png" | "mp4";
  width: number;
  height: number;
}

const WIDTH = 1920;
const HEIGHT = 1080;

/**
 * Render a visual asset.
 *
 * Primary path: Remotion — renders animated MP4 for every visual type.
 * Fallback: Puppeteer HTML screenshot (PNG) — fires if Remotion throws.
 *
 * All visual beats render as MP4 (quality > speed decision, Phase 3.5).
 */
export async function renderVisual(asset: VisualAssetInput): Promise<RenderResult> {
  // Primary — Remotion renders animated MP4
  try {
    return await renderWithRemotion(asset);
  } catch (err) {
    console.warn(
      `[visual-gen] Remotion failed for ${asset.type} (${asset.id}), falling back to Puppeteer: ${err}`
    );
  }

  // Fallback — Puppeteer HTML screenshot (PNG)
  return await renderWithPuppeteer(asset);
}

/**
 * Puppeteer fallback — renders static HTML template to PNG.
 * Used only when Remotion render fails.
 */
async function renderWithPuppeteer(asset: VisualAssetInput): Promise<RenderResult> {
  const html = buildHTML(asset.type, asset.data, asset.citations ?? []);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: WIDTH, height: HEIGHT });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });

    if (["bar-chart", "line-chart", "radar-chart"].includes(asset.type)) {
      await page.waitForFunction(
        () => document.querySelector("canvas") !== null,
        { timeout: 10_000 }
      );
      await new Promise((r) => setTimeout(r, 2000));
    } else if (asset.type === "flow-diagram") {
      await page.waitForSelector("svg", { timeout: 10_000 });
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });

    return {
      buffer: Buffer.from(screenshot),
      format: "png",
      width: WIDTH,
      height: HEIGHT,
    };
  } finally {
    await page.close();
  }
}
