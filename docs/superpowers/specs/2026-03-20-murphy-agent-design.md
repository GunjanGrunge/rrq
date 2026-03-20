# Murphy Agent — Conversational Intelligence & Safety Layer
**Date:** 2026-03-20
**Status:** Approved for implementation

---

## What Murphy Is

Murphy is RRQ's conversational safety intelligence agent. Murphy sits between the user and Zeus on every chat message, watching not just the current message but the full conversation arc. Murphy replaces the static regex blocklist from the Zeus guardrail spec entirely.

```
User message
  └── Murphy (lib/murphy/)
        ├── Session window check (last 10–20 messages — live intent detection)
        ├── Pattern memory check (DynamoDB fast lookup + Bedrock KB semantic search)
        ├── Haiku intent classifier (novel phrasing not in pattern memory)
        ├── Conversation arc scorer (is this conversation escalating?)
        └── Verdict: CLEAR | WATCH | ESCALATE_TO_ZEUS | BLOCK_IMMEDIATE
              │
              ├── CLEAR → Zeus responds normally
              ├── WATCH → Zeus responds but Murphy flags session, Zeus is on alert
              ├── ESCALATE_TO_ZEUS → Zeus decides async; current request defaults to WATCH
              └── BLOCK_IMMEDIATE → message blocked, strike logged, user warned
```

Murphy is not a replacement for Zeus. Murphy is Zeus's safety radar — Zeus remains the command authority on all escalation decisions.

---

## Org Chart Position

```
Zeus
  └── Murphy (dotted line — safety radar, not subordinate)
        ├── Rex (topic viability validation for SENSITIVE_TOPIC)
        └── Oracle (pattern approval + Murphy versioning — Domain 15)
```

---

## Model

**Haiku** (`anthropic.claude-haiku-4-5-20251001`) via AWS Bedrock.

Murphy's job is fast classification, not deep reasoning. Haiku runs on every message for novel intent detection. The expensive reasoning (escalation decisions) is done by Zeus (Opus) only when Murphy escalates — asynchronously, not blocking the current request.

Enable prompt caching on Murphy's system prompt — the intent taxonomy, known pattern categories, and escalation rules are large, stable, and cache well.

---

## Core Responsibilities

1. **Live conversation surveillance** — watch every message in real time, flag immediately at any point in the conversation, no delay even if the user pivots to harmful content at message 20
2. **Conversation arc detection** — score the full conversation trajectory, not just the current message. Warn Zeus early if the arc looks like a known escalation pattern
3. **Pattern memory lookup** — DynamoDB fast lookup first, Bedrock KB semantic search if DynamoDB misses
4. **Novel intent learning** — when Haiku catches something pattern memory missed, write the full conversation + flagged message to pattern memory (pending Oracle Domain 15 approval)
5. **Rex validation** — for SENSITIVE_TOPIC verdicts, Murphy calls Rex topic viability check (10s timeout)
6. **Zeus escalation** — Murphy never bans unilaterally on a pattern. Pattern-based suspicion is written to `agent-messages` bus; Zeus evaluates async on next scheduled run. Current request defaults to WATCH.
7. **Version control** — every Murphy pattern addition/change is a versioned event in `agent-version-registry`. Oracle Domain 15 approves all self-learning updates. Zeus approves version activation.
8. **Decision logging** — every Murphy evaluation writes a `DecisionEvent` to `agent-decision-log`. Oracle Domain 14 reads these for version evaluation.

---

## Verdict Types

