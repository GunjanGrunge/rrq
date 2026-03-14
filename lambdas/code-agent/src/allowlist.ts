// Domain allowlist for TONY's sandboxed code execution.
// Outbound fetch() from generated code is blocked EXCEPT for these domains.
// Expand conservatively — each addition widens the attack surface.

export const ALLOWED_DOMAINS: readonly string[] = [
  // Research & data
  "reddit.com",
  "old.reddit.com",
  "www.reddit.com",
  "gdeltproject.org",
  "api.gdeltproject.org",
  "trends.google.com",
  "serpapi.com",
  "newsapi.org",
  // Social signals
  "api.twitter.com",
  "api.x.com",
  // Events calendar
  "api.ticketmaster.com",
  // YouTube & Google APIs
  "www.googleapis.com",
  "youtube.com",
  "www.youtube.com",
  // Wikipedia (research)
  "en.wikipedia.org",
  "www.wikipedia.org",
  // AWS internal — S3 only (DynamoDB access goes through Lambda role, not fetch)
  "s3.amazonaws.com",
  "s3.us-east-1.amazonaws.com",
] as const;

export function isDomainAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}
