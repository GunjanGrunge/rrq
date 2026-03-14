---
name: avatar-gen
description: >
  Avatar-gen is RRQ's presenter generation and rotation system. It manages
  a dynamic roster of 3-5 channel presenters, each with a permanent face
  (seed-locked FLUX portrait), evolving personality, and content-type
  ownership. FLUX.1 [dev] on EC2 g4dn.xlarge spot generates portraits
  once at channel onboarding and never again for that presenter. SkyReels
  V2 reuses the same reference.jpg every video — face consistency is
  guaranteed by SkyReels I2V architecture. Regum owns rotation logic.
  Zeus scores presenter performance. Oracle tracks presenter analytics
  and triggers evolution reviews. Read this skill when building presenter
  generation, roster management, rotation logic, personality evolution,
  or the human-in-loop approval gate.
---

# Avatar-Gen — Presenter Roster & Generation System

## What Avatar-Gen Is Not

```
NOT AVATAR-GEN'S JOB:   Generating per-video talking head video  → SkyReels (EC2)
NOT AVATAR-GEN'S JOB:   Deciding which topic to cover            → Rex + Regum
NOT AVATAR-GEN'S JOB:   Writing the script                       → Qeon script step
NOT AVATAR-GEN'S JOB:   Managing upload schedule                 → Regum
NOT AVATAR-GEN'S JOB:   Tracking channel-level analytics         → Zeus
```

## What Avatar-Gen Owns

```
OWNS:  Portrait generation (FLUX.1 [dev] on EC2 — once per presenter lifetime)
OWNS:  character_config.json (personality, traits, content assignment, voice)
OWNS:  Presenter roster state in DynamoDB avatar-profiles table
OWNS:  Human-in-loop approval gate (optional — off by default)
OWNS:  Personality evolution records (face never changes, personality deepens)
OWNS:  Feeding presenter context into SkyReels job parameters
```

---

## Presenter Roster Design

### Gender Ratio — Default

```
RRQ default roster ratio: 3F:1M or 4F:1M

Rationale:
  Majority female roster is a deliberate strategic decision.
  Female presenters index higher on trust, warmth, and watch time
  retention across the widest range of content categories.
  Male presenter included for credibility-anchored content types
  (finance deep dives, technical hardware analysis, geopolitical breakdowns).

Override: user may set ratio during onboarding. Roster must have
  minimum 1 presenter before any video can be produced.
  Maximum 5 presenters before Oracle triggers a review
  of whether expansion adds value or dilutes audience recognition.
```

### Presenter Archetype Table — Default 4-Presenter Roster

```
ID              Gender   Style               Content Ownership
──────────────────────────────────────────────────────────────────
presenter_f1    Female   Editorial power     Breaking news, tech, AI,
                         (blazer, poised,    finance, trending topics.
                         authority voice)    High-stakes topics. Default
                                             presenter when no match found.

presenter_f2    Female   Smart-casual        Explainer videos, how-to
                         (contemporary,      series, deep dives, science,
                         warm, intelligent)  education. Long-form anchor.

presenter_f3    Female   Bold lifestyle      Beauty, culture, lifestyle,
                         (expressive,        entertainment, social trends,
                         charismatic,        gaming culture. Shorts-first.
                         dynamic presence)

presenter_m1    Male     Documentary         Finance investigation,
                         authority           geopolitics, investigative
                         (suit, credible,    explainers, technical hardware,
                         measured delivery)  serious analytical topics.
```

### Expansion Roster (Slots 5+)

```
Triggered by Oracle Domain 10 when:
  - Existing presenter content-type mismatch > 20% of videos for 30 days
  - New content category added to channel niche that has no natural owner
  - Performance gap: one presenter averaging 40% lower CTR than roster mean

New presenter generation follows same FLUX pipeline as initial onboarding.
Zeus logs roster expansion as EXPANSION_EVENT in oracle-updates table.
```

---

## Portrait Generation — FLUX.1 [dev] on EC2

### When FLUX Fires

```
TRIGGER 1:  Channel onboarding — CHANNEL_MODE_SET EventBridge event
            All presenters for the initial roster generated in one batch.

TRIGGER 2:  Roster expansion event — Oracle Domain 10 recommendation
            approved by Zeus. Only new presenter(s) generated.

TRIGGER 3:  Manual regeneration — user hits REGENERATE in approval gate UI.
            One presenter at a time. Previous seed discarded.

NEVER:      Fires mid-pipeline. FLUX does not run per-video.
            SkyReels reuses the reference.jpg stored in S3 forever.
```

