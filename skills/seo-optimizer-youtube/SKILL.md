---
name: seo-optimizer-youtube
description: >
  YouTube SEO optimisation skill. Use this whenever a user needs to optimise
  a YouTube video for maximum impressions and CTR, wants the best title,
  description, tags, or chapter markers, needs keyword research for YouTube
  search, wants to hit 1000 subscribers or 4000 watch hours faster, or asks
  about YouTube algorithm optimisation. Triggers on: "optimise for YouTube",
  "best title for YouTube", "YouTube SEO", "get more views", "improve
  discoverability", "YouTube metadata", or any request to maximise YouTube
  reach and channel growth.
---

# YouTube SEO Optimiser Skill

## Purpose
Produce metadata that maximises: impressions (how often YouTube shows the video in feeds and search), CTR (how often people click when shown), and AVD (average view duration — the strongest ranking signal). These three compound: more impressions × better CTR × higher AVD = exponential growth.

## Model
Use **claude-sonnet-4** via AWS Bedrock (`anthropic.claude-sonnet-4-5`) for titles and descriptions.
Use **claude-haiku-4-5** for tag generation — it's a structured list task.

Enable **prompt caching** on the research JSON passed as system context.

---

## The 1000 Subscribers / 4000 Hours Strategy

The fastest path to monetisation threshold is not chasing views — it's engineering **session starts** and **returning viewers**. YouTube heavily promotes channels where:

1. New viewers discover via search → watch to completion → subscribe
2. Subscribers watch new uploads within 24 hours of release
3. Videos appear in "Up Next" for related channels

Every metadata decision below is calibrated to these three mechanisms.

---

## Title Engineering

### The Title Formula
The best performing YouTube titles in 2025 combine:

```
[Emotional/Curiosity trigger] + [Primary keyword] + [Specificity signal]
```

Examples:
- `Why [TOPIC] Is Destroying Your [Outcome] (Most People Don't Know This)`
- `I Tested [TOPIC] for 30 Days — Here's What Actually Happened`
- `The [TOPIC] Method Nobody Talks About (It Changed Everything)`
- `[Number] [TOPIC] Mistakes That Are Costing You [Outcome]`
- `[TOPIC] vs [TOPIC]: The Honest Truth in [Year]`

### Title Rules
- 50–60 characters is ideal (longer gets truncated on mobile)
- Primary keyword in first 5 words (strongest for search ranking)
- Never write the whole story in the title — preserve curiosity gap
- Capitalise major words for visual weight in feed
- Numbers outperform adjectives: "7 mistakes" > "many mistakes"
- Year in title (`2025`) signals freshness to both algorithm and viewer

### CTR Benchmarks
- <4% CTR: title/thumbnail are misaligned with audience expectation
- 4–8% CTR: healthy, keep iterating
- >8% CTR: viral potential, scale promotion

---

## Description Structure

The description has two jobs: hook non-subscribers who land on the page, and embed keywords for YouTube's search index.

```
[Line 1–2: Hook — first 150 chars shown without clicking "show more"]
This must restate the video's core promise. Not "In this video..." — 
state the value directly. e.g. "After testing 6 different [X] methods,
here's what actually works — and what's a waste of time."

[Line 3: Blank]

[Lines 4–8: Timestamps / Chapters]
00:00 Introduction
00:45 [Chapter 1 name]
...

[Lines 9–15: Keyword-rich paragraph]
Write naturally about the topic using primary, secondary, and long-tail 
keywords from research. 3–5 sentences. Don't keyword-stuff — write for 
a human skimming the description.

[Line 16: Blank]

[Lines 17–20: Links]
🔔 Subscribe: [link]
📱 Instagram: [link]
📧 Newsletter: [link]

[Lines 21–25: Hashtags — 3 to 5 only]
#PrimaryKeyword #SecondaryKeyword #ChannelName
```

---

## Tags Strategy

YouTube tags are less important than title/description but still contribute to "related video" placement (which drives more views than search for most channels).

```
Tag set composition (15–20 total):
  Exact title tags (2–3):    Identical to video title keywords
  Primary topic (3–4):       Broad category terms
  Long-tail (5–6):           Full question phrases
  Related channel tags (3):  Competitor channel names viewers watch
  Branded (2):               Channel name + channel name + topic
```

Use **claude-haiku-4-5** to generate this list given the research keywords. Tags should be ordered: most specific → most broad.

---

## Chapters / Timestamp Strategy