```typescript
type MurphyVerdict =
  | "CLEAR"              // message is clean, pass to Zeus
  | "WATCH"              // message passed but session is suspicious — Zeus on alert
  | "ESCALATE_TO_ZEUS"   // Murphy has detected a pattern — Zeus decides async, current request = WATCH
  | "BLOCK_IMMEDIATE";   // clearly harmful — block now, log strike, warn user

type MurphyTrigger =
  | "PATTERN_MEMORY_HIT"    // matched known pattern in DynamoDB or KB
  | "HAIKU_NOVEL_INTENT"    // Haiku caught something pattern memory missed
  | "ARC_ESCALATION"        // conversation trajectory matches known escalation arc
  | "SUDDEN_PIVOT"          // user was clean, suddenly injected harmful content
  | "SENSITIVE_TOPIC"       // grey-zone — Rex validation required

interface MurphyResult {
  verdict:          MurphyVerdict;
  trigger?:         MurphyTrigger;
  confidence:       number;          // 0–1
  sensitiveFlag?:   "CRIME_NEWS" | "VIOLENCE_NEWS" | "POLITICAL";
  requiresRex:      boolean;
  arcScore:         number;          // 0–1: how suspicious is the full conversation arc
  zeusAlert?:       string;          // injected into Zeus context if WATCH or ESCALATE
  patternId?:       string;          // matched pattern ID from DynamoDB if PATTERN_MEMORY_HIT
  novelPatternDraft?: NovelPattern;  // populated when Haiku catches something new
  decisionEvent:    MurphyDecisionEvent; // always written to agent-decision-log
}

interface MurphyDecisionEvent {
  agentId:       "murphy";
  agentVersion:  string;             // current active Murphy version from agent-version-registry
  decisionType:  "SAFETY_EVALUATION";
  verdict:       MurphyVerdict;
  trigger?:      MurphyTrigger;
  confidence:    number;
  sessionId:     string;
  patternId?:    string;
  arcScore:      number;
  timestamp:     string;
}
```

---

## Decision Logic — Per Message

Murphy runs this sequence on every message, in order:

```
Step 1 — Input normalisation
  Lowercase + Unicode NFKD + strip zero-width characters (\u200B, \u200C, \u200D, \uFEFF)
  Map common leet substitutions: 3→e, 0→o, 1→i, @→a, $→s

Step 2 — Pattern memory fast lookup (DynamoDB)
  Query murphy-patterns GSI (category-status) for ACTIVE patterns
  Token overlap: if normalised message shares ≥ 60% of a pattern's triggerTokens → candidate
  If candidate AND pattern.arcContext is null:
    confidence ≥ 0.85 AND category = HARMFUL → BLOCK_IMMEDIATE
    confidence ≥ 0.70 AND category = HARMFUL → ESCALATE_TO_ZEUS (async)
    category = SENSITIVE_TOPIC → requiresRex = true
  If candidate AND pattern.arcContext is set:
    Only trigger if current session arc also contains the arcContext terms
    (prevents "make a drone" from triggering without "payload/explosive/crowded" in arc)

Step 3 — Conversation arc scoring
  Load session from murphy-sessions using stable sessionId (UUID from client header x-session-id)
  Compute overallArcScore — see Arc Scoring Formula below
  ArcScore > 0.7 → inject zeusAlert into Zeus context regardless of current message verdict
  ArcScore > 0.85 → ESCALATE_TO_ZEUS even if current message is CLEAR

Step 4 — Sudden pivot detection
  Note: Step 6 (Haiku classifier) runs unconditionally on every message and produces
  `isolatedMessageScore` as part of a shared `MurphyEvalContext` object. Step 4 reads
  this value from the same context — Step 6 is not re-run.
  New session default: if no prior murphy-sessions record exists, sessionBaseline = 0.0
  (SUDDEN_PIVOT detection is correctly dormant on message 1 of a new session).
  Compare isolatedMessageScore (Haiku single-message harm score from Step 6)
  against sessionBaseline arcScore (loaded from murphy-sessions in Step 3, default 0.0)
  If sessionBaseline < 0.3 AND isolatedMessageScore > 0.8:
    trigger = SUDDEN_PIVOT → BLOCK_IMMEDIATE or ESCALATE_TO_ZEUS depending on Haiku confidence

Step 5 — Bedrock KB semantic search (if DynamoDB missed)
  Query murphy-knowledge-base (separate KB from council index — see Infrastructure section)
  Context: current message + last 3 messages from session window
  Returns top-3 semantically similar past flagged conversations
  If top result similarity > 0.80 → treat as PATTERN_MEMORY_HIT (same logic as Step 2)

Step 6 — Haiku novel intent classifier (if KB missed or low confidence)
  Input: normalised message + last 5 messages from session window (conversation context)
  Returns: IntentCategory + confidence + reasoning
  HARMFUL + confidence ≥ 0.85 → BLOCK_IMMEDIATE + write novelPatternDraft
  HARMFUL + confidence 0.60–0.84 → ESCALATE_TO_ZEUS (async) + write novelPatternDraft
  SENSITIVE_TOPIC → requiresRex = true
  OFF_TOPIC_TASK → return inline decline (no Zeus call, no strike)
  VALID → CLEAR

Step 7 — Rex validation (if requiresRex = true)
  Same 10s timeout + 3-tier confidence as Zeus guardrail spec
  HIGH_DEMAND (≥ 0.6) → CLEAR with sensitiveContext passed to Zeus
  MODERATE_DEMAND (0.3–0.59) → WATCH with sensitiveContext
  LOW_DEMAND (< 0.3) → Zeus redirects to better angle
  Rex timeout → CLEAR with sensitiveContext fallback

Step 8 — Write DecisionEvent to agent-decision-log
  Always — regardless of verdict. agentVersion pulled from agent-version-registry at run start.

Step 9 — Update murphy-sessions
  Append current message + per-message harm score to session sliding window (max 20, FIFO)
  Update arcScore in session record
```