### EC2 Instance Specification

```
Instance:     g4dn.xlarge spot
GPU:          1x NVIDIA T4 (16GB VRAM)
VRAM budget:  FLUX.1 [dev] FP8 quantised = ~12GB VRAM
Disk:         200GB gp3 (model weights + output)
Spot price:   ~$0.16/hr (us-east-1)
Runtime:      ~4 min per portrait at 1024x1024
Batch:        All roster portraits generated in one spot session
Termination:  Self-terminates after batch upload to S3 confirmed
Cost:         ~$0.02-0.04 for a full 4-presenter batch
```

### Seed Locking — Permanent Face Consistency

```typescript
// Seed is generated once per presenter, stored forever in avatar-profiles DynamoDB.
// Same seed + same base_prompt = same face geometry, always.
// This is how face consistency is maintained across a presenter's lifetime.

function generatePresenterSeed(): number {
  // Cryptographically random 32-bit unsigned integer
  // Written to DynamoDB immediately. Never overwritten except on REGENERATE.
  return Math.floor(Math.random() * 2 ** 32);
}

// FLUX inference call with seed lock
const fluxParams = {
  prompt:          presenter.base_prompt,
  seed:            presenter.seed,          // LOCKED — never changes
  num_steps:       50,
  guidance_scale:  3.5,
  width:           1024,
  height:          1024,
  output_format:   "jpg",
  output_quality:  95,
};
```

### FLUX Prompt Templates

#### Female Presenter Prompts

```
// presenter_f1 — Editorial Power
base_prompt: "Professional female presenter, tailored power blazer in deep navy
or charcoal, clean structured collar, bold confident direct gaze into camera,
sharp strong features, elegant grooming, immaculate skin, hair styled away from
face or sleek blowout, modern dark studio background with subtle rim lighting,
cinematic portrait photography, photorealistic, 8k quality, Hasselblad medium
format aesthetic, no jewelry distraction, authority and composure, age 28-38"

// presenter_f2 — Smart Casual Intellectual
base_prompt: "Intelligent female presenter, contemporary smart-casual styling,
structured knit or refined blouse, warm expressive eyes conveying curiosity and
depth, relaxed yet composed posture, natural soft makeup, glossy healthy hair,
modern neutral background soft bokeh, cinematic portrait photography,
photorealistic, 8k quality, editorial magazine lighting, approachable and
credible, relatable warmth without losing authority, age 25-35"

// presenter_f3 — Bold Lifestyle
base_prompt: "Charismatic female lifestyle presenter, bold statement outfit in
rich jewel tone or confident colour, expressive animated face, radiant flawless
skin, statement hair styling, dynamic energy in posture, editorial beauty
lighting, warm skin tones, vibrant photorealistic portrait, 8k quality,
high-fashion editorial aesthetic, magnetic presence, engaging eyes, age 24-33"

// Generic female expansion slot
base_prompt_template: "Professional female presenter, {style_descriptor},
confident direct gaze, photorealistic portrait, cinematic studio lighting,
well-groomed, polished appearance, dark professional background, 8k quality,
{age_range}"
```

#### Male Presenter Prompts

```
// presenter_m1 — Documentary Authority
base_prompt: "Authoritative male documentary presenter, premium dark charcoal
suit, crisp white or light blue shirt, no tie or understated tie, strong jaw,
calm analytical expression, direct intelligent gaze, distinguished professional
appearance, dark studio background with subtle depth lighting, cinematic portrait
photography, photorealistic, 8k quality, BBC documentary presenter aesthetic,
trustworthy measured gravitas, age 32-45"

// Generic male expansion slot
base_prompt_template: "Professional male presenter, {style_descriptor},
confident composed expression, photorealistic portrait, cinematic studio
lighting, authoritative but approachable, dark professional background,
8k quality, {age_range}"
```

#### Diversity Instruction (Applied to All)

```
All portraits default to diverse ethnicity across the roster.
No two presenters in the same roster should share the same apparent ethnicity.
Regum sets ethnicity guidance during brief generation if niche warrants it
(e.g., SNIPER geo-strategy indicates primary market is South Asia — Regum
adjusts demographic composition of roster accordingly).

Diversity is a strategic decision, not a compliance checkbox.
Wider demographic representation = broader audience identification.
```

---

## Character Config — Full Schema

### DynamoDB Table: `avatar-profiles`

