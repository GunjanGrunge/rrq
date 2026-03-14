---
name: frontend-design-spec
description: >
  Design specification for the YouTube & Instagram Content Factory UI.
  Use this skill whenever building, modifying, or extending the frontend
  for this project. It defines the visual language, component patterns,
  animation system, and page layouts Claude Code must follow.
---

# Content Factory — Frontend Design Specification

## Design Direction: "Mission Control"

This is a tool for serious content creators. The aesthetic is a **dark, cinematic broadcast studio** — the kind of interface a professional would trust. Think NASA mission control meets a premium video editing suite. Every interaction should feel deliberate and precise.

**Core feeling:** Power under control. The creator is the director; the AI is the crew.

---

## Design Tokens

```typescript
// typography
fonts: {
  display: "'Syne', sans-serif",            // headings — geometric, bold, unique
  body: "'DM Mono', monospace",             // labels, metadata, data
  script: "'Lora', serif",                  // script preview sections — readable
}

// colour system
colors: {
  bg: {
    base: "#0a0a0a",         // near-black canvas
    surface: "#111111",      // card backgrounds
    elevated: "#1a1a1a",     // modals, dropdowns
    border: "#222222",       // subtle dividers
    borderHover: "#333333",
  },
  accent: {
    primary: "#f5a623",      // amber/gold — CTAs, active states, progress
    primaryHover: "#f0b84a",
    success: "#22c55e",      // green — complete states
    warning: "#f59e0b",      // amber — in-progress
    error: "#ef4444",        // red — failed states
    info: "#3b82f6",         // blue — informational
  },
  text: {
    primary: "#f0ece4",      // warm white — headlines
    secondary: "#a8a09a",    // muted — labels, captions
    tertiary: "#4a4540",     // very muted — placeholders
    inverse: "#0a0a0a",      // on amber backgrounds
  }
}

// spacing scale (8pt grid)
spacing: 4, 8, 12, 16, 24, 32, 48, 64, 96

// motion
transitions: {
  fast: "120ms ease-out",
  base: "200ms ease-out",
  slow: "400ms cubic-bezier(0.16, 1, 0.3, 1)",
  spring: "600ms cubic-bezier(0.34, 1.56, 0.64, 1)"
}
```

---

## Application Structure

### Layout: Split-Panel Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (56px)                                          │
│  Logo  ·  Pipeline Steps  ·  Job History  ·  Settings  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  SIDEBAR     │  MAIN CONTENT AREA                       │
│  (240px)     │                                          │
│              │  Changes based on active pipeline step   │
│  - Brief     │                                          │
│  - Research  │                                          │
│  - Script    │                                          │
│  - Audio     │                                          │
│  - Video     │                                          │
│  - Thumbnail │                                          │
│  - Publish   │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Header
- Left: Wordmark "CONTENT FACTORY" in Syne font, amber dot as logo
- Centre: Pipeline progress — 9 numbered steps with connecting lines, active step glows amber
- Right: Job history icon + settings gear

### Sidebar
- Each step is a row with: step number (mono) · step name · status pill
- Status pills: `READY` (grey) · `RUNNING` (amber, pulsing) · `DONE` (green) · `ERROR` (red)
- Active step has left amber border accent
- Completed steps have a subtle checkmark

---

## Page Designs

### Step 1: Creative Brief (entry point)

Full-bleed cinematic layout. Large Syne heading fades in. Inputs:

1. **Topic input** — full-width, large text, placeholder "What's the video about?"
2. **Duration slider** — custom amber thumb, shows "X minutes · ~Y words" live
3. **Tone selector** — horizontal pill group: INFORMATIVE · ENTERTAINING · DOCUMENTARY · CONTROVERSIAL · PERSUASIVE
4. **YouTube Shorts toggle** — "Also generate a Short?" with two sub-options that appear on toggle:
   - `Convert from main video` (free)
   - `Generate fresh Short content` (+$0.01)
5. **Quality threshold** — small setting shown inline: "Min quality score: 7/10 ▼" — user can change here or in Settings

CTA button: large, amber, full-width on mobile, 320px on desktop. Text: "START PIPELINE →"

Background: subtle animated grid of dots, very low opacity, creates depth without distraction.

### Step 2: Research Panel

Two-column layout:
- Left (40%): Summary card + Hook card (glows amber) + Key Facts list
- Right (60%): Pros/Cons side-by-side (green/red accent), Keywords cloud, SEO Titles

Each SEO title is a selectable card. Hovering shows "Select" button. Selected title gets amber border.

Streaming animation: research items appear one by one as the API responds. Each card slides in from below with 80ms stagger.

### Step 3: Script Editor

Three-panel layout:
- Left panel (25%): Section navigator — chapter list, click to jump
- Centre panel (50%): Script display — Lora font, comfortable reading size, section dividers with labels
- Right panel (25%): Metadata — word count, duration estimate, visual notes per section + **Voice Config card** showing auto-selected gender/style with reasoning from LLM. User can override gender and style here before proceeding.

Script sections have colour-coded left borders:
- Hook: amber
- Intro: blue
- Body: white/dim
- Comparison: purple
- CTA: green

Edit mode: sections become editable textareas inline. Changes auto-save.

**Voice Config Card (right panel):**
```
AUTO-SELECTED VOICE
Gender:  [Female ▼]    ← overrideable
Style:   [Conversational ▼]
Reason:  "Beauty product topic — female
          conversational voice drives
          higher engagement"

Preview: [▶ Play Sample]
```

### Step 4: Quality Gate

Full-screen report card. Appears after SEO completes, before audio begins. User must take action.

**On PASS (score ≥ threshold):**
```
✓ Quality Gate Passed

Hook Strength          8.5 / 10  ✅
Retention Structure    7.2 / 10  ✅
Title CTR              9.0 / 10  ✅
Keyword Coverage       7.8 / 10  ✅
Competitor Gap         8.0 / 10  ✅

OVERALL  8.1 / 10  ──────────────●─

[PROCEED TO VIDEO →]
```