---

## Arc Scoring Formula

`overallArcScore` is computed deterministically (no LLM call) from four sub-scores:

```typescript
function computeArcScore(messages: SessionMessage[]): ArcScore {
  const topicDrift          = computeTopicDrift(messages);        // weight: 0.25
  const escalationVelocity  = computeEscalationVelocity(messages); // weight: 0.35
  const sensitiveTermDensity = computeSensitiveTermDensity(messages); // weight: 0.25
  const patternSimilarity   = computePatternSimilarity(messages);  // weight: 0.15

  const overallArcScore =
    topicDrift * 0.25 +
    escalationVelocity * 0.35 +
    sensitiveTermDensity * 0.25 +
    patternSimilarity * 0.15;

  return { topicDrift, escalationVelocity, sensitiveTermDensity, patternSimilarity, overallArcScore };
}
```

### Sub-score definitions

**topicDrift (0–1):**
Compare the first message's normalised token set against the current message's token set.
`topicDrift = 1 - (jaccardSimilarity(firstMessageTokens, currentMessageTokens))`
Higher = conversation has moved further from its starting topic. Computed with simple token overlap (no embedding call needed).

**escalationVelocity (0–1):**
Per-message harm score is stored in the session window (`SessionMessage.harmScore`, set by Haiku Step 6).
`escalationVelocity = (avgHarmScore(last3) - avgHarmScore(first3)) / max(avgHarmScore(first3), 0.01)`
Clamped to [0, 1]. Measures how fast harm scores are rising across the conversation.
**Minimum-message guard:** if `messageCount < 3`, `escalationVelocity = 0.0`. Arc escalation
is dormant until at least 3 messages exist — consistent with the new-session 0.0 default.

**sensitiveTermDensity (0–1):**
Count of ACTIVE murphy-patterns `triggerTokens` appearing across the full session window (all messages combined).
`sensitiveTermDensity = min(matchCount / (messageCount * 2), 1.0)`
Normalised by message count to avoid penalising long conversations.

**patternSimilarity (0–1):**
Lightweight check: does the session's full token corpus overlap with any ACTIVE pattern's triggerTokens?
`patternSimilarity = max(jaccardSimilarity(sessionCorpus, pattern.triggerTokens)) across all ACTIVE patterns`
Only checks DynamoDB patterns (no KB call here — KB used only in Step 5).

---

## Zeus Escalation — Async Model

**ESCALATE_TO_ZEUS does not block the current request.**

When Murphy produces `ESCALATE_TO_ZEUS`:
1. Murphy writes a `SAFETY_ESCALATION` message to `agent-messages` DynamoDB table
2. Current request returns `WATCH` verdict — Zeus responds to the user normally but with `zeusAlert` in context
3. Zeus's next scheduled analytics run (within 6 hours) reads pending `SAFETY_ESCALATION` messages
4. Zeus evaluates: WARN_USER | CONTINUE_MONITORING | RETROACTIVE_BLOCK
5. Zeus writes `ZEUS_ESCALATION_DECISION` back to `agent-messages` with `recipientSessionId`
6. On the user's next message, Murphy reads pending Zeus decisions for this sessionId before running its normal evaluation
7. If Zeus decided RETROACTIVE_BLOCK: Murphy applies the block to the next message and logs the strike

```typescript
// agent-messages payload for SAFETY_ESCALATION
{
  from: "MURPHY",
  to: "ZEUS",
  type: "SAFETY_ESCALATION",
  payload: {
    userId,
    sessionId,
    arcScore,
    trigger,
    conversationSummary: string,  // Haiku-generated 2-sentence summary (async, non-blocking)
    recommendedAction: "WARN" | "BLOCK" | "MONITOR",
    murphyVersion: string,
  }
}
```

