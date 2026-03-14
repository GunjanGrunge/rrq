---
name: escalation
description: >
  Universal escalation protocol owned by Zeus. Every agent in the RRQ
  system calls this handler when a quality gate or evaluation loop fails
  to converge. No agent implements its own retry logic. Zeus evaluates
  stuck states, makes a judgment call, and — if Zeus cannot resolve it —
  notifies the user with full context and a set of one-click actions.
  Every escalation path has a timeout and an autoDecision that fires
  if the user does not respond. Nothing hangs forever. No video is
  abandoned silently.
---

# Escalation Protocol

## The Problem This Solves

Left to their own devices, agents enter local minima. A quality gate
runs. Score is 0.58. Threshold is 0.65. Agent retries with minor variation.
Score is 0.59. Retries again. Score is 0.57. The loop oscillates. It never
converges. The video never ships. No one is notified. The job quietly
hangs in DynamoDB with status RETRYING.

This is the failure mode the escalation protocol eliminates. The
moment a retry loop stops improving meaningfully — measured precisely
by the isStuck() function — escalation fires. Zeus evaluates. If Zeus
cannot fix it, the user is told exactly what is happening, what was
tried, what Zeus concluded, and what options they have. The user
decides. If the user does not respond within the timeout window,
the autoDecision fires automatically. Nothing hangs.

---

## Zeus Owns This Protocol

Zeus is the single escalation owner across all agents. All agents call
the Zeus escalation handler. They do not implement their own retry
logic, their own notification systems, or their own stuck-detection.
This is deliberate. Divergent retry behavior across agents produces
inconsistent outcomes and makes debugging impossible.

```
ALL agents:     call escalate() — never implement own retry loop
Zeus:           evaluates every stuck state before user is contacted
The Line:       broadcasts all escalation events to Comms stream
User:           contacted only when Zeus cannot resolve alone
autoDecision:   fires on timeout — no job hangs waiting on a human
```

---

## Escalation Policy Table

```typescript
interface EscalationPolicy {
  maxAttempts: number;
  degradedThreshold: number;      // score below this is flagged even if "passing"
  escalateTo: 'ZEUS' | 'HUMAN' | 'ZEUS_THEN_HUMAN';
  notificationChannels: ('EMAIL' | 'IN_APP' | 'BOTH')[];
  timeoutMs: number;              // ms before autoDecision fires; 0 = no timeout
  autoDecision: 'APPROVE' | 'ABORT' | 'SKIP_STEP';
}

const ESCALATION_POLICIES: Record<string, EscalationPolicy> = {

  // Vera domains — all require Zeus review before user is contacted
  VERA_AUDIO_QA: {
    maxAttempts:        2,
    degradedThreshold:  0.60,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,   // 24 hours
    autoDecision:       'ABORT',
  },

  VERA_VISUAL_QA: {
    maxAttempts:        2,
    degradedThreshold:  0.60,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'ABORT',
  },

  VERA_STANDARDS_QA: {
    maxAttempts:        2,
    degradedThreshold:  0.65,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'ABORT',
  },

  // Oracle domain 11 — harmful content detection
  // autoDecision is APPROVE because Oracle errs toward publishing
  // when signal is ambiguous; Zeus reviews and can override
  DOMAIN_11_DETECTION: {
    maxAttempts:        3,
    degradedThreshold:  0.70,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'APPROVE',
  },

  // Quality gate — fails before production spend is committed
  QUALITY_GATE: {
    maxAttempts:        2,
    degradedThreshold:  0.65,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'ABORT',
  },

  // TONY code gen — internal failure, non-blocking on skip
  // Zeus only (no user contact for code gen failures)
  // Skip step = use fallback text card for that beat
  TONY_CODE_GEN: {
    maxAttempts:        3,
    degradedThreshold:  0.50,
    escalateTo:         'ZEUS',
    notificationChannels: ['IN_APP'],
    timeoutMs:          3600000,    // 1 hour
    autoDecision:       'SKIP_STEP',
  },

  // Council deadlock — always requires Zeus + human resolution
  COUNCIL_DEADLOCK: {
    maxAttempts:        1,
    degradedThreshold:  0.00,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'ABORT',
  },

  // Avatar approval — human must see the avatar before it is used
  // autoDecision is APPROVE — if user ignores, pipeline continues
  // (default avatar already approved at onboarding)
  AVATAR_APPROVAL: {
    maxAttempts:        3,
    degradedThreshold:  0.00,
    escalateTo:         'HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          86400000,
    autoDecision:       'APPROVE',
  },

  // Rex confidence score too low to greenlight
  // User decides whether to accept a weak opportunity
  // No Zeus intermediary — this is a strategic call, not a technical one
  CONFIDENCE_SCORE: {
    maxAttempts:        2,
    degradedThreshold:  0.40,
    escalateTo:         'HUMAN',
    notificationChannels: ['IN_APP'],
    timeoutMs:          0,          // no timeout — waits for user
    autoDecision:       'APPROVE',  // approve = skip this candidate, move on
  },

  // SENTINEL infrastructure alert — Autopilot Mode only
  // Haiku retries first, then SNS + in-app if unresolved
  SENTINEL_INFRASTRUCTURE: {
    maxAttempts:        2,
    degradedThreshold:  0.00,   // binary — component either works or doesn't
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['BOTH'],
    timeoutMs:          3600000,   // 1 hour — infra alerts need faster response
    autoDecision:       'ABORT',
  },

  // Sprint council score too low to proceed (Full RRQ pre-production)
  // User decides whether to accept a low-confidence sprint or abort
  SPRINT_COUNCIL_LOW: {
    maxAttempts:        1,   // sprint council runs once — no retry
    degradedThreshold:  0.40,
    escalateTo:         'ZEUS_THEN_HUMAN',
    notificationChannels: ['IN_APP'],
    timeoutMs:          86400000,
    autoDecision:       'ABORT',
  },
};
```

