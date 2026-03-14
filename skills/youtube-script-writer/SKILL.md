---
name: youtube-script-writer
description: >
  Professional YouTube script writing skill. Use this whenever a user needs
  a full YouTube video script, wants to turn research into a structured
  narration, needs chapter breakdowns, wants re-engagement hooks written in,
  or asks to write a script for any duration. Triggers on: "write the script",
  "generate script", "turn this into a video", "script for X minute video",
  or any request to produce speakable narration for YouTube content.
---

## Dependency: MUSE Blueprint

The script writer never writes on a blank page. Before writing begins,
MUSE has generated a MuseBlueprint with every beat pre-assigned:
- scriptInstruction — what this beat must accomplish
- visualType — what appears on screen
- voiceNote — RRQ voice constraint for this beat
- retentionDevice — if active, which device to apply

**The script writer's job is to write the words that execute MUSE's architecture.**
Do not invent structure. Do not reorder beats. Trust the blueprint.
Read `skills/muse/SKILL.md` before writing any script.

---

# YouTube Script Writer Skill

## Purpose
Transform research briefs into watch-time-maximising scripts. The script structure is engineered around YouTube's retention curve — most viewers leave in the first 30 seconds, then again at 50% through. Every structural decision fights these drop-off points.

## Model
Use **claude-opus-4** via AWS Bedrock (`anthropic.claude-opus-4-5`) for the full long-form script.
Script quality is the single biggest driver of watch time and subscriber growth — this is not a place to save cost. Opus produces measurably better hooks, transitions, and re-engagement moments.

Use **claude-haiku-4-5** for the Shorts script only — it's short, structured, and cost matters at scale.

Pass the full research JSON as system prompt and enable prompt caching — saves ~60% on input tokens for any rewrite calls.

---

## Voice Selection Logic

The script writer selects the appropriate ElevenLabs voice gender and style based on topic context. This decision is passed to the audio-gen Lambda so it picks the right voice ID automatically.

**Voice gender rules:**
```
Male voice:
  - Tech reviews, car launches, finance, history, gaming
  - Topics where authority/expertise tone works best
  - Default for ambiguous topics

Female voice:
  - Beauty, skincare, lifestyle, wellness, fashion, food
  - Topics where warmth and relatability drive engagement
  - Parenting, relationships, personal development

Either (pick based on tone):
  - Travel, cooking, general education, storytelling
  - Documentary style → male slightly preferred
  - Conversational style → female slightly preferred
```

**Voice style rules:**
```
Analytical tone  → measured pace, clear diction, minimal inflection
Enthusiastic     → faster pace, higher energy, more dynamic range
Documentary      → deep, authoritative, slower pace
Conversational   → natural, warm, casual delivery
```

Output a `voiceConfig` object alongside the script:
```json
{
  "voiceConfig": {
    "gender": "male | female",
    "style": "analytical | enthusiastic | documentary | conversational",
    "reasoning": "string — why this voice suits the topic"
  }
}
```

The audio-gen Lambda uses `gender` + `style` to select the best matching ElevenLabs voice ID from the pool.

---

## Word Count Calibration

YouTube delivery pace is 130–150 words per minute for a natural, engaging voice. Script to this:

| Duration | Target Words | With pauses |
|----------|-------------|-------------|
| 3 min    | ~400 words  | 390–420     |
| 5 min    | ~700 words  | 650–730     |
| 8 min    | ~1100 words | 1050–1150   |
| 10 min   | ~1350 words | 1300–1400   |
| 15 min   | ~2050 words | 2000–2100   |

If the script is too short for the target duration, the video will feel rushed. Too long and the editor must cut content, killing chapter timestamps.

---

## Script Architecture

Every YouTube script must follow this exact section sequence. The labels are used by downstream video pipeline to sync B-roll.

### 1. HOOK (0:00–0:30, ~65 words)
This is the most important 30 seconds. It must:
- Open with the most surprising fact, counterintuitive claim, or vivid scenario from the research `hook` field
- Never start with "In this video I will..." — viewers leave immediately
- Create a knowledge gap: tease the payoff without delivering it
- End with an implicit or explicit "keep watching" promise

**Pattern:** `[Provocative statement]. [Why this matters to the viewer personally]. [Tease of the revelation coming].`

