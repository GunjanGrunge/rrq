---
name: theo
description: >
  THEO is RRQ's Channel Manager. Named after Theo Faber from The Silent
  Patient — he watches everything, misses nothing, and understands what
  the audience is really saying beneath the surface. THEO runs daily on
  Sonnet 4 for operations and Opus 4 for weekly synthesis. He owns
  everything that happens after Qeon uploads — comments, playlists,
  end screens, community posts, A/B testing, and channel page management.
  THEO is the face of RRQ to the outside world. The audience never meets
  Marcus or Felix. They meet Theo. Read this skill when building any
  community management, engagement, playlist, channel page, or
  post-upload channel management feature.
---

# THEO — Channel Manager

## Models

```
DAILY OPERATIONS    Sonnet 4
  Comment reading, responding, moderation
  Playlist management
  Community posts
  End screen audits
  A/B test monitoring
  Channel page maintenance

WEEKLY SYNTHESIS    Opus 4
  Channel health report for The Line
  Engagement pattern analysis
  Oracle knowledge integration
  Strategic recommendations
  Anomaly detection
```

---

## What Theo Owns

```
COMMENTS          Reading, responding, pinning, hearting, flagging
PLAYLISTS         Creating, ordering, naming, updating, assigning new videos
END SCREENS       Auditing suggestions, updating next-video recommendations
CARDS             Placement timing, relevance checking
COMMUNITY POSTS   Between-upload engagement, polls, teasers, recaps
CHANNEL PAGE      Featured video, trailer, about section, banner relevance
A/B TESTING       Title + thumbnail tests, reading results, reporting to The Line
CHANNEL HEALTH    Weekly synthesis of all engagement signals → The Line
```

---

## Schedule

```
UPLOAD DAY (within 2 hours of Qeon uploading):
  → Read first wave of comments
  → Pin the best engagement-driving comment
  → Respond to first 10 comments
  → Heart comments from returning viewers
  → Verify end screen suggestions are correct
  → Verify cards are placed correctly
  → Add video to correct playlist(s)
  → Post community teaser if applicable

DAILY (9AM):
  → Read all new comments from last 24h
  → Respond to unanswered genuine questions
  → Flag and remove spam/toxic comments
  → Check A/B test results (if test running)
  → Update channel page if featured video needs rotating
  → Post community content if scheduled

WEEKLY (Sunday — Opus 4):
  → Full channel health synthesis
  → Engagement pattern analysis
  → Playlist performance review
  → End screen click-through audit
  → A/B test results compiled
  → Oracle knowledge integration
  → Write weekly report → The Line
```

---

## Comment Strategy

Theo doesn't respond to every comment. He responds strategically.

```typescript
// lib/theo/comment-strategy.ts

export type CommentPriority =
  | "PIN_CANDIDATE"      // drives debate, asks great question, very insightful
  | "RESPOND_NOW"        // genuine question, engaged viewer, returning subscriber
  | "HEART_ONLY"         // positive, no response needed — heart it
  | "RESPOND_LATER"      // standard engagement, respond in batch
  | "IGNORE"             // shallow, no substance
  | "FLAG_REMOVE"        // spam, toxic, coordinated dislike
  | "ESCALATE"           // potential PR issue, sensitive topic, viral negativity

export interface CommentAction {
  commentId: string;
  priority: CommentPriority;
  action: "PIN" | "HEART" | "RESPOND" | "REMOVE" | "ESCALATE" | "IGNORE";
  responseText?: string;         // if RESPOND — written by Theo
  escalationReason?: string;     // if ESCALATE — sent to The Line
}

// Theo's comment triage runs within 2 hours of upload
// Then again every 24 hours
export async function triageComments(videoId: string): Promise<CommentAction[]> {

  const comments = await getYouTubeComments(videoId);
  const channelVoice = await getChannelVoice(); // RRQ voice constraints
  const oracleGuidance = await queryOracleKnowledge(
    "What comment response strategies are currently working for YouTube channel growth?",
    "VIDEO_STRUCTURE_META"
  );

  // Sonnet 4 analyses and prioritises each comment
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: `You are THEO, RRQ's channel manager. You manage YouTube comments
               with the following voice:
               - Warm but intelligent. Never sycophantic.
               - Engages genuinely with the point being made.
               - Asks follow-up questions that pull people back.
               - Never defensive when criticised — addresses it directly.
               - Consistent personality across every response.
               - Responses are SHORT — 1-3 sentences maximum.
               - Never says "great question!" or "thanks for watching!"
               
               Channel voice: ${channelVoice}
               Oracle guidance: ${oracleGuidance}`,
      messages: [{
        role: "user",
        content: `Triage these comments and return a JSON array of CommentAction objects.
                  For RESPOND actions include the responseText.
                  Identify one PIN_CANDIDATE — the comment most likely to drive
                  debate and keep people in the comments section.
                  
                  Comments: ${JSON.stringify(comments.slice(0, 50))}`
      }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
```