---

## Stuck Detection

The isStuck() function is the entry condition for escalation. It is
called after every retry attempt. If it returns true — escalation fires
immediately regardless of whether maxAttempts has been reached.

```typescript
interface EvaluationAttempt {
  attemptNumber: number;
  score: number;
  failureNotes: string[];
  regeneratedAt: string;
}

function isStuck(attempts: EvaluationAttempt[]): boolean {
  // Need at least 2 data points to detect a pattern
  if (attempts.length < 2) return false;

  const scores = attempts.map(a => a.score);
  const first = scores[0];
  const last = scores[scores.length - 1];
  const improvement = last - first;

  // Improving meaningfully across the attempt history — not stuck
  if (improvement > 0.05) return false;

  // Score is flat or oscillating — stuck
  // Examples: [0.58, 0.59, 0.57] → improvement = -0.01 → stuck
  //           [0.58, 0.62, 0.58] → improvement =  0.00 → stuck
  //           [0.58, 0.64, 0.59] → improvement =  0.01 → stuck
  return true;
}
```

The 0.05 threshold is not arbitrary. A genuine retry that is working
should improve by more than noise. Anything under 0.05 net improvement
across all attempts means the approach is not working and more retries
will not fix it.

---

## Escalation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVALUATION ATTEMPT N                          │
│              score < threshold OR isStuck() = true              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  maxAttempts reached?        │
          │  OR isStuck() = true?        │
          └──────────┬─────────────┬────┘
                     │ YES         │ NO
                     ▼             ▼
          ┌──────────────┐   ┌─────────────────┐
          │  ESCALATE    │   │  RETRY          │
          │  fires now   │   │  with variation │
          └──────┬───────┘   └─────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  escalateTo = 'ZEUS'?                  │
    │  Zeus reads attempt log                │
    │  Makes judgment call                   │
    │  Can approve / abort / patch approach  │
    └───────────┬────────────────────────────┘
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
  Zeus resolves    score still below
  alone            degradedThreshold
  → DECISION       after Zeus patch
                        │
                        ▼
          ┌─────────────────────────────┐
          │  escalateTo includes HUMAN? │
          │  Send user notification     │
          │  Start timeout countdown    │
          └─────────────┬───────────────┘
                        │
            ┌───────────┴──────────────┐
            │                          │
            ▼                          ▼
      User responds           Timeout expires
      → execute choice        → autoDecision fires
            │                          │
            └──────────┬───────────────┘
                       ▼
            ┌──────────────────────┐
            │  ESCALATION DECISION │
            │  logged to DynamoDB  │
            │  Comms broadcast     │
            └──────────────────────┘