```
PK:  channelId   (string)
SK:  presenterId (string — e.g., "presenter_f1")
```

### TypeScript Interface

```typescript
export interface AvatarProfile {
  // Identity
  channelId:          string;
  presenterId:        string;              // "presenter_f1", "presenter_f2", etc.
  displayName:        string;              // Internal name used in logs and briefs
  gender:             "FEMALE" | "MALE" | "NEUTRAL";
  archetype:          string;              // "editorial_power" | "smart_casual" | "bold_lifestyle" | "documentary_authority"

  // Portrait Generation (FLUX — immutable after generation)
  seed:               number;              // LOCKED — never changes after first generation
  base_prompt:        string;              // LOCKED — never changes
  s3_reference:       string;             // S3 key: avatars/dynamic/{channelId}/{presenterId}/reference.jpg
  generated_at:       string;             // ISO timestamp of portrait generation
  portrait_version:   number;             // Increments only on REGENERATE (rare)

  // Voice
  voice_id:           string;             // ElevenLabs voice ID
  voice_style:        string;             // "authoritative" | "warm" | "energetic" | "measured"
  edge_tts_fallback:  string;             // Edge-TTS voice code for fallback

  // Personality (evolves — face never changes)
  personality:        PersonalityProfile;
  expression_hints:   ExpressionHint[];   // SkyReels expression parameters per content type
  content_assignment: ContentAssignment;

  // Performance
  performance_scores: PresenterPerformanceScores;
  use_count:          number;
  last_used:          string;             // ISO timestamp

  // Evolution
  version:            number;             // personality version, not face version
  evolution_history:  EvolutionRecord[];

  // Approval
  approval_status:    "PENDING_APPROVAL" | "APPROVED" | "AUTO_APPROVED";
  approved_at?:       string;
  approved_by?:       "HUMAN" | "AUTO_TIMEOUT";
}

export interface PersonalityProfile {
  core_traits:        string[];           // e.g., ["analytical", "composed", "direct"]
  delivery_style:     string;             // e.g., "measured authority with dry wit"
  hook_style:         string;             // e.g., "opens with a counterintuitive claim"
  content_strengths:  string[];           // content categories this presenter excels at
  audience_rapport:   string;             // how this presenter builds trust
  verbal_tics:        string[];           // speech patterns (for voice cue calibration)
  avoid:              string[];           // things that break this presenter's authenticity
}

export interface ExpressionHint {
  content_type:       string;             // "BREAKING_NEWS" | "EXPLAINER" | "LIFESTYLE" etc.
  skyreels_params: {
    expression:       string;             // SkyReels V2 expression code
    intensity:        number;             // 0.0-1.0
    pacing:           "FAST" | "MEASURED" | "SLOW";
    energy:           "HIGH" | "MEDIUM" | "LOW";
  };
}

export interface ContentAssignment {
  primary_types:      string[];           // content types this presenter owns
  secondary_types:    string[];           // can cover if primary presenter unavailable
  excluded_types:     string[];           // should never cover
  niche_fit_score:    Record<string, number>;  // niche id → 0-100 fit score
}

export interface PresenterPerformanceScores {
  avg_ctr:            number;             // average CTR across all this presenter's videos
  avg_retention:      number;             // average watch time retention %
  avg_likes_ratio:    number;             // likes / views
  content_type_scores: Record<string, number>;  // per content type performance
  last_updated:       string;             // ISO timestamp
  video_count:        number;             // total videos scored
}

export interface EvolutionRecord {
  version:            number;
  evolved_at:         string;             // ISO timestamp
  trigger:            "ORACLE_REVIEW" | "ZEUS_DIRECTIVE" | "MANUAL";
  changed_fields:     string[];           // what changed in personality
  reason:             string;             // why Oracle/Zeus triggered evolution
  performance_delta:  number;             // CTR change after evolution (filled by Zeus later)
}
```

### character_config.json — Example

