---
name: instagram-adaptor
description: >
  Instagram content adaptation skill. Use this whenever a user wants to
  repurpose a YouTube script or research brief for Instagram, needs a Reel
  script, wants carousel slide copy, needs Instagram captions with hashtags,
  or wants a Story sequence. Triggers on: "make an Instagram Reel", "adapt
  for Instagram", "create carousel", "IG content", "short form version",
  "repurpose for Instagram", or any request to create vertical short-form
  content from existing video material.
---

# Instagram Adaptor Skill

## Purpose
Transform long-form YouTube content into Instagram-native formats that maximise reach. Instagram and YouTube require fundamentally different content structures — this skill handles the translation. One YouTube video should produce at minimum: one Reel, one carousel, and one caption-only post. Together these create a content ecosystem that drives traffic back to YouTube.

## Model
Use **claude-opus-4** via AWS Bedrock (`anthropic.claude-opus-4-5`) for Reel scripts — the quality of the hook and copy here directly determines reach, and Opus produces noticeably better punchy short-form creative writing.

Use **claude-haiku-4-5** for hashtag generation and caption variants — these are shorter, structured outputs where speed and cost matter more.

---

## The Instagram Algorithm in 2025

Instagram ranks content primarily on:
1. **Saves** — strongest signal. Content people want to return to.
2. **Shares to Stories** — second strongest. Creates viral loops.
3. **Watch completion on Reels** — if 60%+ of viewers finish, the algorithm aggressively distributes
4. **Comments** — especially replies and multi-turn threads
5. **Likes** — weakest signal, but still matters for initial boost

Every content decision should be traceable back to increasing one of these signals.

---

## Content Formats

### Format 1: Reel (Primary, 30–90 seconds)

**Structure — non-negotiable:**

```
0–3 sec:   SCROLL STOPPER
           Bold text on screen + spoken hook simultaneously
           Must answer: "why should I stop scrolling right now?"
           Technique: provocative question, shocking stat, or visual contrast

3–8 sec:   PROBLEM / SETUP
           Name the pain or curiosity gap the viewer has
           "If you've ever wondered why X keeps happening to you..."

8–45 sec:  VALUE DELIVERY
           Fast cuts every 2–3 seconds (video pipeline handles this)
           Each sentence = one new idea
           No filler, no repetition

45–55 sec: PAYOFF
           The single most valuable insight from the YouTube research
           This is what earns the Save

55–60 sec: CTA
           ONE action only — never ask for multiple things
           Best performing: "Save this" > "Follow for more" > "Comment X if..."
```

**Reel Script Output:**
The script for a Reel is a word-for-word narration with on-screen text suggestions inline.

Format: `[ON SCREEN: text] Spoken narration here. [PAUSE 0.3s] Next sentence.`

---

### Format 2: Carousel (5–10 slides)

Carousels get 3× more reach than single images because Instagram shows them to non-followers when users swipe. Each swipe is counted as engagement.

**Slide structure:**

```
Slide 1 (Cover):  Hook — same urgency as Reel scroll stopper
                  Max 7 words of bold text
                  Sub-line: "Swipe to see all X"

Slides 2–N:       One idea per slide
                  Headline (5 words max) + 1–2 sentence explanation
                  Visual note for design

Last slide (CTA): "Save this for later" + follow prompt
                  Include: your handle
```

Pull carousel content from the `keyFacts` and `pros`/`cons` in the research brief. The best carousels are reference material people save and return to.

---

### Format 3: Caption-Only Post (for feed)

Used with a single static image (thumbnail repurposed).

**Caption formula:**
```
Line 1–2:   Hook (shown before "more" cutoff — 125 chars max)
[line break]
Lines 3–8:  Value — 3–5 punchy insights or story beats
[line break]
Line 9:     Engagement question — invites a comment
Line 10:    CTA: "Save this" or "Tag someone who needs this"
[5 dots, one per line, to push hashtags below fold]
.
.
.
.
.
[hashtags]
```

---

## Hashtag Strategy

Use **claude-haiku-4-5** for hashtag generation. Mix three tiers to maximise both reach and conversion:

```
Tier 1 — Broad (5 tags):    1M–10M posts  → initial distribution
Tier 2 — Mid (10 tags):     100k–1M posts → engaged niche
Tier 3 — Niche (8 tags):    <100k posts   → high-intent, low competition

Total: 23 hashtags (Instagram sweet spot — enough variety, not spammy)
```

Always include:
- 2–3 hashtags that match the YouTube video's primary keywords (cross-platform SEO)
- 1 branded hashtag (channel name) for discoverability

---

## Output Contract

```json
{
  "reel": {
    "durationSeconds": "number — target 30-60",
    "script": "string — full word-for-word narration with [ON SCREEN: x] markers",
    "onScreenTextSequence": [
      { "second": "number", "text": "string", "style": "bold | subtitle | emphasis" }
    ],
    "visualNotes": "string — fast-cut B-roll guidance for video-pipeline",
    "audioNote": "string — tone/pace guidance for ElevenLabs TTS",
    "coverFrameSuggestion": "string — which frame makes best Reel cover thumbnail"
  },

  "carousel": {
    "slides": [
      {
        "slideNumber": "number",
        "headline": "string — max 7 words",
        "body": "string — 1-2 sentences",
        "visualNote": "string — design/image guidance for thumbnail-generator skill",
        "type": "cover | content | cta"
      }
    ]
  },

  "captionPost": {
    "caption": "string — full caption with line breaks as \\n",
    "hashtags": {
      "tier1": ["string"],
      "tier2": ["string"],
      "tier3": ["string"],
      "branded": ["string"]
    },
    "bestPostTime": "string — e.g. 'Tuesday 7–9 PM IST'",
    "engagementQuestion": "string — the comment-driving question at end of caption"
  },

  "crossPromoLine": "string — one sentence to use in caption/Reel directing to full YouTube video"
}
```

---

## Quality Standards

A Reel script is good when:
- The first 3 words would make someone pause while scrolling at 2× speed
- Every sentence could stand alone as a tweet — no filler
- The CTA asks for exactly one thing
- It drives curiosity about the full YouTube video without giving everything away

A carousel is good when:
- Slide 1 makes someone want to swipe immediately
- Each slide could be screenshotted and shared individually
- The last slide has a reason to save (reference value)

---

## Platform Differences Summary

| Element | YouTube | Instagram Reel |
|---------|---------|----------------|
| Optimal length | 8–15 min | 30–60 sec |
| Pacing | 1 idea / 2–3 min | 1 idea / 3–5 sec |
| Hook window | 30 sec | 3 sec |
| CTA count | 2–3 (subscribe, like, watch next) | 1 only |
| Text on screen | Chapters / lower thirds | Dominant, large, frequent |
| Goal | Watch time + subscribers | Saves + shares + follows |

---

## References
- See `references/instagram-algorithm.md` for detailed ranking factor weights
- See `references/reel-hooks.md` for 20 proven scroll-stopper formulas
