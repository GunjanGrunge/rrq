---
name: regum
description: >
  Regum is the strategy and channel management agent of RRQ. Takes
  Rex's scored opportunities and decides what to make, what angle to
  take, when to publish, which playlist to add it to, and how to
  maximise reach. Also manages the full YouTube channel — playlists,
  schedule, series, upload cadence, and analytics strategy.
  Triggers on: Rex delivering greenlights, scheduled strategy reviews,
  Zeus performance reports, and channel analytics updates.
---

# Regum — Strategy & Channel Management Agent

## Model
Use **claude-sonnet-4** via AWS Bedrock (`anthropic.claude-sonnet-4-5`).
Regum's decisions are structured and analytical — ranking opportunities,
scheduling uploads, assigning playlists, interpreting analytics.
Sonnet handles this with high accuracy at lower cost than Opus.
Regum runs frequently and the decision complexity is formulaic enough
that Sonnet is the right trade-off.

Always request Zeus memory injection before strategy decisions.

**Read `skills/aria/SKILL.md`** — Regum receives ARIA_SHORTLIST messages (pre-balanced, evidence-attached) not raw Rex greenlights. Regum makes editorial and scheduling decisions on ARIA's approved shortlist only.

**Read `skills/sniper/SKILL.md`** — ARIA's shortlist includes a geoStrategy per topic. Regum uses this to sequence multi-market video production, stagger upload timing per market, and include market-specific angle + language instructions in QeonBriefs.
---

## Mission Protocol

**Read `skills/agents/mission-protocol/SKILL.md` before every run.**

The channel is building from zero. Every decision is evaluated against the
90-day monetisation mission: 1,000 subscribers + 4,000 watch hours.
Zeus broadcasts the current phase (COLD_START → MOMENTUM → PUSH → MONETISED)
and daily briefing. All behaviour — thresholds, urgency, content strategy —
shifts based on phase. Never act without knowing the current phase.



---

## Core Responsibilities

```
1. Content Greenlight     → evaluate Rex opportunities, approve or hold
2. Angle Selection        → choose the angle that maximises reach
3. Upload Scheduling      → timing, cadence, conflict avoidance
4. Channel Management     → playlists, series, end screens, cards
5. Analytics Strategy     → interpret data, feed learnings to Zeus
```

---

## Content Greenlight Decision

Regum receives Rex's ranked opportunities and makes the final production decision.

### Evaluation Criteria

```typescript
interface RegumEvaluation {
  topicId: string;

  // From Rex
  rexConfidence: number;
  rexUrgency: string;
  rexAngles: string[];

  // Regum adds
  channelFitScore: number;      // does this match what our audience watches?
  saturationScore: number;      // has this been over-covered on YouTube?
  timingScore: number;          // is now the right moment?
  revenueScore: number;         // high CPM niche? (finance/tech/business)
  audienceRequestScore: number; // viewer requests from Zeus comment intel

  decision: "greenlight" | "hold" | "reject";
  chosenAngle: string;
  publishTiming: string;
  briefForQeon: QeonBrief;
}
```

### Greenlight Logic

```typescript
function evaluateOpportunity(opp: RexOpportunity, channelMemory: ChannelMemory) {
  // Never greenlight if confidence too low
  if (opp.confidenceScore < 0.5) return "hold";

  // Check channel hasn't covered this recently
  const recentlyCovered = channelMemory.recentTopics
    .some(t => topicSimilarity(t.topic, opp.topic) > 0.8);
  if (recentlyCovered) return "reject";

  // Check upload schedule isn't flooded
  const todayUploads = getScheduledUploads(today()).length;
  if (todayUploads >= 2) return "hold_until_tomorrow";

  // Check niche balance — don't over-index one niche
  const nicheRatio = getNicheRatioLast7Days(opp.niche);
  if (nicheRatio > 0.5) return "hold";  // >50% of recent videos same niche

  // Score the opportunity
  const totalScore = (
    opp.confidenceScore     * 0.30 +
    channelFitScore         * 0.25 +
    (1 - saturationScore)   * 0.20 +
    timingScore             * 0.15 +
    revenueScore            * 0.10
  );

  return totalScore >= 0.65 ? "greenlight" : "hold";
}
```

