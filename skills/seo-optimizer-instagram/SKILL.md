---
name: seo-optimizer-instagram
description: >
  Instagram SEO and reach optimisation skill. Use this whenever a user needs
  to maximise Instagram reach, wants the best hashtags, needs caption
  optimisation, wants to know the best posting time, needs to optimise a
  Reel for Explore page, or wants to grow Instagram followers from zero.
  Triggers on: "Instagram hashtags", "optimise for Instagram", "Instagram
  SEO", "Explore page", "Reel reach", "Instagram growth", "best time to
  post Instagram", or any request to maximise Instagram content performance.
---

# Instagram SEO Optimiser Skill

## Purpose
Maximise Instagram reach through algorithmic and discovery optimisation. Unlike YouTube (search-driven), Instagram is primarily a **behaviour-driven** platform — the algorithm amplifies content that generates fast engagement signals, particularly saves and shares, within the first 30–60 minutes of posting.

## Model
Use **claude-haiku-4-5** via AWS Bedrock for hashtag generation and time optimisation — these are fast, structured tasks.
Use **claude-sonnet-4** for caption writing — quality matters here for engagement rate.

---

## Instagram's Discovery Ecosystem

Content reaches new audiences through four surfaces. Optimise for all four:

```
1. Home Feed        — shown to followers. Speed of engagement matters.
2. Explore Page     — shown to non-followers. Saves/shares trigger this.
3. Reels Tab        — shown based on watch completion + audio trends.
4. Hashtag Search   — shown when users search specific tags.
```

A single well-optimised post can hit all four simultaneously. Most creators only optimise for one.

---

## Hashtag Strategy (Deep)

The goal is not maximum reach — it's **relevant reach** that converts to follows, saves, and traffic to YouTube.

### The Three-Tier System

**Tier 1 — Volume (5 tags, 1M–10M posts)**
These get you in front of large audiences. Low conversion but needed for initial distribution boost. Use 1–2 highly specific ones that are directly on-topic (not just large). Avoid hashtags over 50M posts — too competitive, your content drowns.

**Tier 2 — Mid (8–10 tags, 100k–1M posts)**
This is the most important tier. Large enough to have active viewers, small enough that your content can rank in "Top Posts". Target hashtags where the top 9 posts have under 5,000 likes — achievable to compete.

**Tier 3 — Niche (6–8 tags, 10k–100k posts)**
These punch above their weight for conversions. Viewers who browse niche hashtags are highly interested and much more likely to follow, save, and click through to YouTube.

### Hashtag Research Logic

For each video topic, generate hashtags across:
- The topic itself (exact and adjacent)
- The emotion/outcome the viewer wants
- The audience identity ("entrepreneur", "fitness enthusiast", "developer")
- The content format ("tips", "explained", "breakdown", "honest review")

Never use:
- Generic banned/overused tags (#love, #instagood, #followme) — shadowban risk
- Completely unrelated tags for volume — triggers spam classification
- Repeating the same tags across every post — Instagram's algorithm penalises this

Rotate 30–40% of tags between posts.

### Hashtag Placement
Place hashtags as the first comment (not in caption) for cleaner caption display while preserving discoverability. Caption stays readable; algorithm sees hashtags regardless of placement.

---

## Caption Optimisation

### The 125-Character Rule
Instagram shows the first 125 characters before the "more" button. This is the hook — it must either:
- Deliver immediate value so the reader saves it, OR
- Create enough curiosity that they tap "more"

Never waste the first 125 chars on: "Hey guys!", context-setting, or your channel name.

### Engagement Multiplier Techniques

**The Open Loop:** End the caption with a question that has no wrong answer.
`"Which of these did you already know? Drop it below 👇"`

**The Polariser:** State a clear opinion. Agreers and disagreers both comment.
`"Unpopular opinion: most people are doing [X] backwards. Agree?"`

**The Save Trigger:** Tell them explicitly why saving is useful.
`"Save this — you'll want to come back to point 3 before your next [X]"`

**The Identity Signal:** Let them self-identify in comments.
`"Type YES if you've made this mistake before"`

---

## Reel Optimisation for Explore

For a Reel to hit Explore, it needs watch completion above ~60% and strong early engagement. Optimise:

**First Frame:** Must work as a static image — many viewers see thumbnail before playing. Bold text on high-contrast background.

**Audio:** Use trending audio where possible (Instagram surfaces Reels using trending sounds). If using original audio/voiceover, ensure the Reel can be understood without sound (add subtitles).

**Subtitle Overlay:** 85% of Instagram videos are watched without sound. Subtitles are not optional.

**Length Sweet Spot (2025):** 30–45 seconds for maximum completion rate. Under 30 seconds often feels rushed. Over 60 seconds drops completion sharply unless the hook is exceptional.

---

## Posting Time Optimisation

Unlike YouTube (schedule in advance), Instagram rewards **native posting** (post in-app or via official API at optimal time, not scheduling tools that post late).

```
Best times by day (IST, adjust for audience analytics):
  Monday:     6–8 AM, 7–9 PM
  Tuesday:    7–9 PM ← consistently strong
  Wednesday:  11 AM–1 PM
  Thursday:   7–9 PM ← best overall day
  Friday:     11 AM–1 PM, 7–9 PM
  Saturday:   9–11 AM ← high leisure browsing
  Sunday:     10 AM–12 PM

Post frequency: 3–5 Reels/week is optimal for algorithm favour
Story frequency: daily (keeps you top of followers' story bars)
```

---

## Output Contract

```json
{
  "reel": {
    "hashtags": {
      "tier1": ["string"],
      "tier2": ["string"],
      "tier3": ["string"],
      "branded": ["string"],
      "firstCommentText": "string — all hashtags formatted for first comment post"
    },
    "captionOptimised": "string — full caption with \\n breaks",
    "firstFrameText": "string — bold text for Reel thumbnail frame",
    "audioRecommendation": "string — trending sound suggestion or 'original voiceover'",
    "optimalPostTime": "string — specific day and time slot",
    "altPostTime": "string — backup slot"
  },

  "carousel": {
    "hashtags": {
      "firstCommentText": "string"
    },
    "captionOptimised": "string",
    "optimalPostTime": "string"
  },

  "crossPlatformSEO": {
    "keywordsShared": ["string — keywords used on both YT and IG for cross-platform reinforcement"],
    "youtubeTrafficLine": "string — the specific line in caption that drives to YouTube"
  },

  "postingSchedule": [
    {
      "contentType": "Reel | Carousel | Story",
      "dayOfWeek": "string",
      "timeIST": "string",
      "rationale": "string"
    }
  ],

  "growthProjection": "string — realistic follower growth estimate per month at this posting cadence"
}
```

---

## Quality Standards

The Instagram SEO output is strong when:
- No hashtag in Tier 2 has more than 5 million posts
- Caption first line would make someone pause their scroll
- Posting time is in a Tier 1 or Tier 2 window for the day
- The CTA asks for exactly one action
- Cross-promotion line to YouTube feels natural, not like an ad

---

## References
- See `references/instagram-algorithm.md` for 2025 ranking factor details
- See `references/hashtag-research.md` for niche hashtag discovery process