```

### Flow Steps in Plain English

```
Step 1    Attempt N exceeds maxAttempts OR isStuck() returns true.

Step 2    Zeus evaluates: reads all attempt logs in full, reads the
          video brief and quality spec, makes a judgment call.
          Zeus may: approve the current output, abort the job,
          or suggest a different approach (resets attempt counter once).

Step 3    If Zeus score is still below degradedThreshold after Zeus
          patch — and escalateTo includes HUMAN — trigger user notification.

Step 4    Notification payload sent to both channels (per policy):
          jobId, videoTitle, stuckAt, attempt count, lastScore,
          threshold, zeusVerdict, user options, expiresAt.

Step 5    User chooses: APPROVE_ANYWAY / ABORT_JOB /
          SKIP_THIS_CHECK / RETRY_WITH_NEW_APPROACH.

Step 6    RETRY_WITH_NEW_APPROACH resets the attempt counter once only.
          If the reset attempt loop also sticks — escalate immediately,
          no second reset granted.

Step 7    On timeout: autoDecision fires. Logged as resolvedBy: 'AUTO'.
          No silent failures — all auto-decisions appear in Comms.
```

---

## TypeScript Interfaces

```typescript
type EscalationGate = keyof typeof ESCALATION_POLICIES;

type UserDecision =
  | 'APPROVE_ANYWAY'
  | 'ABORT_JOB'
  | 'SKIP_THIS_CHECK'
  | 'RETRY_WITH_NEW_APPROACH';

type NotificationChannel = 'EMAIL' | 'IN_APP' | 'BOTH';

type NotificationType =
  | 'AGENT_STUCK'
  | 'JOB_FAILED'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'JOB_COMPLETE'
  | 'ORACLE_FINDING';

type ResolvedBy = 'USER' | 'AUTO' | 'ZEUS';

interface AgentStuckNotification {
  notificationId: string;
  type: NotificationType;
  userId: string;
  jobId: string;
  videoTitle: string;
  stuckAt: EscalationGate;
  attempts: number;
  lastScore: number;
  threshold: number;
  zeusVerdict: string;          // Zeus's plain-English conclusion
  options: UserDecision[];
  expiresAt: string;            // ISO timestamp — when autoDecision fires
  autoDecision: string;         // what happens if user does not respond
  createdAt: string;
  read: boolean;
  resolved: boolean;
  resolvedBy?: ResolvedBy;
  resolvedAt?: string;
  userChoice?: UserDecision;
}

interface EscalationContext {
  userId: string;
  videoTitle: string;
  videoId: string;
  stepContext: Record<string, unknown>;  // whatever the agent knows about the job
}

interface EscalationDecision {
  action: 'APPROVED' | 'ABORTED' | 'SKIPPED' | 'RETRYING';
  resolvedBy: ResolvedBy;
  zeusVerdict: string;
  userChoice?: UserDecision;
  notificationId?: string;
  decidedAt: string;
}

// Context passed to Zeus for evaluation
interface ZeusEscalationBrief {
  gate: EscalationGate;
  jobId: string;
  videoTitle: string;
  attempts: EvaluationAttempt[];
  policy: EscalationPolicy;
  stepContext: Record<string, unknown>;
}