---

## The Pin Strategy

The pinned comment is Theo's most powerful tool.
One comment pinned = it appears at the top for every viewer.
Choose wrong and the energy dies. Choose right and the thread explodes.

```
GOOD PIN CANDIDATES:
  → A question that the video didn't fully answer
     (keeps people in comments debating)
  → A take that genuinely challenges the video's conclusion
     (drives replies, even from people defending RRQ's position)
  → A viewer sharing their own relevant experience
     (others relate and add their own — thread grows organically)
  → A surprising additional fact that adds to the video
     (makes comments feel like bonus content)

BAD PIN CANDIDATES:
  → Pure praise — "this video was amazing"
  → Generic agreement — "so true"
  → Anything that could embarrass the channel
  → Theo's own response (never pin your own reply)

TIMING:
  Pin within 2 hours of upload — before the comment section
  establishes its own social hierarchy without a pinned anchor.
```

---

## Playlist Architecture

```typescript
// lib/theo/playlist-manager.ts

// Playlist types Theo maintains
export const PLAYLIST_TYPES = {

  FORMAT_PLAYLISTS: [
    // One playlist per format — auto-populated as videos are produced
    "RRQ Comparisons",
    "RRQ Explainers",
    "RRQ News Breakdowns",
    "RRQ Deep Dives",
    "RRQ Shocking Facts",
    "RRQ Myth Busters",
    "RRQ Hot Takes",
    "RRQ Countdowns",
    // New formats added by Oracle → Theo creates playlist automatically
  ],

  NICHE_PLAYLISTS: [
    // Created dynamically by Theo when 3+ videos exist in a niche
    // e.g. "RRQ: AI & Tech", "RRQ: Finance", "RRQ: F1"
  ],

  SERIES_PLAYLISTS: [
    // Created when Regum schedules a multi-part topic
    // e.g. "The Complete AI Wars Series"
  ],

  BEST_OF: [
    // Theo curates manually — top performing videos
    // Updated monthly based on Zeus analytics data
    "RRQ Best Of — All Time",
    "RRQ Best Of — This Month",
  ],

} as const;

export async function assignVideoToPlaylists(
  videoId: string,
  videoMeta: VideoMetadata
): Promise<void> {

  const { format, niche, seriesId } = videoMeta;

  // 1. Always add to format playlist
  await addToPlaylist(videoId, `RRQ ${format}s`);

  // 2. Add to niche playlist (create if doesn't exist)
  const nichePlaylist = await getOrCreateNichePlaylist(niche);
  await addToPlaylist(videoId, nichePlaylist.id);

  // 3. Add to series playlist if part of series
  if (seriesId) {
    const seriesPlaylist = await getOrCreateSeriesPlaylist(seriesId);
    await addToPlaylist(videoId, seriesPlaylist.id);
  }

  // 4. Check if it qualifies for Best Of (added later by Theo weekly review)
}

// Theo audits playlists weekly
// Checks: ordering is correct, descriptions are current,
// no duplicate videos, no broken links
export async function auditPlaylists(): Promise<PlaylistAuditReport> {
  const playlists = await getAllChannelPlaylists();
  const issues: string[] = [];

  for (const playlist of playlists) {
    // Check ordering — newest content at top for niche/format playlists
    // Chronological order for series playlists
    const orderIssues = await checkPlaylistOrder(playlist);
    if (orderIssues.length > 0) issues.push(...orderIssues);

    // Check description is current and keyword-rich
    if (!playlist.description || playlist.description.length < 50) {
      issues.push(`Playlist "${playlist.title}" needs a better description`);
    }
  }

  return { playlistCount: playlists.length, issues, auditDate: new Date().toISOString() };
}
```

---

## End Screen & Card Management

```typescript
// lib/theo/end-screens.ts

// Theo audits end screens weekly
// The right next-video suggestion can add 15-25% to session time

export async function auditEndScreens(): Promise<EndScreenAuditReport> {

  const recentVideos = await getRecentVideos(30); // last 30 days
  const analyticsData = await getEndScreenClickData(recentVideos.map(v => v.id));
  const issues: EndScreenIssue[] = [];

  for (const video of recentVideos) {
    const clicks = analyticsData.find(a => a.videoId === video.id);

    // Low end screen CTR = wrong video suggested
    if (clicks && clicks.endScreenCTR < 0.05) {
      const betterSuggestion = await findBestNextVideo(video);
      issues.push({
        videoId: video.id,
        issue: "LOW_END_SCREEN_CTR",
        currentSuggestion: video.endScreenVideoId,
        recommendedSuggestion: betterSuggestion.id,
        reasoning: betterSuggestion.reasoning,
      });
    }
  }

  return { videosAudited: recentVideos.length, issues };
}

async function findBestNextVideo(video: Video): Promise<VideoSuggestion> {
  // Logic: find video with highest watch time that shares:
  // same niche OR same format OR same series
  // AND was published within 90 days (stays fresh)
  const candidates = await getRelatedVideos(video.id, {
    sameNiche: true,
    sameFormat: false,  // different format keeps variety
    maxAgeDays: 90,
  });

  // Sort by watch time percentage — highest retention = best next video
  candidates.sort((a, b) => b.avgViewDuration - a.avgViewDuration);

  return {
    id: candidates[0].id,
    reasoning: `Highest avg view duration (${candidates[0].avgViewDuration}%) in same niche`,
  };
}
```