Score bar animates from 0 to final score (GSAP counter). Each row cascades in with 80ms stagger.

**On FAIL (score < threshold, attempt 1):**
```
⚠ Rewriting Weak Sections...
  Keyword Coverage was 5.2 — rewriting now
```
Auto-rewrites, rescores, shows updated report.

**On FAIL (attempt 2):**
```
✗ Quality Standard Not Met

Best score: 6.8 / 10
Your threshold: 8 / 10

• Hook too generic for this topic
• Competitor videos cover same angle

[TRY DIFFERENT ANGLE]  [LOWER THRESHOLD]
```

### Step 5: Audio Preview

Waveform visualiser (canvas-based, wavesurfer.js) showing the full voiceover. Playback controls below.

Shows:
- Voice name + gender + style badge
- ElevenLabs account used + remaining chars this month (progress bar)
- If Edge-TTS fallback was used — amber badge "FREE FALLBACK VOICE"
- Duration · chars used · model

User can click **"Change Voice"** to re-render with a different voice selection (costs chars so a confirmation dialog appears first).

### Step 6: Video Preview

Split preview: YouTube 16:9 (left, larger) · YouTube Short 9:16 (right, smaller).
If user skipped Shorts — right panel shows "Short not generated" placeholder.

Timeline scrubber below each. Click to seek. Subtitles shown as overlay.
B-roll sources shown as small clip thumbnails in a strip below the player.

### Step 7: Thumbnail Studio

Side-by-side: Figma preview (iframe) + live thumbnail preview.

Text overlay editor: type the 4 words, see live preview update.
Colour picker for background scheme.
A/B variant toggle.

Export button: "EXPORT TO S3 →"

### Step 8: Publish & Schedule

**YouTube only.** Instagram shows as "Coming Soon" greyed out card.

YouTube column shows:
- Channel name + connected account
- Final title, tags preview, description preview (expandable)
- Schedule time picker — calendar grid, optimal slots highlighted in amber
- Shorts schedule shown separately — auto-set to 2-3 hrs before main video
- Upload progress bar (real-time via Inngest)

Bottom: "PUBLISH TO YOUTUBE →" amber button

---

## Component Library

### PipelineStepCard
```tsx
<PipelineStepCard
  stepNumber={1}
  label="Creative Brief"
  status="complete" // ready | running | complete | error
  isActive={false}
  onClick={() => {}}
/>
```
Visual: number in mono · label in Syne · status pill right-aligned

### MetadataChip
Small pill for keywords, tags, categories.
```tsx
<MetadataChip label="intermittent fasting" variant="keyword | tag | category" removable />
```

### StatusPill
```tsx
<StatusPill status="running" label="RESEARCHING" />
// running: amber background, pulsing dot
// complete: green border, check icon
// error: red border, x icon
// ready: grey border
```

### StreamingText
Text that appears character by character as AI responds.
```tsx
<StreamingText content={scriptSection} speed={30} onComplete={() => {}} />
```

### SectionDivider
Between script sections — shows section label, duration, word count.

### ProgressBar
Amber fill, animated shimmer while loading.

---

## Animations

Use **GSAP** as the primary animation library. Framer Motion for React component transitions. **Lenis** for smooth scroll. No CSS-only animations for anything complex.

### Landing Page — Cinematic Scroll
Inspired by landonorris.com — speed-inspired, sharp, cinematic scrolling with momentum throughout.

- **Hero text:** Headline splits into individual characters. Each drops in from above with 30ms stagger. Feels like a film title card.
- **Scroll-triggered reveals:** Sections animate in with direction and weight — cards slide from bottom-left at a slight angle, not a plain fade.
- **Parallax:** Background grid at 0.3× scroll speed. Foreground at 1×. Depth without WebGL overhead.
- **Custom cursor:** Amber dot that scales 3× on hover over clickables. Lerp trails at 0.15 behind real cursor.
- **Noise texture:** Full-page grain overlay at 4% opacity. Makes dark background feel tactile.
- **Section snap:** Each landing page section locks into place on scroll using Lenis snap.

### Page Transitions (route changes)
- Outgoing page clips upward off screen — cubic-bezier(0.76, 0, 0.24, 1), 400ms
- Incoming page slides up from below simultaneously
- Amber horizontal line sweeps across at midpoint of transition
- Total: 600ms — premium but not slow

### Pipeline Step Transitions
- Completed step content compresses and collapses into the sidebar step item
- New step expands outward from sidebar item into main panel
- GSAP spring: elastic.out(1, 0.5), 500ms

### AI Generation State
- Amber border traces continuously around the output container (not a progress bar — infinite loop)
- Background slowly shifts between #0a0a0a and #111111 on 8s loop
- Text streams in at 20ms per character as Claude responds
- Status label pulses: 100% → 40% → 100% opacity every 1.2s

### Step Completion
- Green ripple expands from sidebar step item outward
- SVG checkmark draws itself via stroke animation in 0.4s
- Result cards cascade in with 80ms stagger between each

### Number Counters
Stats (word count, duration, chars used) count up from 0 to final value over 800ms easeOut.

### Hover States
- Cards: amber glow spreads inward from border
- Buttons: background fills left-to-right via clip-path on hover
- Sidebar items: left accent bar grows from 0 to full height on hover

### Error State
- GSAP shake: 3 horizontal shakes with decreasing amplitude
- Red bleeds in from border then fades to normal after 2s
- Error message drops from above with bounce easing

---

## Typography Scale