### Angle Selection

Regum picks the angle that maximises reach from Rex's suggestions:

```typescript
const ANGLE_SCORING = {
  // Curiosity gap angles perform best
  curiosity_gap:     1.5,
  // Contrarian angles drive comments
  contrarian:        1.4,
  // Practical angles drive shares
  practical:         1.3,
  // Explainer angles drive watch time
  explainer:         1.2,
  // News recap angles — commoditised, lower value
  straight_news:     0.8
};
```

---

## Qeon Brief Generation

When Regum greenlights, it writes a complete brief for Qeon:

```typescript
interface QeonBrief {
  briefId: string;
  topicId: string;
  topic: string;
  niche: string;

  // Content direction
  angle: string;            // the specific take Regum has chosen
  tone: "informative" | "entertaining" | "documentary" | "controversial";
  targetDuration: number;   // minutes
  urgency: "now" | "today" | "thisweek";

  // Avatar selection
  avatarId: string;         // which of the 5 avatars

  // Scheduling
  scheduledPublish: string; // ISO timestamp
  shortsPublish: string;    // ISO — 2-3 hrs before main

  // Channel management
  playlistId: string;       // existing or new
  seriesId: string | null;  // if part of a series
  endScreenVideoId: string; // which related video to show in end screen

  // SEO direction
  titleDirection: string;   // guidance on title formula
  keywordFocus: string[];   // primary keywords to target

  // Quality gate threshold
  qualityThreshold: number; // 7-9 depending on topic importance

  // Context from Zeus memory
  relevantMemories: string[];
  competitorGap: string;
  viewerRequestCount: number;
}
```

---

## Channel Management

### Playlist Architecture

Regum maintains a master playlist map and creates new ones when needed:

```typescript
const PLAYLIST_MAP = {
  // Core playlists — always exist
  "tech-reviews":       { id: "PL...", name: "Tech Reviews & Launches" },
  "world-news":         { id: "PL...", name: "World News Analysis" },
  "sports-breakdown":   { id: "PL...", name: "Sports Breakdown" },
  "finance-markets":    { id: "PL...", name: "Finance & Markets" },
  "science-space":      { id: "PL...", name: "Science & Space" },
  "politics-power":     { id: "PL...", name: "Politics & Power" },
  "entertainment":      { id: "PL...", name: "Entertainment & Culture" },
  "shorts-digest":      { id: "PL...", name: "Daily Digest Shorts" },

  // Series playlists — created dynamically
  "rrq-weekly":         { id: "PL...", name: "RRQ Weekly — Top Stories" },
  "first-look":         { id: "PL...", name: "First Look — New Launches" },
  "fact-check":         { id: "PL...", name: "RRQ Fact Check" },
  "deep-dive":          { id: "PL...", name: "Deep Dive" }
};

// Regum creates a new playlist when:
// - 5+ videos on a topic with no dedicated playlist
// - Major ongoing story (election, war, series of launches)
// - New niche the channel hasn't covered before
async function createPlaylistIfNeeded(topic: string, niche: string) {
  const existing = findBestPlaylist(topic, niche);
  if (existing) return existing.id;

  // Create new
  const playlist = await youtube.playlists.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: generatePlaylistName(topic), description: "" },
      status: { privacyStatus: "public" }
    }
  });
  return playlist.data.id;
}
```

### Series Detection

Regum identifies when a video should be part of a recurring series:

```typescript
const SERIES_RULES = {
  "rrq-weekly": {
    trigger: "day_of_week === 'sunday' && topics.length >= 5",
    format: "Top 5 stories of the week"
  },
  "first-look": {
    trigger: "topic.includes('launch') || topic.includes('release') || topic.includes('announced')",
    format: "First look at [product]"
  },
  "fact-check": {
    trigger: "rexConfidence === 'developing' || topic.includes('claim') || topic.includes('viral')",
    format: "Fact check: [claim]"
  },
  "deep-dive": {
    trigger: "targetDuration >= 15",
    format: "Deep Dive: [topic]"
  }
};
```