---

## Community Posts

```typescript
// lib/theo/community-posts.ts

// Theo posts to community tab on a schedule around uploads

export const COMMUNITY_POST_SCHEDULE = {

  PRE_UPLOAD: {
    timing: "24 hours before scheduled upload",
    type: "TEASER",
    format: "Image + short teaser text",
    goal: "Build anticipation, drive notification opens",
    example: "We've been researching something that genuinely surprised us. "
           + "Dropping tomorrow. 👀",
  },

  POST_UPLOAD: {
    timing: "Day after upload",
    type: "ENGAGEMENT",
    format: "Poll or open question",
    goal: "Drive return visits, boost comment velocity",
    example: "After watching our latest video — which side are you on? [Poll]",
  },

  MID_WEEK: {
    timing: "Wednesday if no upload that day",
    type: "COMMUNITY",
    format: "Question or behind-the-scenes",
    goal: "Keep channel alive between uploads, feed algorithm",
    example: "What topic should we cover next? Drop it below.",
  },

  MILESTONE: {
    timing: "On milestone reached (subs, views)",
    type: "CELEBRATION",
    format: "Gratitude + tease of what's coming",
    goal: "Community building, subscriber retention",
  },

} as const;

export async function generateCommunityPost(
  type: keyof typeof COMMUNITY_POST_SCHEDULE,
  context: CommunityPostContext
): Promise<string> {

  const oracleGuidance = await queryOracleKnowledge(
    "What community post styles are driving the most engagement on YouTube in 2025?",
    "VIDEO_STRUCTURE_META"
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: `You are THEO, RRQ's channel manager writing a community post.
               Voice: Smart, warm, genuine. Never hype. Never cringe.
               Short — community posts are 1-3 sentences maximum.
               Feel like a real person, not a brand account.
               Oracle guidance: ${oracleGuidance}`,
      messages: [{
        role: "user",
        content: `Write a ${type} community post.
                  Context: ${JSON.stringify(context)}
                  Return only the post text, nothing else.`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text.trim();
}
```

---

## A/B Testing

```typescript
// lib/theo/ab-testing.ts

// Theo runs title and thumbnail A/B tests on every video
// YouTube Studio supports this natively — Theo manages the lifecycle

export async function initiateABTest(videoId: string): Promise<void> {
  // Theo requests two title variants and two thumbnail variants from MUSE
  // These were generated by Qeon at upload time and held in DynamoDB

  const variants = await getABVariants(videoId);
  if (!variants || variants.length < 2) return;

  // Start test via YouTube Data API
  await startYouTubeABTest(videoId, variants);

  // Schedule result check at 48 hours
  await scheduleABResultCheck(videoId, 48);
}

export async function readABResults(videoId: string): Promise<ABTestResult> {
  const results = await getYouTubeABTestResults(videoId);

  // Declare winner if CTR difference > 15% and sample size > 500 impressions
  const winner = results.variantA.impressions > 500 &&
                 results.variantB.impressions > 500 &&
                 Math.abs(results.variantA.ctr - results.variantB.ctr) > 0.15
    ? results.variantA.ctr > results.variantB.ctr ? "A" : "B"
    : "INCONCLUSIVE";

  // Report to The Line — Zeus gets the pattern, MUSE gets the learning
  await writeToAgentMessages({
    type: "AB_TEST_RESULT",
    from: "THEO",
    to: "THE_LINE",
    payload: {
      videoId,
      winner,
      variantA: results.variantA,
      variantB: results.variantB,
      insight: winner !== "INCONCLUSIVE"
        ? `${winner === "A" ? results.variantA.label : results.variantB.label} won by ${
            Math.abs(results.variantA.ctr - results.variantB.ctr).toFixed(2)
          }% CTR`
        : "Inconclusive — insufficient sample or small difference",
    }
  });

  return { videoId, winner, results };
}
```

---

## Weekly Channel Health Report (Opus 4)

Theo's most important output. Runs every Sunday. Goes to The Line.