**Why async:** Zeus (Opus) is expensive and slow. Murphy cannot hold a user-facing HTTP request open waiting for Opus to reason about an escalation. The WATCH state is safe — Murphy has already determined the message is not immediately harmful (that would be BLOCK_IMMEDIATE). The async loop catches pattern-level threats within the next message.

---

## Conversation Arc Detection — Session Identity

Sessions use a **stable UUID** generated client-side on conversation start and sent as `x-session-id` header. This avoids the midnight rollover problem with date-keyed sessions.

- Session UUID generated once when user opens the Zeus chat UI (stored in React state)
- Sent as `x-session-id` on every message in that conversation
- `murphy-sessions` PK = sessionId (UUID), not userId+date
- 24-hour TTL is still appropriate — after 24 hours of inactivity, the session expires naturally
- New conversation = new UUID = new session (user explicitly starts a new conversation)

---

## Pattern Memory — Self-Learning with Oracle Domain 15

### Two-tier storage

**Tier 1 — DynamoDB `murphy-patterns`** (fast, token-overlap match):
```typescript
interface MurphyPattern {
  patternId:      string;          // UUID
  category:       "HARMFUL" | "SENSITIVE_TOPIC" | "OFF_TOPIC_TASK";
  intentLabel:    string;          // e.g. "drone_weaponisation"
  triggerTokens:  string[];        // normalised token set for fast lookup
  exampleMessage: string;          // original flagged message
  confidence:     number;          // Oracle-set confidence threshold
  arcContext:     string | null;   // null = standalone; else qualifier tokens required in arc
  createdFrom:    "HAIKU_NOVEL" | "ZEUS_MANUAL" | "ORACLE_AUDIT";
  status:         "PENDING_ORACLE" | "ACTIVE" | "REJECTED" | "DEPRECATED";
  version:        string;          // Murphy version when added
  createdAt:      string;
  approvedAt:     string | null;
  approvedBy:     "ORACLE" | null;
}
```

**Tier 2 — murphy-knowledge-base** (semantic, full conversation arc):
- Murphy writes the **full conversation** to S3: `s3://rrq-memory/murphy/flagged-conversations/{patternId}.json`
- `murphy-knowledge-base` Bedrock KB indexes this S3 prefix via Titan embeddings
- Future KB searches match on conversation arc, not just message text

### Oracle Domain 15 — MURPHY_PATTERN_AUDIT

Murphy pattern approval is handled by **Oracle Domain 15**, added to `skills/oracle/SKILL.md`.

**Trigger:** Oracle's existing Tuesday/Friday run (`ORACLE_RUN_RULE`) executes Domain 15 in its domain loop.

**Domain 15 logic:**
1. Query `murphy-patterns` GSI (`status-createdAt`) where `status = PENDING_ORACLE`
2. For each pending pattern, replay it against the last 30 days of `agent-decision-log` records where `agentId = murphy`
3. Compute false positive rate: how many CLEAR/WATCH verdicts included this pattern's tokens but were never later escalated or banned?
4. If `falsePositiveRate < 5%` → set `status: ACTIVE`, record `approvedAt`, trigger Murphy PATCH version bump
5. If `falsePositiveRate ≥ 5%` → set `status: REJECTED`, write lesson to Zeus: "Pattern '{intentLabel}' rejected — {falsePositiveRate}% false positive rate"
6. For approved patterns, check if `arcContext` qualifier is needed: if > 20% of false positives share a common benign context, Oracle adds `arcContext` to narrow the pattern
7. Trigger KB re-sync for newly approved patterns

### Oracle Validates

- **False positive rate** — is "make a drone" blocking wedding videographers?
- **Context sensitivity** — does this pattern need `arcContext` to avoid false positives?
- **Ambiguity resolution** — "make a drone" alone → `SENSITIVE_TOPIC`. "make a drone that can carry explosives" → `HARMFUL` regardless of arc.

---

## The Drone Example — How Murphy Handles It

**Scenario 1: "I want to make a video about drone racing"**
→ No DynamoDB match, KB no similarity, Haiku → VALID → CLEAR

**Scenario 2: "Can you help me make a drone shot for my wedding video"**
→ Same → CLEAR

