---
name: thumbnail-generator
description: >
  YouTube thumbnail and Instagram cover generation skill using Figma MCP.
  Use this whenever a user needs to create a YouTube thumbnail, wants a
  Figma-generated thumbnail, needs an Instagram Reel cover image, wants
  CTR-optimised visual assets, or needs to export a 1280x720 thumbnail.
  Triggers on: "generate thumbnail", "create thumbnail", "Figma thumbnail",
  "make the thumbnail", "video cover image", "thumbnail concept", or any
  request to produce visual cover assets for YouTube or Instagram content.
---

# Thumbnail Generator Skill

## Purpose
Generate CTR-optimised thumbnails for YouTube (1280×720) and cover frames for Instagram Reels using the Figma MCP integration. Thumbnails are the single biggest lever on CTR — a 1% CTR improvement on 10,000 impressions means 100 more views per video, compounding across every upload.

## Model
Use **claude-haiku-4-5** via AWS Bedrock to generate the Figma design instructions and text copy — this is a structured, fast task.

Use the **Figma MCP** for actual design execution. The user must have a Figma template set up (see setup instructions below).

---

## CTR Psychology

Before generating any thumbnail, understand what makes someone click:

**The 3-second rule:** A thumbnail is seen for under 3 seconds in a feed. It must communicate the video's value and create curiosity in that window.

**The 5 levers of a high-CTR thumbnail:**
1. **Face with strong emotion** — humans are wired to look at faces. Shock, excitement, or disgust outperform neutral.
2. **Bold, readable text** — max 4 words. Must be readable at 120×68px (mobile small).
3. **High contrast** — the thumbnail must pop against YouTube's white or Instagram's white/dark backgrounds.
4. **Curiosity gap** — show something visually incomplete that the video resolves.
5. **Brand consistency** — returning viewers click faster when they recognise the channel's visual style.

**Colours that perform well on YouTube:**
- Red background: urgency, danger, excitement
- Yellow/orange: energy, positivity, food content
- Dark with bright accent: premium, tech, finance
- White with bold elements: clean, educational, lifestyle