```typescript
// lib/theo/weekly-report.ts

export async function generateWeeklyReport(): Promise<TheoWeeklyReport> {

  // Gather all data from the week
  const [
    commentMetrics,
    playlistMetrics,
    endScreenMetrics,
    communityPostMetrics,
    abTestResults,
    subscriberData,
  ] = await Promise.all([
    getWeeklyCommentMetrics(),
    getWeeklyPlaylistMetrics(),
    getWeeklyEndScreenMetrics(),
    getWeeklyCommunityPostMetrics(),
    getWeeklyABTestResults(),
    getWeeklySubscriberData(),
  ]);

  // Oracle knowledge for context
  const oracleContext = await queryOracleKnowledge(
    "What channel health patterns should I watch for? What engagement benchmarks matter most?",
    "VIDEO_STRUCTURE_META"
  );

  // Opus 4 synthesises everything
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 2000,
      system: `You are THEO synthesising the weekly channel health report.
               Be precise. Flag anomalies. Surface genuine insights.
               Distinguish signal from noise.
               Oracle context: ${oracleContext}`,
      messages: [{
        role: "user",
        content: `Generate the weekly channel health report from this data.
                  
                  Comment metrics: ${JSON.stringify(commentMetrics)}
                  Playlist metrics: ${JSON.stringify(playlistMetrics)}
                  End screen CTR: ${JSON.stringify(endScreenMetrics)}
                  Community posts: ${JSON.stringify(communityPostMetrics)}
                  A/B results: ${JSON.stringify(abTestResults)}
                  Subscriber data: ${JSON.stringify(subscriberData)}
                  
                  Return JSON: {
                    summary: string,
                    healthScore: 0-100,
                    wins: string[],
                    concerns: string[],
                    anomalies: string[],
                    recommendations: string[],
                    urgentForZeus: string[]  // only what genuinely needs Zeus
                  }`
      }]
    })
  });

  const data = await response.json();
  const report = JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());

  // Send to The Line
  await writeToAgentMessages({
    type: "THEO_WEEKLY_REPORT",
    from: "THEO",
    to: "THE_LINE",
    payload: report,
  });

  return report;
}
```

---

## Oracle Integration

Theo queries Oracle before every major decision cycle.

```
DAILY:     "What comment engagement techniques are working on YouTube right now?"
           "What community post formats are driving return visits this month?"

WEEKLY:    "What playlist structures are extending session time on YouTube?"
           "What end screen formats have the highest CTR currently?"
           "What channel management practices should I adopt or stop doing?"

ON ALERT:  "How should a YouTube channel respond to a comment controversy?"
           "What is the current best practice for handling negative viral comments?"
```

Oracle feeds Theo with both platform-level knowledge (what works on YouTube generally)
and channel-level patterns (what works specifically on RRQ based on Zeus's data).
Theo applies both. Every week he knows something he didn't know the week before.

---

## New DynamoDB Tables

```
theo-comment-actions      PK: videoId+commentId
                          fields: priority, action, responseText,
                                  timestamp, outcome

theo-ab-tests             PK: videoId
                          fields: variantA, variantB, winner,
                                  startDate, endDate, impressions, ctr

theo-community-posts      PK: postId
                          fields: type, content, publishDate,
                                  likes, comments, impressions

theo-playlist-audit       PK: auditDate
                          fields: playlistCount, issues[], resolved[]

theo-weekly-reports       PK: reportDate
                          fields: healthScore, summary, wins[],
                                  concerns[], anomalies[], recommendations[]
```

---

## New Environment Variables

```bash
# YouTube Data API already configured for Qeon — Theo reuses
# YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI

# Theo schedule
THEO_DAILY_RULE=cron(0 9 * * ? *)           # 9AM daily
THEO_UPLOAD_TRIGGER=EVENT_DRIVEN             # triggers on Qeon upload complete
THEO_WEEKLY_RULE=cron(0 8 ? * SUN *)        # 8AM Sunday (before The Line at 9AM)
```

---

## Checklist

```
[ ] Create lib/theo/ folder
[ ] Create lib/theo/comment-strategy.ts      — triage, respond, pin, flag
[ ] Create lib/theo/playlist-manager.ts      — assignment, ordering, audit
[ ] Create lib/theo/end-screens.ts           — audit, optimise suggestions
[ ] Create lib/theo/community-posts.ts       — generation, scheduling
[ ] Create lib/theo/ab-testing.ts            — initiate, monitor, report
[ ] Create lib/theo/weekly-report.ts         — Opus 4 synthesis → The Line
[ ] Create DynamoDB tables (5 tables above)
[ ] Add EventBridge rules (daily + upload trigger + weekly)
[ ] Wire Theo trigger to Qeon upload completion event
[ ] Add Oracle query calls at each decision point
[ ] Add Theo health panel to Zeus Command Center
[ ] Test comment triage with real YouTube video
[ ] Test playlist assignment on first upload
[ ] Verify weekly report reaches The Line correctly
```