```json
{
  "presenterId": "presenter_f1",
  "displayName": "Zara",
  "gender": "FEMALE",
  "archetype": "editorial_power",
  "seed": 2847361920,
  "s3_reference": "avatars/dynamic/channel_abc123/presenter_f1/reference.jpg",
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "voice_style": "authoritative",
  "edge_tts_fallback": "en-US-AriaNeural",
  "personality": {
    "core_traits": ["analytical", "composed", "direct", "decisive"],
    "delivery_style": "Measured authority with controlled urgency on breaking topics. Never breathless. Commands attention without raising her voice.",
    "hook_style": "Opens with a statement most people assume is wrong, then immediately proves it. Cold opens lean factual, not emotional.",
    "content_strengths": ["BREAKING_NEWS", "TECH_ANALYSIS", "FINANCE", "AI_DEVELOPMENTS"],
    "audience_rapport": "Builds trust through precision. Viewers feel she has done the work so they don't have to.",
    "verbal_tics": ["short declarative sentences", "rhetorical pause before key data points"],
    "avoid": ["exclamation energy", "lifestyle framing", "pop culture references"]
  },
  "expression_hints": [
    {
      "content_type": "BREAKING_NEWS",
      "skyreels_params": {
        "expression": "concentrated_focus",
        "intensity": 0.8,
        "pacing": "MEASURED",
        "energy": "HIGH"
      }
    },
    {
      "content_type": "EXPLAINER",
      "skyreels_params": {
        "expression": "engaged_clarity",
        "intensity": 0.6,
        "pacing": "MEASURED",
        "energy": "MEDIUM"
      }
    }
  ],
  "content_assignment": {
    "primary_types": ["BREAKING_NEWS", "TECH_ANALYSIS", "FINANCE", "AI"],
    "secondary_types": ["EXPLAINER", "GEOPOLITICS"],
    "excluded_types": ["BEAUTY", "GAMING_CULTURE", "LIFESTYLE"],
    "niche_fit_score": {
      "tech": 95,
      "finance": 92,
      "ai": 98,
      "science": 80,
      "business": 85,
      "beauty": 20,
      "gaming": 35
    }
  },
  "performance_scores": {
    "avg_ctr": 0.068,
    "avg_retention": 0.54,
    "avg_likes_ratio": 0.042,
    "content_type_scores": {
      "BREAKING_NEWS": 88,
      "TECH_ANALYSIS": 82,
      "FINANCE": 79
    },
    "last_updated": "2026-03-14T09:00:00Z",
    "video_count": 14
  },
  "version": 2,
  "approval_status": "APPROVED",
  "approved_by": "HUMAN"
}
```

---

## Muse Character Brief — Generation & Format

### When Muse Generates Character Briefs

```
Trigger: Channel onboarding CHANNEL_MODE_SET event fires.
Muse receives: channelNiche, channelMode, geoStrategy (from SNIPER),
               rosterSize, genderRatio (from user onboarding settings).

Muse outputs: one CharacterBrief per presenter slot.
Regum receives CharacterBrief array → sets strategic content assignment.
Avatar-gen receives CharacterBrief + ContentAssignment → builds FLUX prompt + character_config.
```

### CharacterBrief TypeScript Interface

```typescript
export interface CharacterBrief {
  slotId:              string;            // "presenter_f1", "presenter_f2", etc.
  gender:              "FEMALE" | "MALE" | "NEUTRAL";
  ageRange:            string;            // e.g., "25-35"
  archetype:           string;
  visualDirection: {
    style:             string;            // "editorial power blazer" etc.
    colourPalette:     string;            // outfit/colour direction for FLUX prompt
    hairDirection:     string;
    makeupIntensity:   "MINIMAL" | "NATURAL" | "POLISHED" | "BOLD";
    backgroundNote:    string;
  };
  personality: {
    coreTraits:        string[];
    deliveryStyle:     string;
    hookStyle:         string;
    audienceRapport:   string;
    verbalTics:        string[];
    avoid:             string[];
  };
  contentFit:          string[];          // content types this presenter is designed for
  voiceDirection:      string;            // e.g., "measured authority, slight mid-Atlantic"
  strategicRationale:  string;            // why this presenter exists in this roster
}
```

### Example Muse Character Brief Output