// Zeus's structured response
interface ZeusJudgment {
  verdict: 'APPROVE' | 'ABORT' | 'NEW_APPROACH' | 'ESCALATE_TO_HUMAN';
  reasoning: string;           // plain English — logged and shown in Comms
  newApproachInstruction?: string;  // only when verdict = 'NEW_APPROACH'
  escalateImmediately: boolean;
}
```

---

## Core Escalation Handler

All agents call this function. No agent calls SES, writes to
notifications table, or contacts the user directly.

```typescript
// lib/escalation/escalate.ts

export async function escalate(
  gate: EscalationGate,
  jobId: string,
  attempts: EvaluationAttempt[],
  context: EscalationContext,
): Promise<EscalationDecision> {

  const policy = ESCALATION_POLICIES[gate];

  await broadcastToComms({
    from: 'THE_LINE',
    message: `Escalation triggered at ${gate}. Job: ${jobId}.
              ${attempts.length} attempt(s). Last score: ${
              attempts[attempts.length - 1]?.score ?? 'N/A'}.
              Threshold: ${policy.degradedThreshold}. Calling Zeus.`,
  });

  // Step 1 — Zeus evaluates
  const zeusJudgment = await zeusEvaluate({
    gate, jobId,
    videoTitle: context.videoTitle,
    attempts, policy,
    stepContext: context.stepContext,
  });

  await broadcastToComms({
    from: 'ZEUS',
    message: `Escalation review for ${gate} on "${context.videoTitle}".
              ${zeusJudgment.reasoning}
              Verdict: ${zeusJudgment.verdict}.`,
  });

  // Zeus approves or aborts directly
  if (zeusJudgment.verdict === 'APPROVE') {
    await logEscalationDecision(gate, jobId, 'APPROVED', 'ZEUS', zeusJudgment.reasoning);
    return { action: 'APPROVED', resolvedBy: 'ZEUS',
             zeusVerdict: zeusJudgment.reasoning, decidedAt: new Date().toISOString() };
  }

  if (zeusJudgment.verdict === 'ABORT') {
    await logEscalationDecision(gate, jobId, 'ABORTED', 'ZEUS', zeusJudgment.reasoning);
    return { action: 'ABORTED', resolvedBy: 'ZEUS',
             zeusVerdict: zeusJudgment.reasoning, decidedAt: new Date().toISOString() };
  }

  // Zeus wants to try a new approach — reset counter once
  if (zeusJudgment.verdict === 'NEW_APPROACH' && zeusJudgment.newApproachInstruction) {
    await broadcastToComms({
      from: 'ZEUS',
      message: `New approach for ${gate}: ${zeusJudgment.newApproachInstruction}`,
    });
    return { action: 'RETRYING', resolvedBy: 'ZEUS',
             zeusVerdict: zeusJudgment.reasoning, decidedAt: new Date().toISOString() };
  }

  // Zeus says escalate to human — or policy requires it
  if (
    zeusJudgment.verdict === 'ESCALATE_TO_HUMAN' &&
    (policy.escalateTo === 'ZEUS_THEN_HUMAN' || policy.escalateTo === 'HUMAN')
  ) {
    return notifyUser(gate, jobId, attempts, context, zeusJudgment.reasoning, policy);
  }

  // Fallback — Zeus-only policies that reach here get autoDecision
  return applyAutoDecision(gate, jobId, policy, zeusJudgment.reasoning);
}
```

---

## Zeus Evaluation

```typescript
// lib/escalation/zeus-evaluate.ts