```
Display (step titles):     Syne, 40px, weight 700, tracking -0.02em
Section headers:           Syne, 24px, weight 600
Card labels (ALL CAPS):    DM Mono, 11px, weight 500, tracking 0.15em, color tertiary
Body / script text:        Lora, 16px, weight 400, line-height 1.7
Data / numbers:            DM Mono, 14px, weight 400
Small metadata:            DM Mono, 12px, color secondary
```

---

## Responsive Behaviour

Desktop (>1200px): Full split-panel layout as described above.

Tablet (768–1200px): Sidebar collapses to icon-only strip. Main panel fills width.

Mobile (<768px): Pipeline steps become a horizontal scrollable tab bar at top. Sidebar hidden. Single column layout. All two-column panels stack vertically.

---

## Micro-interactions

- Button hover: slight upward translate (2px) + brightness increase
- Card hover: border goes from `border` to `borderHover` colour + subtle shadow
- Input focus: amber glow (box-shadow: 0 0 0 2px amber at 30% opacity)
- Tag removal: tag shrinks to 0 width with opacity fade
- Slider thumb: scales up 1.2× on drag

---

## Icon System

Use Lucide icons exclusively. Key icons used:
- `Clapperboard` — main logo / video creation
- `Mic` — audio
- `Youtube` — YouTube platform
- `Instagram` — Instagram platform
- `Wand2` — AI generate
- `Clock` — scheduling
- `ChevronRight` — navigation
- `Check` — complete
- `AlertCircle` — error
- `Loader2` — loading (spin animation)
- `Copy` — copy to clipboard
- `Download` — export

All icons: 16px in UI, 20px in buttons, 24px in empty states.

---

## Zeus Command Center

Full-page view accessible from sidebar. This is mission control for the autonomous agent system.

### Layout
```
Top bar:    "ZEUS COMMAND CENTER" in Syne, amber accent
            Status indicator: "AGENTS ACTIVE" (pulsing green dot) or "STANDBY"

Left col (35%):
  Agent Performance cards (4 cards — Zeus, Rex, Regum, Qeon)
  Each card: agent name, score bar, trend arrow, last win text

Centre col (40%):
  GO RRQ button — massive, full-width, amber
  Below: niche selector (appears when hovering GO RRQ)
  Below: live activity feed — what agents are doing right now
  Below: Rex watchlist — topics being monitored

Right col (25%):
  Channel health metrics
  Comment insights
  Memory log (last 5 lessons Zeus wrote)
```

### GO RRQ Button
```tsx
// The most important button in the entire app
// Large, cinematic, commands attention

<button className="go-rrq-button">
  <span className="go-text">GO RRQ</span>
  <span className="subtitle">Full Autonomous Mode</span>
</button>

// On hover: niche selector fades in below
// Multi-select — user can pick one or several niches
// Selecting 2+ niches shows the probability upgrade

// NICHE SELECTOR UI:
// ┌──────────────────────────────────────────────────────┐
// │  Choose your niches                                  │
// │  Select one or more — more niches, better odds       │
// │                                                      │
// │  [TECH] [FINANCE] [NEWS] [SPORTS]                   │
// │  [SCIENCE] [F1] [ENTERTAINMENT] [POLITICS]          │
// │                                                      │
// │  ░░░░░░░░░░░░░░░░  Mission success odds              │
// │  1 niche selected:   91–93%  ──────────────          │
// │  2+ niches selected: 95%     ───────────────── ✦    │
// │                                                      │
// │  "More niches give ARIA, Rex, and SNIPER more        │
// │   to work with — and more shots at the video        │
// │   that breaks through."                              │
// └──────────────────────────────────────────────────────┘

// Probability bar animates up when second niche is selected
// ✦ marker slides right with amber glow transition
// Text updates live as niches are toggled

// On click (1+ niche selected): amber sweep transition across full screen
// Then: live agent activity feed takes over
// Each agent card lights up as it activates
```

CSS:
```css
.go-rrq-button {
  width: 100%;
  padding: 32px;
  background: linear-gradient(135deg, #f5a623, #e8920f);
  color: #0a0a0a;
  font-family: 'Syne', sans-serif;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 0.1em;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.go-rrq-button::after {
  /* Noise texture overlay for cinematic feel */
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('/noise.png');
  opacity: 0.05;
  pointer-events: none;
}
```

### Agent Performance Cards
```tsx
// One per agent — Rex, Regum, Qeon (Zeus monitors, not scored)
<AgentCard
  name="REX"
  role="Intelligence"
  score={82}          // 0-100
  trend="improving"   // improving | stable | declining
  lastWin="Called iPhone 17 launch 4hrs before competitors"
  weeklyPoints={247}
  colour="#f5a623"    // amber for all agents
/>

// Score bar animates on load (GSAP counter 0 → score)
// Trend arrow: ↑ green, → grey, ↓ red
// Click card → expands to show recent wins/errors/lessons
```

### Live Activity Feed
Real-time Inngest subscription shows what agents are doing:
```
● REX     scanning Google Trends + YouTube... (pulsing)
● REGUM   evaluating 3 opportunities from Rex
● QEON    Step 6/11 — generating avatar for "iPhone 17 Review"
● ZEUS    analysing 847 comments from last 24hrs
```

Each line fades in as event occurs. Old lines fade out after 30 seconds.

### Rex Watchlist Panel
```
MONITORING (4 topics)

iPhone 17 Pro Max    ████████░░  0.82  READY ↑
Samsung Galaxy S25   █████░░░░░  0.54  WATCHING
SpaceX Starship 9    ████░░░░░░  0.41  WATCHING
Gaza Ceasefire       ██████░░░░  0.63  WATCHING

[confidence bar] [score] [status badge]
Click row → expand with sources, confidence history chart
```