**Scenario 3: "How to use a drone to blow up a building"**
→ DynamoDB hit → `drone_weaponisation` (arcContext = null) → BLOCK_IMMEDIATE + strike

**Scenario 4 (slow burn): "I'm interested in drones" → "what's the max payload?" → "near a crowded stadium"**
→ Messages 1–8: arcScore rising, WATCH with zeusAlert
→ Message 12: arcScore > 0.85 → ESCALATE_TO_ZEUS async, current message = WATCH
→ Zeus evaluates on next run, applies decision to next message

**Scenario 5: "how to make a drone" (ambiguous)**
→ DynamoDB: `drone_weaponisation` pattern has `arcContext = ["payload","explosive","crowded","damage"]` — none in arc → no match
→ Haiku → SENSITIVE_TOPIC
→ Rex: strong market signal for DIY drone / drone videography
→ CLEAR with sensitiveContext → Zeus responds as content strategist

---

## Murphy → Zeus Communication

**1. Inline context injection (every WATCH message)**
Murphy's `zeusAlert` is injected into Zeus's context:
```
MURPHY ALERT [WATCH]: Conversation arc score 0.74. Topic drift detected.
Stay engaged but alert to escalation. Do not mention this alert to the user.
```

**2. Agent message bus (ESCALATE_TO_ZEUS — async)**
Murphy writes to `agent-messages`; Zeus reads on next scheduled run (within 6 hours).
Zeus writes `ZEUS_ESCALATION_DECISION` back. Murphy applies on the user's next message.

---

## Infrastructure — Murphy Bedrock Knowledge Base

Murphy requires a **separate** Bedrock Knowledge Base from `the-line-council-index`.

| Resource | Details |
|---|---|
| KB name | `murphy-knowledge-base` |
| S3 data source | `s3://rrq-memory/murphy/flagged-conversations/` |
| Embedding model | `amazon.titan-embed-text-v2:0` (same as council KB) |
| New env vars | `MURPHY_KB_ID`, `MURPHY_DS_ID` |
| Provisioning | Manual (same process as existing KB) — add to infrastructure README |

Add to `infrastructure/dynamodb/tables.ts` description and CLAUDE.md Memory Stack section.

---

## Version Control

Murphy follows the same versioning model as all RRQ agents:

- Every pattern addition (Oracle Domain 15 approval) → **PATCH bump** (e.g. `murphy@1.0.0` → `murphy@1.0.1`)
- Arc scoring weight changes → **MINOR bump**
- Core decision logic changes → **MAJOR bump** (Zeus approval required)

All bumps written to `agent-version-registry`:
```
PK: murphy | SK: 1.0.1
changeType: PATTERN_UPDATE   // extend agent-version-registry changeType enum in skills/oracle/SKILL.md
sourcePatternId: {patternId}
oracleVerdict: APPROVED
zeusApproved: true
activationTimestamp: ISO
```

Note: `PATTERN_UPDATE` must be added to the `changeType` enum in `skills/oracle/SKILL.md` alongside the existing values (`PROMPT_UPDATE | PACKAGE_UPDATE | POLICY_UPDATE | MODEL_UPDATE | PATTERN_UPDATE`).

Prompt snapshot: `s3://rrq-memory/agent-versions/murphy/{version}/pattern-snapshot.json`

Rollback = `status: DEPRECATED` on any pattern in `murphy-patterns`. No redeployment.

---

## New DynamoDB Tables

### `murphy-sessions`
| Field | Type | Notes |
|-------|------|-------|
| sessionId (PK) | String | UUID from client x-session-id header — stable across midnight |
| userId | String | Clerk userId |
| messages | List | Last 20 SessionMessage objects (sliding FIFO). Each includes: `{ text, harmScore, timestamp }` |
| arcScore | Number | Current overallArcScore 0–1 |
| watchFlag | Boolean | true if Murphy has flagged this session |
| lastEvaluatedAt | String | ISO timestamp |
| TTL | Number | 24 hours from lastEvaluatedAt |
| GSI: userId-lastEvaluatedAt | — | Murphy reads pending Zeus decisions by userId |