export async function zeusEvaluate(
  brief: ZeusEscalationBrief,
): Promise<ZeusJudgment> {

  const { data } = await bedrockInvoke({
    modelId: 'anthropic.claude-opus-4-5',
    system: `You are Zeus — head of the RRQ content team. An evaluation
             gate has failed to converge after multiple attempts. You are
             the last line before the user is contacted. Review the
             attempt history carefully. If there is a clear path to
             resolution that does not require human input — take it.
             Only escalate to human when the path forward genuinely
             requires a human judgment call.

             Be specific. Name the exact problem. Name the exact
             resolution. Never vague. The Comms stream shows your
             verdict to the user — write it for a human audience.`,
    messages: [{
      role: 'user',
      content: `Gate: ${brief.gate}
                Video: ${brief.videoTitle}
                Job: ${brief.jobId}
                Attempts: ${JSON.stringify(brief.attempts, null, 2)}
                Policy: maxAttempts=${brief.policy.maxAttempts},
                        degradedThreshold=${brief.policy.degradedThreshold}
                Context: ${JSON.stringify(brief.stepContext, null, 2)}

                Return JSON:
                {
                  "verdict": "APPROVE | ABORT | NEW_APPROACH | ESCALATE_TO_HUMAN",
                  "reasoning": "plain English — shown in Comms and notification",
                  "newApproachInstruction": "string or null",
                  "escalateImmediately": boolean
                }`,
    }],
  });

  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim());
}
```

---

## User Notification

```typescript
// lib/escalation/notify-user.ts

async function notifyUser(
  gate: EscalationGate,
  jobId: string,
  attempts: EvaluationAttempt[],
  context: EscalationContext,
  zeusVerdict: string,
  policy: EscalationPolicy,
): Promise<EscalationDecision> {

  const notificationId = generateId();
  const expiresAt = policy.timeoutMs > 0
    ? new Date(Date.now() + policy.timeoutMs).toISOString()
    : '';

  const notification: AgentStuckNotification = {
    notificationId,
    type:         'AGENT_STUCK',
    userId:       context.userId,
    jobId,
    videoTitle:   context.videoTitle,
    stuckAt:      gate,
    attempts:     attempts.length,
    lastScore:    attempts[attempts.length - 1]?.score ?? 0,
    threshold:    policy.degradedThreshold,
    zeusVerdict,
    options:      resolveUserOptions(gate, policy),
    expiresAt,
    autoDecision: policy.autoDecision,
    createdAt:    new Date().toISOString(),
    read:         false,
    resolved:     false,
  };

  // Write to DynamoDB notifications table
  await writeToDynamo('notifications', notification);

  // Broadcast to in-app Comms stream
  await broadcastToComms({
    from: 'THE_LINE',
    message: `User notification sent for ${gate} on "${context.videoTitle}".
              Zeus verdict: ${zeusVerdict}
              Waiting for user decision. Auto-decision in ${
              policy.timeoutMs > 0
                ? Math.round(policy.timeoutMs / 3600000) + ' hours'
                : 'disabled'}: ${policy.autoDecision}.`,
  });

  // Send email if policy requires it
  if (policy.notificationChannels.includes('EMAIL') ||
      policy.notificationChannels.includes('BOTH')) {
    await sendEscalationEmail(notification);
  }

  // Start timeout if configured
  if (policy.timeoutMs > 0) {
    await scheduleAutoDecision(notificationId, jobId, gate, policy, zeusVerdict);
  }

  // Wait for user response via Inngest event
  return waitForUserDecision(notificationId, jobId, gate, policy, zeusVerdict);
}

function resolveUserOptions(
  gate: EscalationGate,
  policy: EscalationPolicy,
): UserDecision[] {
  const base: UserDecision[] = ['ABORT_JOB'];

  if (policy.autoDecision === 'APPROVE') base.push('APPROVE_ANYWAY');
  if (policy.autoDecision === 'SKIP_STEP') base.push('SKIP_THIS_CHECK');

  // TONY code gen failures can be retried with a new approach
  if (gate === 'TONY_CODE_GEN') base.push('RETRY_WITH_NEW_APPROACH');

  // Quality gate and Vera failures can be retried
  if (['QUALITY_GATE', 'VERA_AUDIO_QA',
       'VERA_VISUAL_QA', 'VERA_STANDARDS_QA'].includes(gate)) {
    base.push('RETRY_WITH_NEW_APPROACH');
  }

  return base;
}
```

---

## Auto-Decision Handler

```typescript
// lib/escalation/auto-decide.ts