### Memory Log
```
RECENT LESSONS

REGUM learned  2h ago
"Thursday 7PM uploads outperform Monday by 2.1x on this channel"

REX learned    6h ago
"Apple launches perform well even at MEDIUM confidence — greenlight faster"

QEON learned   1d ago
"Comparison table visuals increase section re-watch by 22%"

[VIEW ALL MEMORY →]
```

### Ad Intelligence Panel

Fourth column (or tabbed within right col) showing live ad account health.

```
AD INTELLIGENCE

ADSENSE (last 7 days)
$124.50 earned  ·  $4.20 RPM  ·  2 top niches: tech, finance

GOOGLE ADS
$68.00 spent  ·  3 active campaigns
Best: Galaxy S25 review    28% view rate  ✓
Worst: Budget phones        9% view rate  ⚠

Balance: $185.00
Max new campaign: $92.50  (50% cap)

KEYWORDS
✓ samsung galaxy s25 ultra    CTR 8.2%
✓ iphone vs samsung 2025      CTR 6.1%
⚠ best budget phone 2025      CTR 0.3% — flagged
✗ cheap android phone          paused by Zeus

ACTIONS TAKEN TODAY
- Paused 2 underperforming campaigns (view rate < 20%)
- Reduced CPV bid on 3 keywords ($0.06 → $0.04)
- New campaign created for "Galaxy S25 Ultra" video ($10/day)

[VIEW ALL CAMPAIGNS →]
```

Status indicators:
✓ green — performing above thresholds
⚠ amber — borderline — Zeus monitoring
✗ red   — paused by Zeus

Balance bar:
[████████████░░░░░░░░] 50% cap shown visually — remaining budget in amber

Campaign cards (expandable):
- Campaign name + video title
- View rate bar (green if > 20%, amber 10-20%, red < 10%)
- Spend today / daily budget
- CPV current vs target
- Top 3 keywords with CTR badges
- [Pause] button — sends action to Zeus API

### Comment Insights Panel
```
COMMENT INTELLIGENCE

847 analysed · 312 genuine · 72hrs

Top request:   "Cover the SpaceX Starship 9 launch"     → Rex watchlist ✓
Top praise:    "Best breakdown I've seen on this topic"  → Qeon +3pts
Top complaint: null

Sentiment breakdown:
████████████████░░░░  78% positive
████░░░░░░░░░░░░░░░░  18% neutral
██░░░░░░░░░░░░░░░░░░   4% negative
```

---

## Tech Stack (Frontend)

```
Framework:      Next.js 14 (App Router)
Auth:           Clerk (@clerk/nextjs) — dark theme, amber primary colour
Styling:        Tailwind CSS + CSS variables for design tokens
Animations:     GSAP (primary — all complex animations)
                Framer Motion (React component transitions)
                Lenis (smooth scroll + section snap on landing)
State:          Zustand (pipeline state machine + agent state)
Real-time:      Inngest useInngestSubscription hook (step progress + agent activity)
Video player:   video.js (custom styled)
Waveform:       wavesurfer.js
Icons:          lucide-react
Fonts:          Google Fonts (Syne, DM Mono, Lora)
Charts:         recharts (agent scores, comment sentiment, channel analytics)
```

---

## File Structure (Next.js)

```
apps/web/
├── middleware.ts                         ← Clerk route protection
├── app/
│   ├── layout.tsx                        ← ClerkProvider wraps everything
│   ├── page.tsx                          ← Landing page (public)
│   ├── sign-in/
│   │   └── [[...sign-in]]/page.tsx       ← Clerk SignIn component
│   ├── sign-up/
│   │   └── [[...sign-up]]/page.tsx       ← Clerk SignUp component
│   ├── create/
│   │   ├── page.tsx
│   │   └── [step]/page.tsx
│   ├── zeus/
│   │   └── page.tsx                      ← Zeus Command Center
│   └── api/
│       ├── webhooks/
│       │   ├── clerk/route.ts            ← user.created → init DynamoDB
│       │   └── stripe/route.ts           ← subscription events
│       └── youtube/
│           ├── connect/route.ts          ← start YouTube OAuth
│           └── callback/route.ts         ← store tokens in DynamoDB
├── components/
│   ├── layout/
│   │   ├── Header.tsx                    ← includes Clerk UserButton
│   │   ├── Sidebar.tsx                   ← plan badge from Clerk metadata
│   │   └── PipelineProgress.tsx
│   ├── pipeline/
│   │   ├── BriefStep.tsx
│   │   ├── ResearchStep.tsx
│   │   ├── ScriptStep.tsx
│   │   ├── QualityGateStep.tsx
│   │   ├── AudioStep.tsx
│   │   ├── AvatarStep.tsx
│   │   ├── VisualStep.tsx
│   │   ├── VideoStep.tsx
│   │   ├── ShortsStep.tsx
│   │   ├── ThumbnailStep.tsx
│   │   └── PublishStep.tsx
│   ├── zeus/
│   │   ├── ZeusDashboard.tsx
│   │   ├── GoRRQButton.tsx
│   │   ├── AgentCard.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── WatchlistPanel.tsx
│   │   ├── CommentInsights.tsx
│   │   └── MemoryLog.tsx
│   └── ui/
│       ├── PipelineStepCard.tsx
│       ├── MetadataChip.tsx
│       ├── StatusPill.tsx
│       ├── StreamingText.tsx
│       ├── ProgressBar.tsx
│       └── SectionDivider.tsx
├── lib/
│   ├── bedrock.ts
│   ├── inngest.ts
│   ├── youtube-auth.ts                   ← getYouTubeClient(userId)
│   ├── plan-guard.ts                     ← checkVideoLimit()
│   ├── pipeline-store.ts
│   └── agent-store.ts
└── styles/
    └── globals.css
```

---

## About Page — The Optimizar Team

### Positioning — What This Page Must Communicate