```json
{
  "slotId": "presenter_f2",
  "gender": "FEMALE",
  "ageRange": "26-34",
  "archetype": "smart_casual",
  "visualDirection": {
    "style": "Contemporary smart-casual. Structured knit or refined silk blouse. Approachable without sacrificing sharpness.",
    "colourPalette": "Warm neutrals, dusty rose, sage green. Nothing corporate grey.",
    "hairDirection": "Natural waves or sleek bob. Feels real, not produced.",
    "makeupIntensity": "NATURAL",
    "backgroundNote": "Warm neutral with soft depth bokeh. Not a cold dark studio — warmer than presenter_f1."
  },
  "personality": {
    "coreTraits": ["curious", "warm", "thorough", "unpretentious"],
    "deliveryStyle": "Conversational authority. Explains complex ideas as if talking to a smart friend. Pacing is relaxed but never slow. Uses analogies freely.",
    "hookStyle": "Opens with a relatable question the viewer has definitely asked themselves. Immediate recognition moment. Never stats-first.",
    "audienceRapport": "Feels like the most knowledgeable person at the dinner table who actually wants to share what they know.",
    "verbalTics": ["uses 'here's the thing'", "pauses before counterintuitive reveals", "occasionally self-corrects mid-explanation (sounds authentic)"],
    "avoid": ["corporate register", "sounding like a press release", "overly dramatic hooks"]
  },
  "contentFit": ["EXPLAINER", "SCIENCE", "HEALTH", "EDUCATION", "DEEP_DIVE_SERIES"],
  "voiceDirection": "Warm mid-range. Confident but not anchorial. Sounds like she genuinely finds this interesting.",
  "strategicRationale": "Counterweight to presenter_f1's authority tone. Handles long-form content where trust-through-warmth outperforms trust-through-precision. Essential for health, science, and education niches where approachability drives completion rate."
}
```

---

## Rotation Logic — Regum Owns This

### Rules (Hardcoded)

```
RULE 1 — No Run of Three:
  Same presenter cannot appear in 3 consecutive published videos.
  Enforced at scheduling time by Regum — before job is queued.

RULE 2 — Content Type Match:
  Presenter must have content_type in primary_types or secondary_types.
  If no presenter matches: default to presenter_f1 (editorial power — broadest range).

RULE 3 — Performance Weight:
  Zeus performance scores feed a weighted probability distribution.
  Higher-performing presenter gets more slots — not all slots.
  Distribution is recalculated weekly by Zeus after analytics review.

RULE 4 — 20% Controlled Randomness:
  Even if one presenter is scoring highest, 20% of rotation is
  random-sampled from the full eligible roster. Prevents the channel
  from feeling algorithmically sampled — human channels have variety.

RULE 5 — Recovery Period:
  After a video underperforms (CTR below 50% of channel mean for that type),
  that presenter gets a minimum 2-video rest before being re-assigned to
  the same content type. Performance isolation, not presenter blame.
```

### Rotation Pseudocode

```typescript
function selectPresenter(
  contentType: string,
  recentHistory: string[],      // last N presenter IDs in published order
  performanceScores: Record<string, number>,
  allProfiles: AvatarProfile[]
): AvatarProfile {

  // Step 1: Filter to eligible presenters for this content type
  const eligible = allProfiles.filter(p =>
    p.content_assignment.primary_types.includes(contentType) ||
    p.content_assignment.secondary_types.includes(contentType)
  );

  if (eligible.length === 0) {
    // Fallback: use presenter_f1 (default broadest-range presenter)
    return allProfiles.find(p => p.presenterId === "presenter_f1")!;
  }

  // Step 2: Apply no-run-of-three rule
  const lastTwo = recentHistory.slice(-2);
  const filtered = eligible.length > 1
    ? eligible.filter(p => {
        const appearsInLastTwo = lastTwo.includes(p.presenterId);
        const wouldBeThirdConsecutive =
          lastTwo.length === 2 &&
          lastTwo[0] === p.presenterId &&
          lastTwo[1] === p.presenterId;
        return !wouldBeThirdConsecutive;
      })
    : eligible;

  // Step 3: 20% controlled randomness vs 80% performance-weighted
  const useRandom = Math.random() < 0.20;

  if (useRandom) {
    // Random sample from eligible filtered pool
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // Step 4: Weighted selection by performance score
  const weights = filtered.map(p => ({
    presenter: p,
    weight: performanceScores[p.presenterId] ?? 50,  // default 50 if no data yet
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { presenter, weight } of weights) {
    random -= weight;
    if (random <= 0) return presenter;
  }

  // Fallback: return highest scoring eligible presenter
  return filtered.sort(
    (a, b) => (performanceScores[b.presenterId] ?? 50) - (performanceScores[a.presenterId] ?? 50)
  )[0];
}
```

### DynamoDB Rotation State

```
Table: avatar-profiles
Field: last_used        → ISO timestamp, updated by Regum after slot assignment
Field: use_count        → incremented on every slot assignment

Regum reads recent production-jobs table to reconstruct recentHistory[]
before every rotation decision. Does not cache rotation state — always
derives from source of truth in production-jobs.
```

---

## SkyReels Integration — How Presenters Feed Into Video Production