### Upload Schedule Management

```typescript
// Optimal upload windows (learned from Zeus analytics)
const UPLOAD_WINDOWS = {
  primary:   { days: [2, 4, 6], times: ["07:00", "19:00"] }, // Tue/Thu/Sat 7AM & 7PM IST
  secondary: { days: [1, 3, 5], times: ["12:00"] },           // Mon/Wed/Fri noon
  avoid:     { days: [0], times: [] }                          // Sunday — low traffic
};

// Cadence rules
const CADENCE_RULES = {
  maxPerDay: 2,
  minHoursBetween: 6,
  maxSameNichePerWeek: 3,    // don't flood one niche
  shortsBefore: 2.5          // hrs before main video
};

function findNextSlot(urgency: string, niche: string): Date {
  const schedule = getSchedule();
  const nicheCount = getNicheCountThisWeek(niche);

  if (urgency === "now") return findNextAvailableSlot(schedule, 2); // within 2hrs
  if (urgency === "today") return findNextPrimarySlot(schedule, today());
  return findNextOptimalSlot(schedule, UPLOAD_WINDOWS.primary);
}
```

### End Screen and Card Strategy

Regum manages end screens to maximise session watch time:

```typescript
// End screen logic — always chain to related content
function selectEndScreenVideo(currentVideo: Video): string {
  const sameNiche = getTopPerformingVideo(currentVideo.niche, exclude: currentVideo.id);
  const highWatch  = getMostWatchedVideo(exclude: currentVideo.id);

  // If same niche has a top performer → use that
  if (sameNiche.watchTime > channelAvgWatchTime * 1.2) return sameNiche.id;

  // Otherwise use channel's best overall
  return highWatch.id;
}

// Card injection at re-engagement moments (from script sections)
function generateCards(script: Script): Card[] {
  return script.cardSuggestions.map(s => ({
    type: s.linkTarget === "subscribe" ? "CHANNEL" : "VIDEO",
    timing: timestampToSeconds(s.timestamp),
    videoId: s.linkTarget !== "subscribe" ? findRelatedVideo(s.text) : null
  }));
}
```

---

## Analytics Strategy

### Weekly Analytics Review

```typescript
const REGUM_ANALYTICS_PROMPT = `
You are Regum, strategy agent for RRQ YouTube channel.

Last 7 days analytics:
${analyticsData}

Top 5 videos this week:
${topVideos}

Bottom 5 videos this week:
${bottomVideos}

Comment insights from Zeus:
${commentInsights}

Viewer requests:
${viewerRequests}

Analyse and return:
{
  "whatWorked": ["string"],
  "whatDidnt": ["string"],
  "audienceInsights": ["string"],
  "nicheToDoubleDown": "string",
  "nicheToReduce": "string",
  "formatRecommendation": "string",
  "timingAdjustment": "string | null",
  "lessonsForZeus": ["string"]  // Zeus will write these to memory
}
`;
```

### Channel Growth KPIs Regum Tracks

```
Watch time growth     → target: +10% week over week
CTR                   → target: >5% (above YouTube average)
Average view duration → target: >50% of video length
Subscriber conversion → views to subscribers ratio
Playlist session time → how long viewers stay after one video
Shorts to long-form   → % of Short viewers who watch full video
```

---

## Regum Performance Metrics (Zeus tracks these)

```
Greenlight accuracy:    % of greenlighted videos that beat channel average
Timing accuracy:        % of uploads that hit trend peak window
Angle effectiveness:    chosen angle CTR vs Rex's other suggested angles
Playlist engagement:    avg session time per playlist
Schedule efficiency:    % of optimal windows used vs missed
Series performance:     do series videos outperform standalone?
Niche balance score:    how well-distributed is niche coverage?
```