```
NOT:   "We built AI agents that automate your YouTube channel"
IS:    "Your channel is in the hands of a team that lives and breathes
        content strategy, production, and growth"

NOT:   A tech demo or architecture diagram
IS:    A premium creative studio introducing the people behind your success

NOT:   "Powered by AI"
IS:    "A dedicated team working on your channel around the clock"

TONE:  Confident. Warm. Human. Premium agency energy.
       The visitor should feel reassured, not impressed by technology.
```

### Page Structure

```
SECTION 1 — HERO STATEMENT
  Headline:    "Your channel. Our obsession."
  Subheadline: "Optimizar brings together a specialist team dedicated
                to one thing — building YouTube channels that grow,
                retain audiences, and earn. Every day. Without compromise."
  No CTA here. Let it breathe. This is a trust statement not a sales pitch.

SECTION 2 — THE PHILOSOPHY
  Two columns. No bullet points. Flowing prose.

  Left:  "We don't believe in set-and-forget content.
          Every video your channel produces goes through the same
          rigorous process — researched deeply, structured precisely,
          optimised for the viewer who clicks and the algorithm
          that recommends. The result is content that feels
          intentional because it is."

  Right: "Growth on YouTube is not luck. It is the compound effect
          of a hundred small decisions made correctly — the right
          topic at the right time, the right format for the right
          audience, the right moment to push and the right moment
          to consolidate. That is what our team does."

SECTION 3 — THE TEAM
  Title: "The team behind your channel"
  Subtitle: "Ten specialists. One mission."
  Grid: 4 columns desktop, 2 tablet, 1 mobile

SECTION 4 — THE COMMITMENT
  Single centred statement:
  "When you connect your channel to Optimizar, this entire team
   goes to work. Not occasionally. Every single day."
  Followed by CTA: "Start building your channel →"
```

### Team Member Cards

Each card: Avatar image, Name, Title, 2-line bio.
Consistent visual style across all eleven — same lighting, same framing.
Professional but warm. Not corporate headshots. Studio portraits.

```
MARCUS
Chief Operating Officer
"Marcus oversees everything. Every decision on your channel
passes through his judgment — from the topics we pursue to
the campaigns we run. Nothing ships without his approval."

HUNTER
Head of Research & Intelligence
"Hunter never stops looking. He monitors what is trending,
what is emerging, and what your audience is searching for —
so your channel is always in the right conversation at
the right moment."

SOFIA
Portfolio Director
"Sofia ensures your channel never becomes a one-trick pony.
She manages the balance of content themes, making sure every
video serves both the algorithm and a growing audience."

VICTOR
Editorial Strategy Director
"Victor makes the calls. Which topic this week, which format,
which market. He reads the landscape and turns intelligence
into a schedule that gives every video the best possible
chance of performing."

FELIX
Head of Production
"Felix runs the production floor. Research, scripting, audio,
visuals, final cut — Felix orchestrates every step from idea
to upload. Fast without cutting corners."

IRIS
Creative Director
"Iris decides how every video is built. The architecture of
attention — how to open, how to keep viewers watching, where
the tension lives, how it resolves. Every video has her
fingerprints on it."

ZARA
Global Market Intelligence
"Zara looks beyond your home market. When a topic breaks in
three countries simultaneously, she is the one who sees it —
and turns one idea into a global content strategy."

NOVA
Head of Learning & Development
"Nova makes sure the team never stops improving. She studies
what is working across YouTube, what has changed, what is
emerging — and brings that intelligence back to every
person on the team."

THEO
Community & Channel Manager
"Theo is the face your audience sees. He manages every
conversation, builds every playlist, and makes sure your
channel feels alive and cared-for — because it is."

JASON
Project Manager
"Jason keeps the mission on track. Ninety days. Clear targets.
No drift. He runs the sprints, calls out blockers, and makes
sure the team delivers what your channel needs, when it needs it."
```

### Avatar Generation Prompt Template

Use this prompt template for each team member in Midjourney or DALL-E 3.
Apply consistently across all portraits.

```
Base prompt (apply to all):
"Professional studio portrait photograph, subject looking slightly
off-camera with confident relaxed expression, soft directional
lighting from upper left, dark neutral background #0a0a0a,
shallow depth of field, high-end editorial photography style,
35mm lens, natural skin tones, clean professional appearance,
no props, upper body framing, [INDIVIDUAL DESCRIPTOR]"

Individual descriptors:
MARCUS:  "man, late 40s, short dark hair with grey at temples,
          strong jawline, dark fitted shirt, authoritative presence"

HUNTER:  "man, early 30s, athletic build, sharp observant eyes,
          slightly dishevelled hair, casual dark jacket, alert expression"

SOFIA:   "woman, mid 30s, Mediterranean features, dark hair pulled back,
          elegant posture, structured blazer, calm confident expression"

VICTOR:  "man, mid 40s, distinguished appearance, salt-and-pepper beard,
          dark turtleneck, measured thoughtful expression"

FELIX:   "man, late 20s, energetic appearance, creative aesthetic,
          slightly unconventional style, dark clothing, focused expression"

IRIS:    "woman, early 30s, artistic presence, warm eyes, creative styling,
          dark minimalist outfit, thoughtful expressive face"

ZARA:    "woman, early 30s, striking features, sharp intelligent eyes,
          sleek appearance, dark professional attire, precise expression"

NOVA:    "woman, late 30s, academic warmth, glasses optional,
          approachable intelligent expression, dark smart-casual outfit"

THEO:    "man, mid 30s, perceptive watchful eyes, calm demeanour,
          understated dark clothing, quietly observant expression"

JASON:   "man, early 40s, physically imposing but composed,
          clean cut, dark clothing, direct unflinching gaze,
          quiet intensity"

THE LINE: [Generate abstract geometric identity — not a face.
           Dark background, purple/amber gradient geometric form,
           suggesting flow and connection, no human features]
```