async function applyAutoDecision(
  gate: EscalationGate,
  jobId: string,
  policy: EscalationPolicy,
  zeusVerdict: string,
): Promise<EscalationDecision> {

  const action = policy.autoDecision === 'APPROVE'    ? 'APPROVED'
               : policy.autoDecision === 'ABORT'      ? 'ABORTED'
               : policy.autoDecision === 'SKIP_STEP'  ? 'SKIPPED'
               : 'ABORTED';  // safe default

  await logEscalationDecision(gate, jobId, action, 'AUTO', zeusVerdict);

  await broadcastToComms({
    from: 'THE_LINE',
    message: `Timeout reached for ${gate} on job ${jobId}.
              Auto-decision fired: ${policy.autoDecision}.
              ${zeusVerdict}`,
  });

  // Mark notification as auto-resolved in DynamoDB
  await updateNotification(gate, jobId, {
    resolved: true,
    resolvedBy: 'AUTO',
    resolvedAt: new Date().toISOString(),
  });

  return {
    action,
    resolvedBy:  'AUTO',
    zeusVerdict,
    decidedAt:   new Date().toISOString(),
  };
}
```

---

## Notification System

Two channels. Neither is optional — the policy table controls which
fires per gate type.

### Channel 1 — In-App (DynamoDB + Inngest)

Every notification written to DynamoDB fires an Inngest event. The
Mission Control frontend subscribes via useInngestSubscription. The
notification bell shows count of unresolved notifications. Clicking
opens the notification panel with the full escalation context and
one-click action buttons.

Action buttons are signed — each maps to a specific notificationId
and jobId, preventing replay or spoofing.

```
Notification panel shows per notification:
  Video title
  Which gate failed
  How many attempts were made and at what scores
  Zeus's conclusion in plain English
  Remaining time before auto-decision
  Action buttons: APPROVE ANYWAY / ABORT JOB / SKIP CHECK / RETRY NEW APPROACH
  (buttons shown are determined by resolveUserOptions() for that gate)
```

### Channel 2 — Email (AWS SES)

Transactional email from `notifications@[domain]`. Not marketing.
Contains the same information as the in-app panel plus a single
prominent action link. The link contains a signed token that maps
to the notificationId — clicking it opens Mission Control at the
notification panel and marks the notification read.

Email is not sent for every notification type. TONY code gen failures
are in-app only — user does not need to be emailed for a code
generation retry. Vera failures and council deadlocks always trigger
both channels.

```
Notification priority → channel routing:

AGENT_STUCK               BOTH (per policy table)
JOB_FAILED                BOTH
HUMAN_APPROVAL_REQUIRED   BOTH
JOB_COMPLETE              IN_APP only
ORACLE_FINDING            IN_APP only
```

---

## DynamoDB Table: notifications

```
PK:  userId
SK:  notificationId
GSI: jobId (query all notifications for a job — incident timeline)
TTL: 30 days (auto-expire resolved notifications)

fields:
  notificationId, userId, jobId
  type               AGENT_STUCK | JOB_FAILED | HUMAN_APPROVAL_REQUIRED |
                     JOB_COMPLETE | ORACLE_FINDING
  videoTitle
  stuckAt            EscalationGate key
  attempts           number of attempts made
  lastScore          float
  threshold          policy degradedThreshold
  zeusVerdict        Zeus plain-English conclusion
  options[]          which UserDecision values user can pick
  expiresAt          ISO timestamp — when autoDecision fires
  autoDecision       string — what fires if user does not respond
  createdAt
  read               boolean — toggled when user opens notification
  resolved           boolean
  resolvedBy         USER | AUTO | ZEUS
  resolvedAt         ISO timestamp
  userChoice         the UserDecision the user selected (if resolvedBy = USER)
```

---

## Inngest Step Integration

Each evaluation gate is its own step.run() call. Escalation fires as
a separate named step. This makes every state transition visible in
the Inngest dashboard. Jobs never disappear into an invisible retry loop.

```typescript
// Correct pattern — each retry is a visible step