### `murphy-patterns`
| Field | Type | Notes |
|-------|------|-------|
| patternId (PK) | String | UUID |
| category | String | HARMFUL / SENSITIVE_TOPIC / OFF_TOPIC_TASK |
| intentLabel | String | e.g. "drone_weaponisation" |
| triggerTokens | List | normalised token set |
| exampleMessage | String | original flagged message |
| confidence | Number | Oracle-set threshold |
| arcContext | String | null = standalone; else qualifier tokens |
| status | String | PENDING_ORACLE / ACTIVE / REJECTED / DEPRECATED |
| version | String | Murphy version when added |
| createdFrom | String | HAIKU_NOVEL / ZEUS_MANUAL / ORACLE_AUDIT |
| createdAt | String | ISO |
| approvedAt | String | null until Oracle approves |
| GSI: status-createdAt | — | Oracle queries PENDING_ORACLE |
| GSI: category-status | — | Murphy queries ACTIVE patterns by category |

---

## CLAUDE.md Updates Required

- Add `murphy-sessions` and `murphy-patterns` to DynamoDB table list
- Add `MURPHY_KB_ID` and `MURPHY_DS_ID` to Environment Variables section
- Add `skills/murphy/SKILL.md` to the Skill Files table
- Add `murphy-knowledge-base` to Memory Stack → Bedrock Knowledge Base section
- Add `s3://rrq-memory/murphy/` paths to S3 asset paths section
- Add MURPHY as 14th entry to agent roster
- Add `murphy-sessions` and `murphy-patterns` to agent-status table seed

---

## Files to Create

| File | Purpose |
|------|---------|
| `lib/murphy/types.ts` | All interfaces: MurphyResult, MurphyVerdict, MurphyTrigger, MurphyPattern, ArcScore, NovelPattern, MurphyDecisionEvent, SessionMessage |
| `lib/murphy/session.ts` | Load/update murphy-sessions sliding window using x-session-id UUID |
| `lib/murphy/pattern-lookup.ts` | DynamoDB token-overlap lookup + murphy-knowledge-base semantic search |
| `lib/murphy/arc-scorer.ts` | computeArcScore() — topicDrift, escalationVelocity, sensitiveTermDensity, patternSimilarity with defined weights |
| `lib/murphy/haiku-classifier.ts` | Haiku intent classification with 5-message conversation context |
| `lib/murphy/novel-pattern-writer.ts` | Write novelPatternDraft to murphy-patterns (PENDING_ORACLE) + full conversation to S3 |
| `lib/murphy/escalation.ts` | Write SAFETY_ESCALATION to agent-messages; read pending ZEUS_ESCALATION_DECISION on session load |
| `lib/murphy/decision-logger.ts` | Write MurphyDecisionEvent to agent-decision-log on every evaluation |
| `lib/murphy/index.ts` | `runMurphy(message, userId, sessionId)` — orchestrates all 9 steps, returns MurphyResult |
| `skills/murphy/SKILL.md` | Agent skill file |

## Files to Edit

| File | Change |
|------|--------|
| `apps/web/app/api/zeus/chat/route.ts` | Replace regex blocklist with `runMurphy()`. Read x-session-id header. |
| `apps/web/lib/zeus/zeus-agent.ts` | Add IDENTITY LOCK + ARCHITECTURE CONFIDENTIALITY to system prompt |
| `infrastructure/dynamodb/tables.ts` | Add murphy-sessions + murphy-patterns |
| `skills/oracle/SKILL.md` | Add Domain 15: MURPHY_PATTERN_AUDIT |
| `skills/agents/zeus/SKILL.md` | Document Murphy → Zeus escalation flow and ZEUS_ESCALATION_DECISION message type |
| `CLAUDE.md` | All updates listed in CLAUDE.md Updates section above |
| `docs/superpowers/specs/2026-03-20-zeus-input-guardrail-design.md` | Add note: regex blocklist superseded by Murphy |

---

## Agent Status Entry

```typescript
{ agentId: "murphy", humanName: "Murphy", publicTitle: "Safety Intelligence", model: "Haiku" }
```

---

## S3 Paths

```
rrq-memory/
  murphy/
    flagged-conversations/{patternId}.json
    pattern-snapshots/{version}.json
  agent-versions/murphy/{version}/
    pattern-snapshot.json
```

---

## Out of Scope

- Murphy UI dashboard (pattern review, arc visualisation) — deferred to Phase 13
- Murphy cross-user clustering (group banned users by shared intent network) — future phase
- Real-time Murphy alerts to admin (Slack/SES) — deferred to Phase 13
- FingerprintJS Pro upgrade — deferred (free library sufficient for now)