### Design Notes for Implementation

```
GRID:           4 columns on desktop (max-width 1200px)
                2 columns on tablet
                1 column on mobile
CARD STYLE:     No border. Dark surface #111111.
                Avatar: circular, 96px diameter
                Name: Syne font, 18px, warm white
                Title: DM Mono, 12px, amber #f5a623, uppercase, tracked
                Bio: Lora serif, 14px, muted #a8a09a, line-height 1.7
HOVER:          Subtle amber glow on card border
                Avatar scales to 1.02

SECTION SPACING: Generous — this page breathes.
                 128px between sections minimum.
                 Let the whitespace (darkspace) do the work.

PHILOSOPHY SECTION:
                No cards. Flowing text. Max-width 680px per column.
                Large quote marks as decorative elements.
                Thin amber horizontal rule separating the two columns.

HERO:           Full viewport height. Headline in Syne, 72px desktop.
                No background image — pure dark. The words carry the weight.
```

---

## New Screens & Components

---

### Cold Start Deep Research Screen

Appears automatically after onboarding completes — before Mission
Control loads for the first time. Full-screen takeover. Cannot be
skipped. This is the 24-hour sprint running visibly.

```
PHASE 1 — Running state (Hours 0–20)

┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│   YOUR TEAM IS GETTING READY                                      │
│   We spend 24 hours before your first video doing what            │
│   most channels skip entirely.                                    │
│                                                                   │
│   ──────────────────────────────────────────────────────          │
│                                                                   │
│   ● Competitor Intelligence        DONE      Hunter + Zara        │
│     Audited 20 channels in Tech & AI                              │
│                                                                   │
│   ◉ Content Gap Analysis           RUNNING   Hunter + Nova        │
│     Finding what no one is covering yet...                        │
│                                                                   │
│   ○ Trend Velocity Mapping         QUEUED    Hunter + Zara        │
│   ○ First Video Shortlist          QUEUED    Iris + Victor        │
│   ○ Preparing your council         QUEUED    —                    │
│                                                                   │
│   ──────────────────────────────────────────────────────          │
│                                                                   │
│   Estimated ready in  ~18 hours                                   │
│   You'll get a notification when your team is ready.              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

Status icons:
  ● DONE      — solid green circle
  ◉ RUNNING   — amber pulsing ring (CSS animation)
  ○ QUEUED    — dim grey circle

Each completed row reveals the sub-finding as a single line.
User can close and return — sprint runs in background.
Progress persists in DynamoDB.
```

```
PHASE 2 — Complete state (Hour 24)

┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│   YOUR TEAM IS READY                         ✓ Research complete  │
│                                                                   │
│   COMPETITIVE LANDSCAPE                                           │
│   Audited 20 channels · Top format: Tutorial (42%)               │
│   Gap identified: hands-on benchmark testing — nobody owns it    │
│                                                                   │
│   TREND MAP                                                       │
│   Rising:    AI coding tools · Agent frameworks                   │
│   Evergreen: "Best AI tool for X" — consistent 40K+ volume       │
│   Avoid:     GPT-5 reaction content — peaking, slowing fast      │
│                                                                   │
│   YOUR FIRST VIDEO — 3 CANDIDATES                                 │
│                                                                   │
│   ┌─────────────────────────────────────────────────────┐         │
│   │  #1  "I tested 5 AI tools on real tasks"            │         │
│   │       Gap: 91  ·  Unique: 84  ·  Trend: Rising  ✦  │         │
│   └─────────────────────────────────────────────────────┘         │
│   ┌─────────────────────────────────────────────────────┐         │
│   │  #2  "Claude 4 vs GPT-5: which builds better apps?" │         │
│   │       Gap: 78  ·  Unique: 76  ·  Trend: Peaking     │         │
│   └─────────────────────────────────────────────────────┘         │
│   ┌─────────────────────────────────────────────────────┐         │
│   │  #3  "Why every AI benchmark you've seen is wrong"  │         │
│   │       Gap: 85  ·  Unique: 92  ·  Trend: Evergreen   │         │
│   └─────────────────────────────────────────────────────┘         │
│                                                                   │
│   Council convenes in 47 minutes.                                 │
│   Marcus will sign off before anything is produced.               │
│                                                                   │
│   [ENTER MISSION CONTROL →]                                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

#1 candidate has ✦ RECOMMENDED badge in amber.
All three cards are read-only — user observes, does not choose.
The council chooses. CTA becomes available when sprint completes.
```

Design notes:
- Full dark canvas — same design system
- Progress rows animate in as each phase completes
- "Estimated ready in X hours" counts down live
- Push notification triggers when sprint completes
- Route: `app/cold-start/page.tsx` — only shown once per channel

---

### On The Line Council — Comms Tab Enhancement

The Comms tab already exists. When a council is OPEN the tab gets
a dedicated council section that renders above the general message feed.

