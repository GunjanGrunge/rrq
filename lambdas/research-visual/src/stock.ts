/**
 * Fetch stock images from Pexels (free API, attribution required).
 * Fallback to Pixabay if Pexels returns no results.
 */

interface StockResult {
  buffer: Buffer;
  sourceUrl: string;
  attribution: string;
}

export async function fetchStockImage(
  searchTerms: string[]
): Promise<StockResult | null> {
  const query = searchTerms.join(" ");

  // Try Pexels first
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    const result = await tryPexels(query, pexelsKey);
    if (result) return result;
  }

  // Fallback to Pixabay
  const pixabayKey = process.env.PIXABAY_API_KEY;
  if (pixabayKey) {
    const result = await tryPixabay(query, pixabayKey);
    if (result) return result;
  }

  return null;
}

async function tryPexels(
  query: string,
  apiKey: string
): Promise<StockResult | null> {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    const imageResponse = await fetch(photo.src.large2x, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!imageResponse.ok) return null;

    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    return {
      buffer,
      sourceUrl: photo.url,
      attribution: `Photo by ${photo.photographer} on Pexels`,
    };
  } catch {
    return null;
  }
}

async function tryPixabay(
  query: string,
  apiKey: string
): Promise<StockResult | null> {
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=3&orientation=horizontal&image_type=photo`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const hit = data.hits?.[0];
    if (!hit) return null;

    const imageResponse = await fetch(hit.largeImageURL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!imageResponse.ok) return null;

    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    return {
      buffer,
      sourceUrl: hit.pageURL,
      attribution: `Image by ${hit.user} on Pixabay`,
    };
  } catch {
    return null;
  }
}
