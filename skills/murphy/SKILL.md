---
name: murphy
description: >
  Murphy is RRQ's conversational safety intelligence agent. Sits between
  the user and Zeus on every chat message, watching conversation arc for
  escalation patterns. Replaces static regex blocklist. Runs on Sonnet 4.6
  via AWS Bedrock. Reports to Zeus (dotted line). Oracle Domain 15 approves
  all pattern updates.
---

# Murphy — Conversational Safety Intelligence Agent

## Model

**Sonnet 4.6** (`anthropic.claude-sonnet-4-5`) via AWS Bedrock.
Prompt caching enabled on system prompt (large, stable, cache well).

## Org Chart

```
Zeus (head)
  └── Murphy (dotted line — safety radar, not subordinate)
        ├── Rex (SENSITIVE_TOPIC viability check)
        └── Oracle Domain 15 (pattern approval + versioning)
```

## Verdict Types

```
CLEAR             → message is clean, pass to Zeus
WATCH             → message passed but session flagged — Zeus on alert
ESCALATE_TO_ZEUS  → pattern detected — Zeus decides async (within 6hrs), current = WATCH
BLOCK_IMMEDIATE   → clearly harmful — block now, increment strike, warn user
```

## 9-Step Decision Logic (per message)

```
Step 1 — Normalise
  lowercase + Unicode NFKD + strip ZWC (\u200B etc) + leet map (3→e, 0→o, 1→i, @→a, $→s)

Step 2 — DynamoDB pattern lookup
  Query murphy-patterns GSI (category-status) for ACTIVE patterns
  Token overlap ≥ 60% → candidate
  If arcContext set → only trigger if session arc contains qualifier tokens

Step 3 — Arc scoring (computeArcScore — deterministic, no LLM)
  topicDrift (0.25) + escalationVelocity (0.35) + sensitiveTermDensity (0.25) + patternSimilarity (0.15)
  arcScore > 0.7  → inject zeusAlert into Zeus context
  arcScore > 0.85 → ESCALATE_TO_ZEUS even if current message is CLEAR

Step 4 — Sudden pivot detection
  Reads isolatedMessageScore from MurphyEvalContext (set by Step 6 — no double-call)
  sessionBaseline < 0.3 AND isolatedMessageScore > 0.8 → BLOCK or ESCALATE

Step 5 — Bedrock KB semantic search (if DynamoDB missed)
  murphy-knowledge-base (separate KB from council index)
  Context: current message + last 3 session messages
  Top result similarity > 0.80 → treat as PATTERN_MEMORY_HIT

Step 6 — Sonnet novel intent classifier (always runs — provides isolatedMessageScore for Step 4)
  Input: normalised message + last 5 session messages
  Returns: IntentCategory + confidence + harmScore + reasoning
  HARMFUL ≥ 0.85     → BLOCK_IMMEDIATE + write novelPatternDraft
  HARMFUL 0.60–0.84  → ESCALATE_TO_ZEUS + write novelPatternDraft
  SENSITIVE_TOPIC    → requiresRex = true
  OFF_TOPIC_TASK     → CLEAR with inline decline (no Zeus call, no strike)
  VALID              → CLEAR

Step 7 — Rex validation (if requiresRex = true)
  10s timeout via Promise.race()
  HIGH_DEMAND (≥ 0.6)      → CLEAR with sensitiveContext
  MODERATE_DEMAND (0.3–0.6) → WATCH with sensitiveContext
  LOW_DEMAND (< 0.3)        → Zeus redirects
  Rex timeout               → CLEAR with sensitiveContext fallback

Step 8 — Write DecisionEvent to agent-decision-log
  Always — regardless of verdict. agentVersion from agent-version-registry.

Step 9 — Update murphy-sessions sliding window
  Append message + harmScore. Max 20 messages, FIFO. 24h TTL.
```

## Arc Scoring Sub-scores