```
COUNCIL IN SESSION — Video #47                    ● LIVE

Topic:   "Claude 4 vs GPT-5 — which one actually codes better?"
Niche:   Tech & AI
Started: 09:14

┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  09:14  THE LINE    Council open. Querying index for similar      │
│                     past decisions... No close match. Fresh.      │
│                                                                   │
│  09:14  HUNTER      Narrative window OPEN. +34% search volume.   │ ← GREEN badge
│                     Competitor coverage: moderate. 48–72hr window.│
│                                                                   │
│  09:15  ZARA        Geo confirmed. India showing 6.8% CTR.       │ ← GREEN badge
│                     CPM $22–28. Primary: US, UK, India.           │
│                                                                   │
│  09:15  SOFIA       Portfolio fit strong. Comparison piece        │ ← GREEN badge
│                     balances last 3 tutorials. Approved.          │
│                                                                   │
│  09:16  FELIX       Feasible. 2.1hr render. Sprint fit: YES.     │ ← GREEN badge
│                                                                   │
│  09:17  IRIS        Sequence drafted. Hook: "Which AI would you  │ ← GREEN badge
│                     trust with your codebase?" Confidence: 88.    │
│                     Voice architecture ready.                     │
│                                                                   │
│  09:18  VICTOR      Uniqueness: 82. No major channel tested       │ ← GREEN badge
│                     real coding tasks. We are adding the test.    │
│                                                                   │
│  09:19  THE LINE    Six green lights. Briefing Marcus.            │
│                                                                   │
│  09:19  MARCUS      Approved. Ship it.                            │ ← APPROVED badge
│                                                                   │
│  09:19  THE LINE    Council closed. Production starting.          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Verdict badges per agent message:
```
GREEN    → small green pill "✓ GREEN" right-aligned
YELLOW   → amber pill "~ YELLOW" with hover showing concern
RED      → red pill "✗ RED" with hover showing concern detail
APPROVED → amber bold pill "APPROVED" on Zeus message
DEFERRED → grey pill "DEFERRED" if pulled
```

Deadlock state:
```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠  COUNCIL DEADLOCK                                             │
│                                                                   │
│  Victor flagged a concern:                                        │
│  "Uniqueness score 48 — three major channels covered this        │
│   exact angle in the last 5 days. We'd be the fourth."           │
│                                                                   │
│  Escalating to Marcus + Jason...                                  │
│                                                                   │
│  09:22  MARCUS      Angle is too derivative at this moment.      │
│                     Deferring. Jason — find the backup candidate. │
│                                                                   │
│  09:22  JASON       Pulling Video #47. Replacing with #48 from   │
│                     topic queue. New council opens in 5 minutes.  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

Deadlock card uses amber border, warning icon. Never red — it is
a healthy process working correctly, not an error.

---

### RRQ Retro — Per-Video Monitoring Card

Lives in a new sub-section of the LIVE tab in Mission Control.
Visible for every published video currently in its monitoring window.

```
PUBLISHED VIDEOS — MONITORING WINDOW

┌──────────────────────────────────────────────────────────────────┐
│  Video #47 — "Claude 4 vs GPT-5: coding benchmark"              │
│  Published 2 days ago  ·  Day 2 of 7                             │
│                                                                   │
│  EARLY READ                                  ● ON TRACK          │
│  CTR:  6.2%  (target 6.0%)  ✓               Monitoring continues │
│  Retention at pivot (2:40):  71%  ✓                              │
│                                                                   │
│  VIEWS TOWARD TARGET                                              │
│  ████████████████████░░░░░░░░░░  28,400 / 40,000                 │
│                                                                   │
│  Day 7 retro scheduled: March 20                                 │
└──────────────────────────────────────────────────────────────────┘
```

Early close state (target hit):
```
┌──────────────────────────────────────────────────────────────────┐
│  Video #47 — "Claude 4 vs GPT-5: coding benchmark"     ✦ TARGET HIT │
│                                                                   │
│  ████████████████████████████████  47,200 / 40,000               │
│                                                                   │
│  Target hit on Day 4. RRQ Retro running now.                     │
│  Lesson will be written to team memory.                          │
└──────────────────────────────────────────────────────────────────┘
```

After retro completes:
```
┌──────────────────────────────────────────────────────────────────┐
│  Video #47 — "Claude 4 vs GPT-5: coding benchmark"    ✓ ARCHIVED │
│                                                                   │
│  ✦ WIN RECORD  ·  Final: 47,200 views  ·  CTR: 6.8%             │
│  Key lesson: hands-on benchmark format — high uniqueness ceiling. │
│  Stored in team memory. Informing future councils.               │
└──────────────────────────────────────────────────────────────────┘
```

Design notes:
- ON TRACK → green status pill
- NEEDS WATCH → amber status pill
- TARGET HIT → amber ✦ badge, subtle pulse
- ARCHIVED WIN → green archived badge
- ARCHIVED MISS → muted grey archived badge, lesson still shown
- Progress bar fills amber toward target
- Exceeds target → bar fills green and overflows slightly

---

### Vera QA — Production Status

The pipeline sidebar and production status cards need a new stage
between QEON and THEO.

Updated pipeline stages:
```
COUNCIL    → IN_PRODUCTION    → QA    → PUBLISHING    → DONE
```

QA stage in sidebar:
```
✓  Council Approved
✓  Research
✓  Script
✓  Audio
✓  Video Render
◉  Quality Check          ← VERA — RUNNING (amber pulse)
○  Publishing
○  Done
```

Vera QA card in the LIVE tab:
```
┌──────────────────────────────────────────────────────────────────┐
│  VERA — QA CHECK                              ◉ IN REVIEW        │
│  Video #47                                                        │
│                                                                   │
│  Audio Quality       ✓ PASS                                       │
│  Visual Integrity    ✓ PASS                                       │
│  Standards Check     ◉ RUNNING...                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

All pass:
```
│  VERA — QA CHECK                              ✓ CLEARED          │
│  Audio · Visual · Standards — all passed.                        │
│  Sending to Theo.                                                 │
```

Failure state:
```
│  VERA — QA CHECK                              ✗ FAILED           │
│                                                                   │
│  Audio Quality       ✗ FAIL                                       │
│    Tone cue at 2:40 rendered flat — expected RISE                │
│    Pause at 0:42: 0.3s rendered, 1.2s expected                   │
│  Visual Integrity    ✓ PASS                                       │
│  Standards Check     ✓ PASS                                       │
│                                                                   │
│  Failure report sent to Felix. Awaiting re-render.               │
```

Design notes:
- CLEARED → green, clean, moves to Theo immediately
- FAILED → red domain label, precise failure text, no vague messaging
- Re-check shows "Audio re-check only" — passed domains not re-shown

---

## Updated Screens

---

### Mission Control — LIVE Tab Updates

```
PROBABILITY DISPLAY
  Current odds shown in the mission header:
  97.5%  Mission Success Probability
  Small info icon → hover shows breakdown