const attempt1 = await step.run('vera-audio-qa-attempt-1', async () => {
  return runAudioQA(job);
});

if (!attempt1.passed && attempts.length >= policy.maxAttempts || isStuck(attempts)) {
  const decision = await step.run('vera-audio-qa-escalate', async () => {
    return escalate('VERA_AUDIO_QA', job.jobId, attempts, context);
  });
  return handleEscalationDecision(decision, job);
}

const attempt2 = await step.run('vera-audio-qa-attempt-2', async () => {
  return runAudioQA(job);
});

// Never put retry logic inside a single step.run() —
// always surface each attempt as a new named step
```

This pattern means every attempt appears in the Inngest timeline.
A job that is stuck shows clearly: attempt-1, attempt-2, escalation-fired.
Not a black box.

---

## Comms Stream Messages

Escalation events are always broadcast to the Comms stream so the
user sees what is happening in real time even before the formal
notification arrives.

```
Example escalation thread in Comms:

14:22  THE LINE    Escalation triggered at VERA_AUDIO_QA for "Claude 4 vs
                   GPT-5". 2 attempts. Last score: 0.57. Threshold: 0.60.
                   Calling Zeus.

14:22  Marcus      Reviewing audio QA failure on "Claude 4 vs GPT-5".
       (Zeus)      Both attempts failed the PIVOT cue at 3:22. Score did
                   not improve between attempts. This is an ElevenLabs
                   rendering issue with the PIVOT marker — not a script
                   problem. Re-render with WARM cue substituted at that
                   timestamp. If this attempt also fails — escalate to user.
                   Verdict: NEW_APPROACH.

14:22  THE LINE    Zeus approach: substitute WARM cue at 3:22. Attempt 3
                   queued.

14:31  THE LINE    Attempt 3 complete. Score: 0.63. Threshold: 0.60. Passed.
                   Escalation resolved by Zeus. No user contact required.
                   Continuing to visual QA.

---

14:22  THE LINE    Escalation triggered at COUNCIL_DEADLOCK for "Crypto
                   Regulation Explained". REX and REGUM in conflict.
                   Calling Zeus.

14:23  Marcus      Deadlock on "Crypto Regulation Explained". Rex rejects:
       (Zeus)      window is closing fast, 3 days max. Regum rejects:
                   editorial uniqueness insufficient, major competitor
                   published this angle 48 hours ago. Both concerns are
                   valid and they do not resolve each other. Escalating
                   to user for strategic call.
                   Verdict: ESCALATE_TO_HUMAN.

14:23  THE LINE    User notified via in-app and email. Waiting for decision.
                   Auto-abort in 24 hours if no response.

15:41  THE LINE    User decision received: ABORT_JOB. Job cancelled.
                   Council record preserved. Next candidate promoted.
```

---

## Notification Email Templates

### AGENT_STUCK / JOB_FAILED

```
Subject: Action required — [videoTitle] needs your input

Your video "[videoTitle]" has hit a quality gate that the system
cannot resolve automatically.

WHAT HAPPENED
[stuckAt] failed after [attempts] attempt(s).
Last score: [lastScore] (threshold: [threshold]).

ZEUS REVIEWED THIS
[zeusVerdict]

YOUR OPTIONS
[APPROVE ANYWAY]   Publish with current output
[ABORT JOB]        Cancel this video
[SKIP THIS CHECK]  Skip this gate and continue
[RETRY NEW APPROACH]  Let the system try a different method

This decision expires in [expiresIn].
If no action is taken: [autoDecision] fires automatically.

→ Review and decide in Mission Control
[OPEN MISSION CONTROL button → signed URL]
```

### HUMAN_APPROVAL_REQUIRED (Avatar)

```
Subject: Your avatar is ready for review — [videoTitle]

A new avatar has been generated for "[videoTitle]".
Review and approve before production continues.

→ Review avatar in Mission Control
[OPEN MISSION CONTROL button → signed URL]

If no action is taken within 24 hours: the default approved avatar
will be used and production will continue automatically.
```

### JOB_COMPLETE

```
In-app only. No email.