### What Happens Every Video

```
1. Regum selects presenter via rotation logic → writes presenterId to QeonBrief.
2. Qeon reads character_config.json from S3 for that presenter.
3. Qeon routes TALKING_HEAD + SPLIT_SCREEN beats to SkyReels EC2.
4. SkyReels job parameters include:
     - reference_image: s3://content-factory-assets/{s3_reference}
     - audio_path: s3 key of voiceover MP3
     - expression_hint: matched from expression_hints[] by content type
     - pacing: from expression_hints[].skyreels_params.pacing
5. SkyReels V2 I2V reads same reference.jpg → same face → different expressions.
6. Output: talking head MP4 segments → av-sync Lambda stitches final video.
```

### Expression Hint Resolution

```typescript
function resolveExpressionHint(
  presenter: AvatarProfile,
  contentType: string
): ExpressionHint["skyreels_params"] {

  const exactMatch = presenter.expression_hints.find(
    h => h.content_type === contentType
  );

  if (exactMatch) return exactMatch.skyreels_params;

  // Fallback: use most general expression hint available
  const fallback = presenter.expression_hints.find(
    h => h.content_type === "EXPLAINER"
  );

  // Last resort: default parameters
  return fallback?.skyreels_params ?? {
    expression:  "engaged_neutral",
    intensity:   0.6,
    pacing:      "MEASURED",
    energy:      "MEDIUM",
  };
}
```

---

## Human-in-Loop Approval Gate

### Default State: OFF

```
Human approval gate is disabled by default.
Pipeline generates portraits, auto-approves after portrait upload to S3,
and proceeds immediately to character_config.json generation.

Enable via: user-settings DynamoDB table
  field: avatar_approval_gate = true | false (default: false)
```

### Gate Flow (When Enabled)

```
1. FLUX generates portrait batch → uploads to S3.
2. Pipeline hard stops.
3. /app/onboarding/avatar-review page renders:
     - Portrait image preview (full quality)
     - Character name + archetype
     - Personality summary card
     - Core traits list
     - Content type ownership badges
     - Voice style description

4. User sees three actions:
     [APPROVE]              — accepts portrait + personality, proceeds
     [REGENERATE]           — discards current portrait, re-runs FLUX with new random seed
                              New seed is stored. Old seed discarded. One retry per presenter.
     [EDIT TRAITS]          — keeps portrait, opens personality editor
                              User can edit: core_traits, delivery_style, avoid[]
                              Cannot edit: visual direction, voice assignment (Regum's domain)

5. 24-hour timeout → AUTO_APPROVED if no user action.
   Zeus logs auto-approval as approval_status: "AUTO_APPROVED".
   Oracle reads this as lower confidence than human approval.

6. Human APPROVE → Zeus logs:
   approval_status: "APPROVED"
   approved_by: "HUMAN"
   Zeus writes episode to rrq-memory with signal_type: "HIGH_CONFIDENCE_SIGNAL"
   Oracle uses human approval signal in Domain 10 presenter analytics.
```

### Approval Gate UI State Machine

```typescript
type ApprovalGateState =
  | "GENERATING"          // FLUX running
  | "AWAITING_REVIEW"     // portraits ready, waiting for user
  | "REGENERATING"        // user hit REGENERATE, FLUX re-running
  | "EDITING_TRAITS"      // user in trait editor
  | "APPROVED"            // human approved
  | "AUTO_APPROVED"       // 24hr timeout expired
  | "COMPLETE";           // character_config.json written, onboarding can continue

// State stored in DynamoDB: pipeline-state table
// PK: userId, SK: "avatar_approval"
```

---

## Personality Evolution — Face Never Changes

### What Evolves vs What Is Permanent

```
PERMANENT (seed-locked, never changes):
  Portrait face geometry
  Hair colour and style in portrait
  Physical features

EVOLVES (personality deepens over time):
  core_traits[]           — new traits added, rarely removed
  delivery_style          — refined based on what's working
  hook_style              — updated if Oracle finds new hook meta
  expression_hints[]      — new content types added as channel expands
  content_assignment      — niche_fit_score updated by Zeus performance data
  voice_id                — can be updated if ElevenLabs releases better model match
```

### Evolution Trigger Conditions