| Sub-score | Weight | Formula |
|---|---|---|
| topicDrift | 0.25 | `1 - jaccard(firstMsgTokens, currentMsgTokens)` |
| escalationVelocity | 0.35 | `(avg(last3harmScores) - avg(first3harmScores)) / max(avg(first3), 0.01)` — clamped [0,1]. 0 if < 3 messages. |
| sensitiveTermDensity | 0.25 | `min(patternTokenHits / (msgCount * 2), 1.0)` |
| patternSimilarity | 0.15 | `max jaccard(sessionCorpus, pattern.triggerTokens)` across all ACTIVE patterns |

## Zeus Escalation — Async Model

**ESCALATE_TO_ZEUS does not block the current request.**

1. Murphy writes `SAFETY_ESCALATION` to `agent-messages`
2. Current request returns WATCH — Zeus responds with `zeusAlert` in context
3. Zeus reads pending escalations on next analytics run (within 6 hours)
4. Zeus decides: `WARN_USER | CONTINUE_MONITORING | RETROACTIVE_BLOCK`
5. Zeus writes `ZEUS_ESCALATION_DECISION` to `agent-messages`
6. Murphy reads Zeus decision on user's next message — applies block if RETROACTIVE_BLOCK

## Pattern Memory

**DynamoDB `murphy-patterns`** (fast, token-overlap):
- `status`: PENDING_ORACLE → ACTIVE (via Oracle Domain 15) or REJECTED
- `arcContext`: null = standalone trigger; set = requires qualifier tokens in arc
- `createdFrom`: HAIKU_NOVEL | ZEUS_MANUAL | ORACLE_AUDIT

**Bedrock `murphy-knowledge-base`** (semantic, full conversation arc):
- S3 source: `s3://rrq-memory/murphy/flagged-conversations/`
- Separate KB from `the-line-council-index`
- Env: `MURPHY_KB_ID`, `MURPHY_DS_ID`

## Version Control

| Change type | Bump |
|---|---|
| Pattern addition (Oracle Domain 15 approved) | PATCH |
| Arc scoring weight changes | MINOR |
| Core decision logic changes | MAJOR (Zeus approval required) |

`changeType: PATTERN_UPDATE` in `agent-version-registry`.
Rollback = set `status: DEPRECATED` on pattern in `murphy-patterns`. No redeployment.

## Session Identity

Sessions use a **stable UUID** generated client-side on conversation start, sent as `x-session-id` header.
`murphy-sessions` PK = sessionId (UUID). 24h TTL. New conversation = new UUID.

## Strike System

| Strike | Action |
|---|---|
| 1st | "You have 2 warnings remaining." |
| 2nd | "Final warning." |
| 3rd | Permanent ban: Clerk `publicMetadata.banned = true` + `banned-devices` write |

Strikes only on BLOCK_IMMEDIATE. OFF_TOPIC_TASK never triggers strike.
Device ban (FingerprintJS) is best-effort deterrent — determined users can evade.

## Key Files

| File | Purpose |
|---|---|
| `lib/murphy/types.ts` | All Murphy types and interfaces |
| `lib/murphy/arc-scorer.ts` | `computeArcScore()` — deterministic arc scoring |
| `lib/murphy/pattern-lookup.ts` | DynamoDB token-overlap + KB semantic search |
| `lib/murphy/session.ts` | Load/update murphy-sessions sliding window |
| `lib/murphy/intent-classifier.ts` | Sonnet intent classification (Step 6) |
| `lib/murphy/novel-pattern-writer.ts` | Write PENDING_ORACLE patterns to DynamoDB + S3 |
| `lib/murphy/escalation.ts` | Write/read SAFETY_ESCALATION on agent-messages bus |
| `lib/murphy/decision-logger.ts` | Write MurphyDecisionEvent to agent-decision-log |
| `lib/murphy/index.ts` | `runMurphy(message, userId, sessionId)` orchestrator |
| `lib/zeus/input-guard/strike-manager.ts` | Strike increment, perma-ban, device fingerprint upsert |