[videoTitle] has been published to YouTube.
View performance → [link]
```

### ORACLE_FINDING

```
In-app only. No email.

Oracle has completed a [domain] research update.
New learnings have been injected into agent knowledge.
View finding → [link]
```

---

## Checklist

```
[ ] lib/escalation/escalate.ts          core escalation handler
[ ] lib/escalation/policies.ts          ESCALATION_POLICIES table
[ ] lib/escalation/is-stuck.ts          isStuck() function
[ ] lib/escalation/zeus-evaluate.ts     Zeus Bedrock call + judgment
[ ] lib/escalation/notify-user.ts       DynamoDB write + channel routing
[ ] lib/escalation/auto-decide.ts       timeout handler + auto-decision
[ ] lib/escalation/send-email.ts        SES transactional email
[ ] lib/escalation/log-decision.ts      DynamoDB escalation audit log
[ ] DynamoDB table: notifications       full schema above
[ ] Wire VERA domains → escalate()      replace ad-hoc retry logic
[ ] Wire QUALITY_GATE → escalate()      replace ad-hoc retry logic
[ ] Wire TONY_CODE_GEN → escalate()     replace ad-hoc retry logic
[ ] Wire COUNCIL_DEADLOCK → escalate()  replace deadlock handler
[ ] Wire AVATAR_APPROVAL → escalate()   new gate
[ ] Wire CONFIDENCE_SCORE → escalate()         new gate (Rex)
[ ] Wire SENTINEL_INFRASTRUCTURE → escalate()  new gate (Autopilot Mode)
[ ] Wire SPRINT_COUNCIL_LOW → escalate()       new gate (Full RRQ pre-production)
[ ] Inngest step pattern enforced       all attempts as named steps
[ ] Comms broadcast on every event      all escalation events visible
[ ] Notification bell in Mission Control header (unread count badge)
[ ] Notification panel with action buttons
[ ] Signed URL generation for email action links
[ ] Auto-decision Inngest scheduled step (fires on expiresAt)
[ ] Test VERA_AUDIO_QA stuck → Zeus resolves alone
[ ] Test VERA_AUDIO_QA stuck → Zeus cannot resolve → user notified
[ ] Test user APPROVE_ANYWAY → pipeline continues
[ ] Test user ABORT_JOB → job cancelled, DynamoDB updated
[ ] Test user RETRY_WITH_NEW_APPROACH → attempt counter reset once
[ ] Test timeout → autoDecision fires → logged as AUTO
[ ] Test TONY_CODE_GEN → Zeus only, no email, SKIP_STEP on timeout
[ ] Test COUNCIL_DEADLOCK → both channels, user always contacted
[ ] Test isStuck() — oscillating scores detected correctly
[ ] Test isStuck() — genuine improvement not flagged as stuck
[ ] Verify no agent implements own retry loop outside escalate()
[ ] Test SENTINEL_INFRASTRUCTURE → SNS fires in addition to EMAIL + IN_APP
[ ] Test SPRINT_COUNCIL_LOW → no retry, user notified, auto-abort on timeout
```

---

## Autonomous Mode vs Manual Mode Escalation

The escalation protocol applies universally. However, notification
behaviour differs by mode:

STUDIO MODE (Manual Pipeline):
  All gates active.
  User is watching — in-app notification is sufficient for most gates.
  EMAIL only for COUNCIL_DEADLOCK and JOB_FAILED.

REX MODE (Rex-Assisted Manual):
  All gates active.
  User triggered the job — same as Studio Mode.
  SENTINEL does NOT activate (user is present).

AUTOPILOT MODE (Full RRQ):
  All gates active.
  SENTINEL activates — monitors infrastructure in real time.
  EMAIL + IN_APP for ALL stuck gates (user may not be watching).
  AWS SNS added as third channel for SENTINEL_INFRASTRUCTURE HIGH severity.
  SNS fires in addition to EMAIL + IN_APP — not instead of.
