/**
 * Fetch an official image from a URL (paper figures, press images, etc).
 * Validates content-type is an image before returning.
 */
export async function fetchOfficialImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RRQBot/1.0; +https://rrq.ai/bot)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `URL ${url} returned non-image content-type: ${contentType}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