```
ORACLE_REVIEW trigger (primary):
  Oracle Domain 10 runs — finds presenter performance data suggests
  personality adjustment would improve CTR or retention.
  Oracle writes recommendation to oracle-updates table.
  Zeus reads recommendation at next morning brief.
  Zeus decides: APPLY | DEFER | REJECT.
  If APPLY: Zeus writes updated personality to avatar-profiles.
            version++ in DynamoDB.
            evolution_history[] gets new EvolutionRecord.

ZEUS_DIRECTIVE trigger:
  Zeus detects cross-video pattern (e.g., presenter_f2 underperforms
  every time she covers finance topics). Zeus directly updates
  content_assignment.excluded_types[] and logs reason.

MANUAL trigger:
  User edits traits via EDIT TRAITS gate (only during onboarding or
  via user settings page). Increments version. Logs as MANUAL trigger.
```

### Evolution Safety Rules

```
RULE: Never change more than 2 core_traits in a single evolution pass.
      Audience builds recognition on presenter consistency.
      Dramatic overnight personality shifts undermine trust.

RULE: Oracle must provide performance evidence for evolution recommendation.
      "avg CTR improved 12% on TECH_ANALYSIS beats after delivery_style
      shift toward drier humour" — this is valid evidence.
      Gut feel or stylistic preference is not valid.

RULE: Zeus has final authority on all evolution decisions.
      Oracle recommends. Zeus decides.
      Zeus logs reason for REJECT alongside Oracle's recommendation.
```

---

## Oracle Domain 10 — Presenter Performance Analytics

```typescript
{
  id: "PRESENTER_PERFORMANCE_ANALYTICS",
  name: "Presenter Performance & Roster Analytics",
  description: "Tracks per-presenter CTR, retention, and engagement across " +
               "content types. Identifies which presenter/content-type combinations " +
               "are overperforming or underperforming. Generates roster evolution " +
               "recommendations: personality adjustments, content reassignment, " +
               "or roster expansion. Feeds Zeus weekly performance brief.",
  primaryAgent: "ZEUS",
  secondaryAgents: ["REGUM"],
  researchDepth: "STANDARD",
  runFrequency: "WEEKLY",  // runs with Zeus analytics review, not with bi-weekly Oracle runs
  sources: [
    "avatar-profiles DynamoDB table (performance_scores fields)",
    "production-jobs DynamoDB table (per-video presenter assignment)",
    "channel-health DynamoDB table (per-video CTR + retention snapshots)",
    "zeus-briefs DynamoDB table (Zeus weekly performance synthesis)",
  ],
  outputs: [
    "presenter_performance_report: per-presenter score card with trend direction",
    "combination_matrix: presenter × content_type CTR and retention grid",
    "evolution_recommendations: specific trait or assignment changes with evidence",
    "expansion_recommendation: flag if new presenter slot needed (with justification)",
    "rotation_weight_update: new performance_scores for Regum rotation logic",
  ],
  thresholds: {
    // Triggers evolution recommendation
    sustained_underperformance:  "CTR below 60% of channel mean for 10+ videos",
    content_type_mismatch:       "Performance gap > 30% between primary and secondary types",
    // Triggers expansion recommendation
    roster_saturation:           "All presenters averaging < 70% content type fit score for 30 days",
    new_niche_coverage_gap:      "Content type added to channel with no presenter scoring > 50 fit",
    // Triggers rotation weight update (always, every Domain 10 run)
    rotation_weight_recalc:      "Every run — weights fed to Regum for next week's rotation",
  },
}
```

### Oracle Domain 10 — DynamoDB Write Format

```typescript
// Written to oracle-updates table after Domain 10 run
export interface PresenterAnalyticsUpdate {
  updateId:               string;
  domain:                 "PRESENTER_PERFORMANCE_ANALYTICS";
  channelId:              string;
  generatedAt:            string;
  rotationWeights:        Record<string, number>;   // presenterId → new weight
  evolutionRecommendations: EvolutionRecommendation[];
  expansionRecommendation?: ExpansionRecommendation;
  combinationMatrix:      Record<string, Record<string, number>>;  // presenterId → contentType → score
}

export interface EvolutionRecommendation {
  presenterId:            string;
  changeType:             "TRAIT_UPDATE" | "CONTENT_REASSIGNMENT" | "VOICE_UPDATE";
  evidence:               string;           // plain language evidence summary
  specificChange:         string;           // what exactly to change
  expectedImpact:         string;           // predicted outcome
  confidence:             number;           // 0-100 Oracle confidence score
}

export interface ExpansionRecommendation {
  justification:          string;
  suggestedSlotId:        string;           // e.g., "presenter_f4"
  suggestedArchetype:     string;
  coverageGap:            string[];         // content types with no adequate presenter
  urgency:                "IMMEDIATE" | "NEXT_CYCLE" | "MONITOR";
}
```