### 2. INTRO / CREDIBILITY (0:30–1:00, ~65 words)
- One sentence on who this is for
- One sentence on what they'll know by the end
- Do NOT over-explain — viewers came for the content, not a table of contents

### 3. BODY SECTIONS (variable, bulk of script)
Break into 2–4 minute segments with clear transitions. Each section:
- Opens with a mini-hook ("Here's what almost nobody talks about...")
- Delivers the substance clearly and conversationally
- Ends with a bridge to the next section ("But that's only half the picture...")

Include **re-engagement hooks** every 2–3 minutes pulled from research `reEngagementMoments`. These are the moments that spike the retention graph.

### 4. COMPARISON / PROS & CONS (if applicable)
If the research includes pros/cons:
- Present them as a narrative, not a bullet list (viewers are listening, not reading)
- Give the most emotionally resonant pro and con extra airtime
- The controversial angle from research should surface here

### 5. CALL TO ACTION (final 30–60 seconds)
The CTA must feel earned, not bolted on:
- Reference something specific from the video ("If what I said about [X] surprised you...")
- Ask for the subscribe in context of a specific benefit ("Subscribe if you want the follow-up on [related topic]")
- Tease the next video by name if possible
- End screen prompt: "Watch [video title] next — it directly connects to what we just covered"

---

## Output Contract

```json
{
  "title": "string — final chosen title from seoTitles",
  "duration": "number — target minutes",
  "totalWordCount": "number",
  "youtubeDescription": "string — full optimised description, see SEO skill for format",
  "chapters": [
    { "timestamp": "0:00", "label": "string" }
  ],
  "sections": [
    {
      "id": "string — hook | intro | body-1 | body-2 | comparison | cta",
      "label": "string — human readable section name",
      "timestampStart": "string — e.g. 0:00",
      "timestampEnd": "string",
      "wordCount": "number",
      "script": "string — full speakable text. Conversational. No bullet points.",
      "visualNote": "string — B-roll suggestion for video-pipeline skill",
      "toneNote": "string — delivery guidance for TTS/voiceover, e.g. 'slow down here', 'emphasis on this word'",
      "displayMode": "avatar-fullscreen | broll-with-corner-avatar | broll-only | visual-asset",
      "visualAssetId": "string — references visualAssets[].id, only present when displayMode is visual-asset"
    }
  ],
  "endScreenSuggestion": "string — what to show on end screen",
  "cardSuggestions": [
    { "timestamp": "string", "text": "string", "linkTarget": "string — 'subscribe' | 'playlist' | 'video'" }
  ],

  "visualAssets": [
    {
      "id": "string — e.g. comparison-table-1, bar-chart-2",
      "sectionId": "string — which section this belongs to",
      "type": "comparison-table | bar-chart | line-chart | radar-chart | flow-diagram | infographic-card | personality-card | news-timeline | stat-callout",
      "insertAt": "string — timestamp e.g. 2:15",
      "duration": "number — seconds to show this visual",
      "animated": "boolean — true for animated render, false for static screenshot",
      "data": "object — type-specific data structure (see Visual Asset Data Shapes below)",
      "citations": ["string — citation IDs from research output e.g. ref-1, ref-2"]
    }
  ]
}
```

---

## Visual Asset Data Shapes

Each `type` has its own `data` structure. Opus must populate these from `comparativeData` and `keyFacts` in the research output — never invent numbers.

### comparison-table
```json
{
  "title": "string",
  "columns": ["string"],
  "rows": [["string"]],
  "highlightWinner": "boolean",
  "winnerCol": "number — index of winning column",
  "footnote": "string — optional source note shown below table"
}
```

### bar-chart / line-chart
```json
{
  "title": "string",
  "xLabel": "string",
  "yLabel": "string",
  "unit": "string — e.g. $, hrs, fps",
  "datasets": [
    {
      "label": "string",
      "colour": "string — hex",
      "values": [
        { "x": "string", "y": "number" }
      ]
    }
  ],
  "footnote": "string"
}
```

### radar-chart
```json
{
  "title": "string",
  "dimensions": ["string — e.g. Performance, Battery, Value"],
  "subjects": [
    {
      "label": "string",
      "colour": "string — hex",
      "scores": ["number — 0-10 per dimension, in same order as dimensions"]
    }
  ]
}
```