**Avoid:**
- Blue backgrounds (blends with YouTube's UI)
- Too much text (unreadable at small size)
- Stock photo faces (feels generic)
- Busy, cluttered compositions

---

## Figma Template Setup

The user needs a Figma file with this layer structure. If it doesn't exist, instruct them to create it:

```
YouTube Thumbnail Template (1280 × 720)
├── Background Layer      [name: "bg-layer"]
├── Main Image Frame      [name: "main-image", 640×720, right half]
├── Text Group
│   ├── Headline Text     [name: "headline-text", bold, 80–100pt]
│   ├── Sub Text          [name: "sub-text", 40–50pt]
│   └── Accent Badge      [name: "accent-badge", optional pill/badge]
├── Overlay Gradient      [name: "overlay-gradient", left-to-right fade]
└── Brand Element         [name: "brand-logo", bottom corner]

Instagram Reel Cover Template (1080 × 1920)
├── Background Layer      [name: "ig-bg-layer"]
├── Main Image Frame      [name: "ig-main-image"]
├── Large Text Overlay    [name: "ig-headline", centered, 80–120pt]
├── Sub Text              [name: "ig-sub-text"]
└── Brand Handle          [name: "ig-handle", bottom]
```

---

## Figma MCP Workflow

### Step 1 — Get Template Node IDs
```typescript
// Via Figma MCP tool: get_metadata
// Find the template frame and all named layers
const template = await figmaMCP.getMetadata({ fileKey: FIGMA_FILE_KEY });
const nodes = extractNamedNodes(template);
```

### Step 2 — Update Text Layers
```typescript
// Via Figma MCP: update text content on named layers
await figmaMCP.updateText({
  fileKey: FIGMA_FILE_KEY,
  nodeId: nodes["headline-text"].id,
  text: thumbnailData.textOverlay  // from research.thumbnailConcept.textOverlay
});

await figmaMCP.updateText({
  fileKey: FIGMA_FILE_KEY,
  nodeId: nodes["sub-text"].id,
  text: thumbnailData.subText
});
```

### Step 3 — Update Background Colour
```typescript
// Change background to match video tone
await figmaMCP.updateFill({
  fileKey: FIGMA_FILE_KEY,
  nodeId: nodes["bg-layer"].id,
  fills: [{ type: "SOLID", color: thumbnailData.backgroundColor }]
});
```

### Step 4 — Set Main Image
```typescript
// Upload background image from Unsplash (free)
const imageUrl = await fetchUnsplashImage(thumbnailData.visualIdea);
const imageHash = await figmaMCP.uploadImage({
  fileKey: FIGMA_FILE_KEY,
  imageUrl
});

await figmaMCP.updateFill({
  fileKey: FIGMA_FILE_KEY,
  nodeId: nodes["main-image"].id,
  fills: [{ type: "IMAGE", imageHash }]
});
```

### Step 5 — Export PNG
```typescript
// Export the completed thumbnail frame as PNG
const exportResult = await figmaMCP.exportNode({
  fileKey: FIGMA_FILE_KEY,
  nodeId: TEMPLATE_FRAME_ID,
  format: "PNG",
  scale: 1  // 1280×720 is already full size
});

// Upload to S3
await uploadToS3(exportResult.imageData, `${jobId}/final/thumbnail.png`);
```

---

## Thumbnail Generation Input

This skill receives the `thumbnailConcept` from the research JSON:

```json
{
  "emotion": "shocked/surprised",
  "textOverlay": "Nobody Tells You This",
  "visualIdea": "person looking at laptop screen with wide eyes, dark room",
  "colorScheme": "dark background with orange accent text"
}
```

And the `finalTitle` from the SEO skill.

---

## A/B Thumbnail Strategy

Generate 2 thumbnail variants per video. Both are uploaded to S3 at production time.
Theo receives both variants via the PRODUCTION_COMPLETE message and initiates the
A/B test in YouTube Studio. Theo reads the result at 48 hours and reports to
The Line. The thumbnail skill does not manage the A/B lifecycle — that is Theo's job.

Variant A: Face/emotion focused
Variant B: Text/graphic focused (no face)

This covers both viewer psychology profiles: people who click on faces and people who click on information.

## Optimizar Team Avatar Portraits (About Page Only)

When generating team member portraits for the About page — this is separate
from video thumbnails — use this consistent prompt template:

```
Base prompt (all portraits):
"Professional editorial portrait photograph, subject looking slightly
off-camera with confident relaxed expression, soft directional lighting
from upper left, shallow depth of field, 35mm lens, natural skin tones,
upper body framing, no props.

Office background (ALL portraits — same space):
Sleek modern dark creative studio office, multiple ultrawide monitors
displaying data dashboards and video timelines in background, soft amber
and purple ambient lighting from behind, bokeh blur on background,
cinematic atmosphere, premium agency aesthetic."

Apply individual descriptor per team member (see frontend-design-spec/SKILL.md
for the full list of individual descriptors per person).

Style consistency rule: Every portrait must feel like it was shot in the
same studio on the same day. Same background. Same lighting direction.
Same framing. Different faces and personalities.
```

---

## Output Contract

```json
{
  "youtube": {
    "thumbnailUrl": "string — S3 URL to 1280x720 PNG",
    "variantBUrl": "string — S3 URL to A/B variant",
    "figmaFileUrl": "string — link to editable Figma file",
    "textOverlay": "string — text used",
    "colorScheme": "string",
    "estimatedCTR": "low | medium | high"
  },
  "instagram": {
    "coverUrl": "string — S3 URL to 1080x1920 PNG",
    "figmaFileUrl": "string"
  },
  "designNotes": "string — explanation of design choices"
}
```

---

## Fallback: No Figma Connected

If the user hasn't connected Figma MCP, generate a thumbnail using:

1. **Unsplash API** — fetch background image
2. **Sharp (Node.js image lib)** — composite text overlay on Lambda
3. Export as PNG to S3

This produces a simpler thumbnail but requires no Figma setup. Recommend connecting Figma for better visual quality.

---

## Quality Standards

A thumbnail is ready when:
- Text is readable at 120×68px (test by shrinking in Figma)
- There is clear visual hierarchy: one dominant element, one supporting element
- The colour scheme has at least 4:1 contrast ratio between text and background
- The emotional tone matches the video's hook

---

## References
- See `references/thumbnail-ctr-data.md` for historical CTR data by thumbnail style
- See `references/figma-mcp-setup.md` for step-by-step Figma template creation guide