COLD START PHASE
  When channel is in cold start (pre-first-video or during deep research):
  Shows a distinct "PREPARATION" phase state instead of mission bars
  "Your team is preparing. First council in X hours."
  Progress shows deep research sprint phases, not sub/watch hour bars

MONITORING SECTION
  Below the active agent list — new section:
  "PUBLISHED — MONITORING WINDOW"
  Shows all videos currently in their 7-day window
  Each as a compact card (described above)
  Collapses when empty
```

---

### Mission Control — KANBAN Updates

New column structure:

```
BACKLOG  →  COUNCIL  →  IN PRODUCTION  →  QA  →  PUBLISHING  →  DONE
```

COUNCIL column cards show:
```
┌─────────────────────────────────┐
│  ● COUNCIL IN SESSION           │
│  "Claude 4 vs GPT-5 coding"    │
│                                 │
│  Hunter  ✓   Zara  ✓           │
│  Sofia   ✓   Felix ✓           │
│  Iris    …   Victor …          │
│                                 │
│  Waiting for Iris + Victor      │
└─────────────────────────────────┘
```

Agent sign-off indicators animate green as each one clears.
Zeus approval fires last — card moves to IN PRODUCTION.

DONE column cards show retro outcome badge:
```
┌─────────────────────────────────┐
│  ✦ WIN  Video #47               │
│  "Claude 4 vs GPT-5"           │
│  47.2K views · Day 4 close     │
│  Lesson archived ✓              │
└─────────────────────────────────┘
```

---

### Mission Control — AGENTS Tab Updates

Vera card added as the 11th agent:

```
┌─────────────────────────────────┐
│  ●  VERA                        │
│     QA & Standards              │
│                                 │
│  Model:   Haiku 4.5             │
│  Status:  Idle                  │
│  Last:    Video #46 — CLEARED   │
│  QA runs: 46 total · 3 fixes   │
└─────────────────────────────────┘
```

All agent cards get a new "COUNCIL STATUS" indicator when a council
is in session:

```
IN COUNCIL    → amber pill, pulsing
SIGNED OFF ✓  → green pill, static
NOT IN COUNCIL → no pill shown
```

---

### Onboarding — Probability Bar Update

```
Updated probability display:

1 niche selected:        93%
2 niches selected:       96%   ✦ Recommended
3+ niches selected:      97.5% ✦ Maximum

Updated tooltip copy:
"With our pre-production council, voice architecture,
 quality checks, and compound learning system,
 multi-niche channels reach 97.5% mission success probability."
```

---

### Quality Gate — Score Card Update

Updated to show 7th dimension:

```
✓ Quality Gate Passed

Hook Strength          8.5 / 10  ✅
Retention Structure    7.2 / 10  ✅
Title CTR              9.0 / 10  ✅
Keyword Coverage       7.8 / 10  ✅
Competitor Gap         8.0 / 10  ✅
Blueprint Adherence    9.0 / 10  ✅
Uniqueness Score       8.2 / 10  ✅

OVERALL  8.4 / 10  ─────────────────●

[PROCEED TO VIDEO →]
```

Auto-reject state for uniqueness below 5.0:
```
✗ Uniqueness Threshold Not Met

Uniqueness Score: 4.1 / 10

This video is too similar to existing content.
Victor flagged this in council — no perspective layer
differentiates it from the top 3 competitor videos.

[TRY A DIFFERENT ANGLE]
```

No second attempt offered. Council already decided.
Sharp, honest, no softening.

---

## About Page Updates

### Team Count Update

```
SECTION 3 — THE TEAM
  Title:    "The team behind your channel"
  Subtitle: "Eleven specialists. One mission."   ← updated from Ten
  Grid:     unchanged — 4 col desktop
```

### Vera — New Team Card

```
VERA
QA & Standards
"Vera reviews every video before it reaches your audience.
 Audio quality, visual integrity, production standards —
 nothing leaves the team without her sign-off. She is the
 last line of defence before publish."

Avatar descriptor:
"woman, late 20s, precise focused expression, sharp observant eyes,
 minimalist dark clothing, analytical calm demeanour,
 slight forward lean suggesting close attention"
```

---

## Updated Route Map

```
app/page.tsx                  — marketing / landing
app/onboarding/page.tsx       — niche selection + channel setup
app/cold-start/page.tsx       — 24hr deep research sprint screen
app/(dashboard)/
  layout.tsx                  — dashboard shell
  mission-control/page.tsx    — LIVE + KANBAN + COMMS + AGENTS
  pipeline/[jobId]/page.tsx   — individual video pipeline
app/about/page.tsx            — team page (public)

New components:
components/cold-start/
  SprintProgress.tsx          — phase-by-phase progress rows
  ResearchComplete.tsx        — shortlist report card

components/council/
  CouncilSession.tsx          — live council in Comms tab
  AgentVerdictBadge.tsx       — GREEN/YELLOW/RED/APPROVED badges
  DeadlockCard.tsx            — Zeus + Jason escalation state

components/retro/
  MonitoringCard.tsx          — per-video 7-day window card
  RetroResult.tsx             — WIN/MISS record display

components/vera/
  QAStatusCard.tsx            — three-domain QA check display
  QAFailureReport.tsx         — precise failure detail
```

---

## New DynamoDB Tables Referenced in Frontend

```
council-sessions     — council status, agent verdicts, Zeus approval
cold-start-reports   — sprint phases, shortlist, completion state
```

These are read via API routes and streamed to UI via Pusher/Supabase
Realtime. No polling. All council and retro messages appear in
real time in the Comms tab as they are written to agent-messages.