Chapters do four things:
1. Show in Google search results (free impressions outside YouTube)
2. Allow viewers to navigate → reduces early drop-off
3. Signal structure to algorithm
4. Enable mid-video re-entry from notifications

Rules:
- Minimum 3 chapters to activate the feature
- First chapter always starts at `0:00`
- Chapter names must be keyword-rich but readable
- No chapter longer than 3–4 minutes (viewer attention span)
- Final chapter should be the payoff/CTA section

---

## Upload Timing

Best upload windows for maximum first-24h velocity (Indian timezone IST as primary, global secondary):

```
Tier 1 (best):   Thursday–Saturday, 7:00–9:00 PM IST
Tier 2 (good):   Sunday, 10:00 AM–12:00 PM IST
Tier 3 (avoid):  Monday–Wednesday (competition from news cycle)
```

Schedule via YouTube Data API `scheduledStartTime` field. Do NOT publish immediately — schedule 2–4 hours ahead to allow thumbnail and metadata indexing.

**Jason sprint coordination:** If Jason's current sprint has a scheduled upload
date for this video, use that date as the anchor and find the nearest Tier 1
or Tier 2 window. Never push a video past the sprint's scheduled date to hit
a better window — sprint commitment takes priority over minor timing optimisation.
A Tier 2 upload on the sprint date beats a Tier 1 upload two days late.

---

## Output Contract

```json
{
  "finalTitle": "string — winning title (max 60 chars)",
  "titleVariants": [
    { "title": "string", "formula": "string", "rationale": "string" }
  ],
  "description": "string — full formatted description with \\n line breaks",
  "tags": ["string"],
  "chapters": [
    { "timestamp": "0:00", "label": "string" }
  ],
  "hashtags": ["string"],
  "category": "string — YouTube category name e.g. 'Education', 'Science & Technology'",
  "madeForKids": "boolean",
  "scheduledTime": "string — ISO 8601 datetime, pre-calculated to next optimal slot",
  "thumbnailABVariants": [
    { "concept": "string", "emotion": "string", "textOverlay": "string" }
  ],
  "expectedCTR": "string — low | medium | high based on title strength",
  "seoStrengthScore": "number 1-10",
  "seoNotes": "string — brief explanation of optimisation choices"
}
```

---

## Quality Standards

The SEO output is strong when:
- Title contains the primary keyword in first 3–4 words
- Description first line doesn't start with "In this video"
- Tags include at least 3 full question phrases
- Chapter timestamps are evenly spaced (no 6-minute gaps)
- Scheduled time falls in Tier 1 or Tier 2 window
- Title makes the reader slightly uncomfortable NOT clicking

---

## The 4000 Watch Hours Lever

Watch hours = views × average view duration. The fastest way to hit 4000 hours is not more views — it's longer videos with better retention.

Signal this in SEO by:
- Titling to attract highly-interested viewers (not casual browsers) — 15 clicks from engaged viewers > 100 clicks from uninterested ones
- Chapter structure that signals depth: "Part 1", "Part 2" patterns suggest thorough content
- End screen optimised to chain watch time: always recommend a related long-form video

---

## YouTube Shorts SEO

Shorts have completely different SEO rules. Use **claude-haiku-4-5** for Shorts metadata — it's a simple, fast task.

**Shorts title rules:**
- Under 40 characters (Shorts UI truncates more aggressively)
- No clickbait — Shorts algorithm penalises high click / low completion
- Include the main keyword naturally
- Example: `"MacBook Neo — Worth It?"` not `"MacBook Neo vs Pro M3 The Honest Truth Nobody Tells You"`

**Shorts description:**
```
Line 1: One sentence summary of the Short
Line 2: "Full breakdown → [link to main video]"
Line 3: 3-5 hashtags including #Shorts
```

Always include `#Shorts` — this is how YouTube classifies the video as a Short.

**Shorts upload timing:**
Shorts benefit from posting 2-3 hours BEFORE the main video goes live. Creates anticipation and drives viewers to the full video.

**Shorts SEO output:**
```json
{
  "shortsTitle": "string — under 40 chars",
  "shortsDescription": "string",
  "shortsHashtags": ["#Shorts", "string", "string"],
  "shortsScheduledTime": "string — 2-3 hours before main video"
}
```

---

## References
- See `references/youtube-algorithm.md` for full ranking factor breakdown
- See `references/title-formulas.md` for 30 proven title structures with benchmarks