### flow-diagram
```json
{
  "title": "string",
  "mermaid": "string — valid Mermaid.js flowchart syntax",
  "direction": "LR | TD"
}
```

### infographic-card
```json
{
  "stat": "string — large headline number or word e.g. 67%",
  "label": "string — what the stat means",
  "context": "string — one sentence of context",
  "source": "string — source name",
  "sourceUrl": "string"
}
```

### personality-card
```json
{
  "name": "string",
  "role": "string",
  "organisation": "string",
  "imageUrl": "string — verified URL",
  "facts": ["string — 3-4 key facts"],
  "source": "Wikipedia | official",
  "sourceUrl": "string"
}
```

### news-timeline
```json
{
  "title": "string",
  "events": [
    {
      "date": "string",
      "headline": "string",
      "detail": "string — one sentence",
      "sourceUrl": "string"
    }
  ]
}
```

### stat-callout
```json
{
  "stat": "string — bold large text",
  "subtext": "string",
  "sourceUrl": "string"
}
```

---

## displayMode Selection Rules

Opus selects `displayMode` per section based on content type:

```
hook              → avatar-fullscreen (face builds trust immediately)
intro             → avatar-fullscreen
body (explaining) → broll-with-corner-avatar (B-roll illustrates topic)
body (data heavy) → visual-asset (chart or table takes full screen)
comparison        → visual-asset (comparison table always beats spoken comparison)
stat reveal       → visual-asset (infographic-card for impact)
personality ref   → visual-asset (personality-card when mentioning a person)
news event        → visual-asset (news-timeline for event sequences)
cta               → avatar-fullscreen (personal connection drives subscribe)
```

Never place a visual-asset section without a corresponding entry in `visualAssets`. Never reference a `visualAssetId` that doesn't exist in the array.

---

## Writing Style Rules

These rules exist because they directly affect watch time:

**Conversational over formal.** Write how a smart friend explains something, not how a textbook does. Short sentences. Contractions. Direct address ("you", not "viewers").

**Vary sentence length.** A string of long sentences is hard to follow aurally. Punch short sentences in after complex explanations. Like this.

**Signpost transitions verbally.** Viewers can't re-read. Use explicit verbal transitions: "So now that we know X, let's look at why Y happens."

**Never read numbers cold.** "67.3% of people" is hard to absorb aurally. Write "nearly 7 in 10 people" or "more than two-thirds."

**Pause markers.** Add `[PAUSE]` in the script where a beat of silence helps the point land. TTS workers will insert a 0.5s gap here.

---

## Quality Check Before Returning

Before returning the output, verify:
- [ ] Total word count is within 5% of target
- [ ] Hook does NOT begin with "In this video" or "Today we're going to"
- [ ] Every body section ends with a bridge line
- [ ] CTA mentions something specific from the video content
- [ ] `visualNote` on each section is concrete enough for a stock footage search query
- [ ] Chapter timestamps are evenly distributed and match section lengths

---

## YouTube Shorts Script (Option B — Fresh Content)

When user selects "Generate fresh Short content", write a completely separate script optimised for Shorts. Use **claude-haiku-4-5** — it's a short, structured task.

**Shorts rules are different from long form:**
- 45–60 seconds maximum, ~100–120 words
- No intro, no context setting — value starts at word one
- One single idea only — not a summary of the main video
- Pick the most surprising or controversial point from research
- End with "Full video in description" not a subscribe CTA

**Shorts script structure:**
```
0:00–0:05  Hook — single provocative statement
0:05–0:40  One idea delivered fast, no filler
0:40–0:55  Payoff — the satisfying answer or reveal
0:55–1:00  "Watch the full breakdown — link in description"
```

**Output for Shorts:**
```json
{
  "shortsScript": {
    "hook": "string — first spoken line, must be provocative",
    "body": "string — full word-for-word script, ~100 words",
    "onScreenText": ["string — 3-4 text overlays for the video"],
    "visualNote": "string — single B-roll search query",
    "duration": "number — target seconds (45-60)"
  }
}
```

---

## References
- See `references/retention-patterns.md` for proven structural patterns by video type
- See `references/cta-formulas.md` for high-converting CTA variations