---

## Lambda — avatar-gen

### Location

```
lambdas/avatar-gen/
  src/handler.ts          — main Lambda handler
  src/flux-runner.ts      — EC2 spot launch + FLUX job coordination
  src/character-builder.ts — Muse brief → character_config.json generation
  src/approval-gate.ts    — human-in-loop gate state management
```

### Handler Events

```typescript
export type AvatarGenEvent =
  | { type: "GENERATE_ROSTER";  channelId: string; characterBriefs: CharacterBrief[] }
  | { type: "GENERATE_ONE";     channelId: string; slotId: string; characterBrief: CharacterBrief }
  | { type: "APPROVE";          channelId: string; presenterId: string; approvedBy: "HUMAN" | "AUTO_TIMEOUT" }
  | { type: "REGENERATE";       channelId: string; presenterId: string }
  | { type: "EDIT_TRAITS";      channelId: string; presenterId: string; traitEdits: Partial<PersonalityProfile> }
  | { type: "APPLY_EVOLUTION";  channelId: string; evolution: EvolutionRecord };
```

### Handler Response

```typescript
export interface AvatarGenResponse {
  success:        boolean;
  channelId:      string;
  presenterId?:   string;
  s3Reference?:   string;       // S3 key of generated portrait
  approvalStatus?: AvatarProfile["approval_status"];
  error?:         string;
}
```

---

## S3 Asset Paths

```
content-factory-assets/
  avatars/
    dynamic/
      {channelId}/
        {presenterId}/
          reference.jpg           — FLUX portrait (permanent, seed-locked)
          character_config.json   — full personality + assignment config
          portrait_preview.jpg    — 512x512 thumbnail for approval gate UI
          generation_metadata.json — seed, prompt, FLUX params (audit trail)
```

---

## Environment Variables

```bash
# FLUX EC2 (portrait generation only)
EC2_FLUX_AMI_ID=                         # g4dn.xlarge AMI with FLUX.1 [dev] FP8
EC2_FLUX_INSTANCE_TYPE=g4dn.xlarge
FLUX_MODEL_PATH=s3://content-factory-assets/models/flux-dev-fp8/

# Shared EC2 config (same as other EC2 instances)
EC2_ROLE_ARN=
EC2_SUBNET_ID=
EC2_SECURITY_GROUP_ID=

# Avatar-gen Lambda
AVATAR_GEN_LAMBDA_ARN=

# Approval gate timeout
AVATAR_APPROVAL_TIMEOUT_HOURS=24
```

---

## Cost Summary

```
Portrait generation (FLUX batch, 4 presenters):
  g4dn.xlarge spot ~$0.16/hr × ~15min = ~$0.04 total
  Fired once at onboarding. Never again unless REGENERATE or expansion.

Per-video avatar cost:
  SkyReels EC2 (g5.12xlarge, ~12min) = ~$0.32
  FLUX: $0.00 (reusing existing reference.jpg)
  character_config.json read: $0.00 (S3 GET)

Presenter analytics (Oracle Domain 10):
  Bedrock Nova Pro synthesis of DynamoDB performance data = ~$0.01/run
  Runs weekly alongside Zeus analytics review.
```

---

## Integration Points Summary

```
MUSE         → Generates CharacterBrief[] during onboarding
               Reads character_config.json to inform expression direction in MuseBlueprint

REGUM        → Selects presenter via rotation logic before every video
               Sets content_assignment during onboarding (strategic fit)
               Updates last_used + use_count in DynamoDB after slot assignment

ZEUS         → Scores presenter performance after every published video
               Applies Oracle Domain 10 evolution recommendations
               Logs high-confidence human approval signals to rrq-memory
               Arbitrates all evolution decisions

ORACLE       → Domain 10: weekly presenter performance analytics
               Generates evolution and expansion recommendations for Zeus

QEON         → Reads character_config.json for assigned presenter
               Passes expression_hints to SkyReels job parameters
               Reports presenter assignment in step logs to Zeus

SKYREELS     → Receives reference.jpg + expression hint per job
               Same face every video. Different expressions per content type.
               No FLUX involvement after onboarding — SkyReels handles all per-video avatar video.

VERA         → Visual QA pass includes presenter segment check
               Flags: face inconsistency (SkyReels drift), expression mismatch, lip-sync errors
```
