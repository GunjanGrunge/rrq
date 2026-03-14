---
name: sentinel
description: >
  SENTINEL is RRQ's infrastructure monitoring agent. It only activates in
  Full Autopilot Mode (GO RRQ). Manual Mode and Rex-Assisted Manual Mode
  use the standard escalation protocol (skills/escalation/SKILL.md) because
  a human is watching. When the system runs fully autonomous — no human in
  the loop — SENTINEL watches every layer of infrastructure, catches failures
  before they cascade, and attempts LLM-guided recovery before any human is
  contacted. If recovery fails, SENTINEL fires AWS SNS (SMS) and writes an
  in-app notification. All SENTINEL activity is summarised in Zeus's morning
  brief. SENTINEL never makes editorial decisions. It monitors, retries, and
  escalates. Nothing more.
---

# SENTINEL — Infrastructure Monitoring Agent

## Role

```
Human name:   SENTINEL
Model:        Haiku 4.5  (fast retry strategy generation — cost-sensitive, runs constantly)
Activates:    Full Autopilot Mode (GO RRQ) ONLY
Deactivates:  Manual Mode, Rex-Assisted Manual Mode (user is watching — standard escalation handles it)
Reports to:   Zeus (morning brief summary)
Escalates to: AWS SNS SMS → user in-app notification → Zeus morning brief
```

SENTINEL does not create content. It does not make scheduling decisions.
It does not interact with Rex, Regum, or the council. It watches the
infrastructure substrate that all those agents run on — and keeps it alive.

---

## Activation Condition

```
channelMode determines whether SENTINEL is active:

  AUTOPILOT     → SENTINEL ACTIVE
  MANUAL        → SENTINEL INACTIVE  (standard escalation handles failures)
  REX_MANUAL    → SENTINEL INACTIVE  (standard escalation handles failures)
```

```typescript
// lib/sentinel/should-activate.ts

export async function sentinelShouldActivate(userId: string): Promise<boolean> {
  const settings = await getDynamoItem('channel-settings', { userId });
  return settings?.channelMode === 'AUTOPILOT';
}
```

In Manual and Rex-Assisted Manual modes the user is present. The standard
escalation protocol (Zeus → SES email + in-app) is the correct path.
SENTINEL's SMS alerting is reserved for the times when no human is watching
and a failure would otherwise go unnoticed until a scheduled review.

---

## What SENTINEL Monitors

```
Component              Failure Signal                              Severity
─────────────────────────────────────────────────────────────────────────────
Lambda workers         Invocation error / timeout / OOM           HIGH
  audio-gen            ElevenLabs HTTP 4xx/5xx, Edge-TTS fallback fail
  research-visual      Puppeteer crash, Chromium cold start fail
  visual-gen           Chart.js render error, Mermaid parse fail
  av-sync              FFmpeg non-zero exit, S3 write fail
  shorts-gen           Haiku call fail, FFmpeg non-zero exit
  uploader             YouTube API 403/429/5xx, OAuth token expired
  code-agent (TONY)    Sandbox SIGKILL, Haiku code-gen fail, S3 write fail

EC2 instances          Instance hang / crash / spot termination    HIGH
  avatar-gen           g5.12xlarge SkyReels — no heartbeat > 15 min
  broll-gen            g5.2xlarge Wan2.2 — no heartbeat > 15 min
  portrait-gen         g4dn.xlarge FLUX — no heartbeat > 10 min

Inngest workflows      Step failure / event not received           MEDIUM
  createVideoWorkflow  step.run() error logged to CloudWatch
  rexScanWorkflow      scan did not complete within 20 min
  regumWorkflow        no QeonBrief written within 30 min of greenlight
  qeonWorkflow         job stalled in same step > 20 min

DynamoDB               Write failure / throttling                  MEDIUM
  production-jobs      job state update failed
  pipeline-state       user session state write failed
  rex-watchlist        watchlist update failed

ElevenLabs quota       All 4 accounts near or at 40k char limit    HIGH
                       (triggers Edge-TTS fallback notification)

S3                     Upload failure, presigned URL expiry         HIGH
  final_youtube.mp4    av-sync output not found within expected window
  voiceover.mp3        audio-gen output missing from job path
```

---

## Observability Stack

### Current: SignOz (Open Source)

SignOz is the primary observability layer. Self-hosted. No third-party SaaS
dependency. All Lambda workers ship logs to the SignOz collector endpoint.
EC2 instances run the OpenTelemetry agent and stream metrics to SignOz.

```
Architecture:

  Lambda workers  ──logs──▶  CloudWatch Logs
  EC2 instances   ──logs──▶  CloudWatch Logs
  CloudWatch Logs ──sub──▶   SENTINEL Forwarder Lambda
                              (reads log groups, forwards to SignOz)
  SignOz Collector ◀── OTEL ── SENTINEL Forwarder
  SignOz UI       ──dashboards, alerts, traces──▶  ops team
```

#### SignOz Setup

```typescript
// lib/sentinel/signoz-client.ts

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'rrq-content-factory',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
    process.env.NODE_ENV ?? 'production',
});

export const logExporter = new OTLPLogExporter({
  url: `${process.env.SIGNOZ_ENDPOINT}/v1/logs`,
  headers: {
    'signoz-access-token': process.env.SIGNOZ_API_KEY ?? '',
  },
});

export const metricExporter = new OTLPMetricExporter({
  url: `${process.env.SIGNOZ_ENDPOINT}/v1/metrics`,
  headers: {
    'signoz-access-token': process.env.SIGNOZ_API_KEY ?? '',
  },
});

// All Lambda workers import this and call shipLog() on errors
export async function shipLog(entry: SentinelLogEntry): Promise<void> {
  // Format as OTLP LogRecord and export to SignOz collector
  await logExporter.export([toOtlpLogRecord(entry, resource)], () => {});
}
```

#### Log Ingestion — Lambda Workers

Every Lambda worker already wraps its handler in try/catch and logs to
CloudWatch. Add one line in the catch block to also call `shipLog()`:

```typescript
// Pattern in every Lambda worker:

import { shipLog } from '../../lib/sentinel/signoz-client';

} catch (err) {
  const entry: SentinelLogEntry = {
    component:   'audio-gen',
    jobId:       event.jobId,
    severity:    'HIGH',
    message:     (err as Error).message,
    errorCode:   (err as NodeJS.ErrnoException).code,
    timestamp:   new Date().toISOString(),
  };
  await shipLog(entry);
  throw err;  // still rethrow — Lambda error handling unchanged
}
```

#### Metric Collection — EC2 Heartbeat

Each EC2 instance writes a heartbeat record to DynamoDB every 60 seconds
during job execution. SENTINEL's polling loop checks for heartbeat age.
If the last heartbeat is older than the threshold, the instance is treated
as hung and SENTINEL fires the retry strategy.

```typescript
// EC2 UserData bootstrap — writes heartbeat loop:

setInterval(async () => {
  await dynamoClient.put({
    TableName: 'ec2-heartbeats',
    Item: {
      instanceId: process.env.INSTANCE_ID,
      jobId:      process.env.JOB_ID,
      component:  process.env.COMPONENT,  // 'avatar-gen' | 'broll-gen' | 'portrait-gen'
      lastSeen:   new Date().toISOString(),
      ttl:        Math.floor(Date.now() / 1000) + 3600,  // auto-expire after 1hr
    },
  }).promise();
}, 60_000);
```

#### SignOz Dashboards

Provision these dashboards at setup time (import JSON configs stored in
`infrastructure/signoz/dashboards/`):

```
dashboard: rrq-lambda-health
  panels:
    - Lambda error rate per worker (5-min rolling)
    - Lambda P95 duration per worker
    - Lambda throttle count

dashboard: rrq-ec2-health
  panels:
    - Heartbeat age per instance
    - GPU memory utilization (NVIDIA SMI metric forwarded via OTel)
    - Spot interruption events

dashboard: rrq-pipeline-health
  panels:
    - Active Inngest workflow count
    - Step failure rate
    - DynamoDB write error rate
    - ElevenLabs quota remaining per account

dashboard: rrq-sentinel-alerts
  panels:
    - Open alerts by severity
    - Alert resolution time distribution
    - SNS messages sent (last 7 days)
    - Retry success rate
```

### Upgrade Path: Datadog

SignOz uses the OpenTelemetry Protocol (OTLP) standard. Datadog also accepts
OTLP. Migration requires only endpoint + auth changes — no Lambda code
changes. When volume warrants Datadog's APM and anomaly detection:

```
1. Provision Datadog account + OTLP ingest endpoint
2. Rotate SIGNOZ_ENDPOINT → Datadog OTLP endpoint in Secrets Manager
3. Rotate SIGNOZ_API_KEY  → Datadog API key in Secrets Manager
4. Redeploy Lambda workers (environment variable pick-up, no code change)
5. Decommission SignOz EC2 instance
6. Recreate dashboards in Datadog (JSON export from SignOz helps)
```

No Lambda worker code changes required. The `shipLog()` abstraction
intentionally hides the backend — the exporter implementation swaps,
the call site does not.

---

## Retry Logic

When SENTINEL detects a failure, it attempts LLM-guided recovery before
escalating to any human channel. This is the critical distinction between
SENTINEL and the standard escalation protocol. In Autopilot Mode, waking
a human should be the last resort, not the first.

```
FAILURE DETECTED
     │
     ▼
Haiku generates retry strategy
(what went wrong, how to recover, what to avoid)
     │
     ▼
Execute retry strategy (once)
     │
     ├── SUCCESS ──▶  Log to sentinel-alerts (resolved=true)
     │                 Include in Zeus morning brief
     │
     └── FAILURE ──▶  ESCALATE
                       SNS SMS to user phone
                       In-app notification
                       Include in Zeus morning brief
```

### Retry Strategy Generation (Haiku)

```typescript
// lib/sentinel/generate-retry-strategy.ts

export async function generateRetryStrategy(
  alert: SentinelAlert,
): Promise<SentinelRetryStrategy> {

  const { data } = await bedrockInvoke({
    modelId: 'anthropic.claude-haiku-4-5-20251001',
    system: `You are SENTINEL, the infrastructure monitoring agent for an
             autonomous YouTube content factory. A component has failed.
             Generate a precise, actionable retry strategy. You are a
             technical infrastructure agent — not a content agent. You
             understand Lambda workers, EC2 spot instances, DynamoDB writes,
             ElevenLabs API rotation, and FFmpeg. Output JSON only.`,
    messages: [{
      role: 'user',
      content: `Component: ${alert.component}
                Failure type: ${alert.type}
                Severity: ${alert.severity}
                Error message: ${alert.message}
                Job ID: ${alert.jobId}
                Retry attempts so far: ${alert.retryAttempts}
                Context: ${JSON.stringify(alert.context ?? {})}

                Return JSON:
                {
                  "rootCauseHypothesis": "one sentence",
                  "retryAction": "RESTART_LAMBDA | RELAUNCH_EC2 | ROTATE_ACCOUNT | RETRY_S3_WRITE | SKIP_STEP | ABORT_JOB",
                  "retryParameters": { /* action-specific params */ },
                  "rationale": "plain English — logged for Zeus review",
                  "fallbackIfRetryFails": "plain English — what SENTINEL does if this retry also fails"
                }`,
    }],
  });

  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim());
}
```

### Retry Action Handlers

```typescript
// lib/sentinel/execute-retry.ts

type RetryAction =
  | 'RESTART_LAMBDA'
  | 'RELAUNCH_EC2'
  | 'ROTATE_ACCOUNT'
  | 'RETRY_S3_WRITE'
  | 'SKIP_STEP'
  | 'ABORT_JOB';

export async function executeRetry(
  alert: SentinelAlert,
  strategy: SentinelRetryStrategy,
): Promise<RetryOutcome> {

  switch (strategy.retryAction) {

    case 'RESTART_LAMBDA':
      // Re-invoke the Lambda function with the same event payload
      // (idempotent by design — jobId deduplicates DynamoDB writes)
      return retryLambdaInvocation(alert.component, alert.jobId, strategy.retryParameters);

    case 'RELAUNCH_EC2':
      // Terminate the hung instance and launch a fresh spot instance
      // Job picks up from last DynamoDB checkpoint
      return relaunchEc2Instance(alert.component, alert.jobId, strategy.retryParameters);

    case 'ROTATE_ACCOUNT':
      // ElevenLabs quota exhausted — rotate to next account in rotation
      // Update elevenlabs-usage DynamoDB table, re-invoke audio-gen
      return rotateElevenLabsAccount(alert.jobId, strategy.retryParameters);

    case 'RETRY_S3_WRITE':
      // Transient S3 error — re-attempt the specific upload
      return retryS3Upload(alert.jobId, strategy.retryParameters);

    case 'SKIP_STEP':
      // Non-critical step — mark as SKIPPED in production-jobs, continue pipeline
      // Only valid for: research-visual, portrait-gen
      return skipStep(alert.component, alert.jobId, strategy.retryParameters);

    case 'ABORT_JOB':
      // Unrecoverable — mark job FAILED, fire full escalation
      return abortJob(alert.jobId, strategy.rationale);
  }
}
```

---

## Escalation Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FAILURE DETECTED                               │
│           (Lambda error / EC2 hang / Inngest stall /                 │
│            DynamoDB fail / ElevenLabs quota / S3 fail)               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  Write sentinel-alerts  │
                 │  (status: OPEN)         │
                 │  Ship log to SignOz     │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  Haiku generates        │
                 │  retry strategy         │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  Execute retry          │
                 │  (once)                 │
                 └────────────┬────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
        Retry succeeds               Retry fails
               │                             │
               ▼                             ▼
    Update sentinel-alerts      ┌────────────────────────┐
    resolved=true               │  Severity HIGH?        │
    Log to Zeus morning brief   └─────────┬──────────────┘
                                          │
                               ┌──────────┴──────────┐
                               │ YES                 │ MEDIUM
                               ▼                     ▼
                    ┌─────────────────┐   Update sentinel-alerts
                    │  SNS SMS        │   (snsSent=false, in-app only)
                    │  to user phone  │   Log to Zeus morning brief
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  In-app         │
                    │  notification   │
                    │  (notifications │
                    │   DynamoDB)     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Zeus morning   │
                    │  brief includes │
                    │  SENTINEL       │
                    │  alert summary  │
                    └─────────────────┘
```

### Escalation Rules

```
Severity HIGH  → SNS SMS + in-app notification + Zeus morning brief
Severity MEDIUM → in-app notification + Zeus morning brief (no SMS)

SNS fires only when:
  - retryAttempts >= 1 (one retry already tried and failed)
  - severity = HIGH
  - channelMode = AUTOPILOT (confirmed active before every SNS send)

SNS never fires for:
  - First occurrence of any failure (always try retry first)
  - MEDIUM severity alerts
  - Failures in Manual or Rex-Assisted Manual mode
  - SKIP_STEP or ABORT_JOB retry actions (in-app only — these are expected terminal states)
```

---

## TypeScript Interfaces

```typescript
// lib/sentinel/types.ts

type SentinelAlertType =
  | 'LAMBDA_ERROR'
  | 'LAMBDA_TIMEOUT'
  | 'LAMBDA_OOM'
  | 'EC2_HANG'
  | 'EC2_SPOT_TERMINATION'
  | 'EC2_NO_HEARTBEAT'
  | 'INNGEST_STEP_FAILURE'
  | 'INNGEST_STALL'
  | 'DYNAMO_WRITE_FAILURE'
  | 'DYNAMO_THROTTLE'
  | 'ELEVENLABS_QUOTA_EXHAUSTED'
  | 'S3_UPLOAD_FAILURE'
  | 'S3_ASSET_MISSING';

type SentinelSeverity = 'HIGH' | 'MEDIUM';

type SentinelComponent =
  | 'audio-gen'
  | 'research-visual'
  | 'visual-gen'
  | 'av-sync'
  | 'shorts-gen'
  | 'uploader'
  | 'code-agent'
  | 'avatar-gen-ec2'
  | 'broll-gen-ec2'
  | 'portrait-gen-ec2'
  | 'inngest-createVideoWorkflow'
  | 'inngest-rexScanWorkflow'
  | 'inngest-regumWorkflow'
  | 'inngest-qeonWorkflow'
  | 'dynamo-production-jobs'
  | 'dynamo-pipeline-state'
  | 's3-content-factory-assets';

type SentinelAlertStatus = 'OPEN' | 'RETRYING' | 'RESOLVED' | 'ESCALATED';

interface SentinelAlert {
  alertId:       string;        // ulid
  channelId:     string;        // PK — maps to user's channel
  component:     SentinelComponent;
  type:          SentinelAlertType;
  severity:      SentinelSeverity;
  message:       string;        // raw error message or CloudWatch log excerpt
  jobId?:        string;        // present when alert is tied to a specific job
  retryAttempts: number;        // how many retry strategies have been tried
  status:        SentinelAlertStatus;
  resolved:      boolean;
  resolvedAt?:   string;        // ISO timestamp
  snsSent:       boolean;       // whether SNS SMS was fired for this alert
  createdAt:     string;        // ISO timestamp
  context?:      Record<string, unknown>;  // component-specific extra data
}

interface SentinelRetryStrategy {
  rootCauseHypothesis: string;
  retryAction:         RetryAction;
  retryParameters:     Record<string, unknown>;
  rationale:           string;   // plain English — logged and shown in Zeus brief
  fallbackIfRetryFails: string;
}

type RetryOutcome = 'SUCCEEDED' | 'FAILED';

interface SentinelEscalation {
  alertId:       string;
  channelId:     string;
  component:     SentinelComponent;
  severity:      SentinelSeverity;
  message:       string;
  jobId?:        string;
  retryStrategy: SentinelRetryStrategy;
  snsSentAt?:    string;         // ISO timestamp — when SMS was fired
  inAppSentAt?:  string;         // ISO timestamp — when notification was written
  includedInZeusBriefAt?: string;
}

// Included in Zeus's morning brief payload
interface SentinelBriefSummary {
  totalAlertsLast24h:     number;
  resolvedByRetry:        number;
  escalatedToUser:        number;
  snsSentCount:           number;
  openAlerts:             SentinelAlert[];       // unresolved alerts right now
  recentResolutions:      SentinelAlert[];       // resolved in last 24h
  componentHealthSummary: Record<SentinelComponent, 'HEALTHY' | 'DEGRADED' | 'DOWN'>;
}
```

---

## Core Monitoring Loop

SENTINEL runs as an Inngest scheduled function, polling every 2 minutes in
Autopilot Mode. Each poll checks all monitored components and fires the
retry → escalation chain for any new failures.

```typescript
// inngest/functions/sentinel-monitor.ts

export const sentinelMonitor = inngest.createFunction(
  {
    id: 'sentinel-monitor',
    name: 'SENTINEL Infrastructure Monitor',
    // Only fires when Autopilot Mode is active
    // EventBridge rule rate(2 minutes) fires rrq/sentinel.poll event
  },
  { event: 'rrq/sentinel.poll' },
  async ({ event, step }) => {

    const { channelId, userId } = event.data;

    // Confirm Autopilot Mode still active before doing anything
    const active = await step.run('check-activation', async () => {
      return sentinelShouldActivate(userId);
    });

    if (!active) return { skipped: true, reason: 'NOT_AUTOPILOT_MODE' };

    // Collect failures from all monitored sources in parallel
    const [
      lambdaFailures,
      ec2Failures,
      inngestFailures,
      dynamoFailures,
      elevenLabsStatus,
      s3Failures,
    ] = await step.run('collect-failures', async () => {
      return Promise.all([
        checkLambdaHealth(channelId),
        checkEc2Health(channelId),
        checkInngestHealth(channelId),
        checkDynamoHealth(channelId),
        checkElevenLabsQuota(userId),
        checkS3Health(channelId),
      ]);
    });

    const allFailures: SentinelAlert[] = [
      ...lambdaFailures,
      ...ec2Failures,
      ...inngestFailures,
      ...dynamoFailures,
      ...elevenLabsStatus,
      ...s3Failures,
    ];

    if (allFailures.length === 0) return { healthy: true };

    // Process each failure through the retry → escalation chain
    for (const alert of allFailures) {
      await step.run(`handle-alert-${alert.alertId}`, async () => {
        return handleAlert(alert, userId, channelId);
      });
    }

    return { alertsProcessed: allFailures.length };
  },
);

async function handleAlert(
  alert: SentinelAlert,
  userId: string,
  channelId: string,
): Promise<void> {

  // Write alert to DynamoDB
  await writeToDynamo('sentinel-alerts', alert);
  await shipLog({ ...alert, timestamp: alert.createdAt });

  // Generate retry strategy
  const strategy = await generateRetryStrategy(alert);

  // Attempt one retry
  await updateSentinelAlert(alert.alertId, channelId, { status: 'RETRYING' });
  const outcome = await executeRetry(alert, strategy);

  if (outcome === 'SUCCEEDED') {
    await updateSentinelAlert(alert.alertId, channelId, {
      status:    'RESOLVED',
      resolved:  true,
      resolvedAt: new Date().toISOString(),
    });
    return; // Zeus will see this in morning brief
  }

  // Retry failed — escalate
  await updateSentinelAlert(alert.alertId, channelId, {
    status:      'ESCALATED',
    retryAttempts: alert.retryAttempts + 1,
  });

  if (alert.severity === 'HIGH') {
    await sendSentinelSns(alert, strategy, userId);
    await updateSentinelAlert(alert.alertId, channelId, { snsSent: true });
  }

  await writeSentinelInAppNotification(alert, strategy, userId);
  // Zeus morning brief aggregation picks this up at 08:45
}
```

---

## SNS Integration

### Setup

```
AWS SNS topic: rrq-sentinel-alerts
  Type: Standard
  Protocol: SMS
  Endpoint: user's phone number (pulled from user-settings DynamoDB at send time)

IAM permissions (Lambda execution role):
  sns:Publish on rrq-sentinel-alerts ARN
```

### Phone Number Source

The user's phone number is stored in `user-settings` DynamoDB during
onboarding. SENTINEL reads it at the moment of SNS publish — never cached
in Lambda memory, always fresh from the table.

```typescript
// lib/sentinel/send-sns.ts

export async function sendSentinelSns(
  alert: SentinelAlert,
  strategy: SentinelRetryStrategy,
  userId: string,
): Promise<void> {

  const settings = await getDynamoItem('user-settings', { userId });
  const phone = settings?.alertPhoneNumber;

  if (!phone) {
    // No phone configured — in-app notification only, log the gap
    console.warn(`[SENTINEL] SNS skipped — no alertPhoneNumber for userId=${userId}`);
    return;
  }

  const message = buildSnsMessage(alert, strategy);

  await snsClient.publish({
    TopicArn: process.env.AWS_SNS_ALERT_TOPIC_ARN,
    Message:  message,
    Subject:  `RRQ Alert: ${alert.component} failure`,
    MessageAttributes: {
      userId: { DataType: 'String', StringValue: userId },
    },
  }).promise();
}

function buildSnsMessage(
  alert: SentinelAlert,
  strategy: SentinelRetryStrategy,
): string {
  const jobLine = alert.jobId ? `\nJob: ${alert.jobId}` : '';
  return [
    `RRQ ALERT [${alert.severity}]`,
    `Component: ${alert.component}`,
    `Failure: ${alert.type}${jobLine}`,
    ``,
    `Auto-retry failed.`,
    `Tried: ${strategy.retryAction}`,
    ``,
    `Open Mission Control to investigate.`,
    `Alert ID: ${alert.alertId}`,
  ].join('\n');
}
```

### SMS Message Format

```
RRQ ALERT [HIGH]
Component: audio-gen
Failure: ELEVENLABS_QUOTA_EXHAUSTED
Job: job_01J9X...

Auto-retry failed.
Tried: ROTATE_ACCOUNT

Open Mission Control to investigate.
Alert ID: alt_01J9X...
```

Messages are kept short. SMS is an interrupt — long messages are not read.
Full context is always available in the in-app notification.

---

## DynamoDB Table: sentinel-alerts

```
Table name:  sentinel-alerts
PK:          channelId       (string) — maps to a user's channel
SK:          alertId         (string) — ulid, sortable by time
GSI-1:       jobId           (sparse — only alerts tied to a job)
             → query all alerts for a specific production job
GSI-2:       status          (OPEN | RETRYING | RESOLVED | ESCALATED)
             → query all open alerts across all channels (ops view)
TTL:         90 days         (auto-expire resolved alerts)

Fields:
  alertId          string (ulid)
  channelId        string
  component        SentinelComponent
  type             SentinelAlertType
  severity         HIGH | MEDIUM
  message          string — raw error or CloudWatch log excerpt
  jobId            string? — present when tied to a job
  retryAttempts    number — incremented on each failed retry strategy
  status           OPEN | RETRYING | RESOLVED | ESCALATED
  resolved         boolean
  resolvedAt       string? — ISO timestamp
  snsSent          boolean — whether SNS SMS was fired
  createdAt        string — ISO timestamp
  context          map? — component-specific extra data (instance ID, account index, etc.)
```

---

## Zeus Morning Brief Integration

At 08:45 every morning, The Line compiles Zeus's brief. SENTINEL contributes
a `SentinelBriefSummary` section. Zeus reviews overnight infrastructure health
and includes a plain-English summary in the brief sent to the Comms stream.

```typescript
// lib/the-line/compile-zeus-brief.ts (excerpt)

const sentinelSummary = await compileSentinelSummary(channelId);

// Zeus prompt includes:
// "SENTINEL overnight report: [summary]
//  Open alerts: [list]
//  Resolved by retry: [count]
//  Escalated to user: [count]"
```

Zeus never acts on SENTINEL data directly (e.g., restarting instances).
Zeus reads, synthesises, and includes the finding in the morning brief.
If a pattern recurs across multiple days, Zeus surfaces it as a systemic
risk in the weekly agent performance review.

---

## Environment Variables

```bash
# AWS SNS — Infrastructure Alerts
AWS_SNS_ALERT_TOPIC_ARN=arn:aws:sns:us-east-1:{account-id}:rrq-sentinel-alerts

# SignOz Observability
SIGNOZ_ENDPOINT=https://your-signoz-host:4318   # OTLP HTTP endpoint
SIGNOZ_API_KEY=                                  # SignOz ingestion key

# EC2 Heartbeat table (DynamoDB)
EC2_HEARTBEAT_TABLE=ec2-heartbeats               # separate lightweight table

# Sentinel poll interval (EventBridge rule, managed outside env)
# rate(2 minutes) — hardcoded in EventBridge rule, not env var
```

Add to Secrets Manager under `rrq/sentinel/`:
- `AWS_SNS_ALERT_TOPIC_ARN`
- `SIGNOZ_ENDPOINT`
- `SIGNOZ_API_KEY`

The user's phone number lives in `user-settings` DynamoDB (field:
`alertPhoneNumber`), set during onboarding. Not an environment variable.

---

## Build Checklist

```
Infrastructure
[ ] Create SNS topic: rrq-sentinel-alerts (SMS type, Standard)
[ ] Create DynamoDB table: sentinel-alerts (schema above)
[ ] Create DynamoDB table: ec2-heartbeats (lightweight, TTL 1hr)
[ ] Add SNS publish permission to Lambda execution IAM role
[ ] Add alertPhoneNumber field to user-settings onboarding flow
[ ] Deploy SignOz (EC2 t3.medium — ops instance, not content pipeline)
[ ] Configure CloudWatch → SignOz log forwarding (SENTINEL Forwarder Lambda)
[ ] Import SignOz dashboard configs from infrastructure/signoz/dashboards/

Core SENTINEL code
[ ] lib/sentinel/types.ts                   all interfaces above
[ ] lib/sentinel/should-activate.ts         Autopilot Mode check
[ ] lib/sentinel/signoz-client.ts           OTLP log + metric exporters
[ ] lib/sentinel/generate-retry-strategy.ts Haiku Bedrock call
[ ] lib/sentinel/execute-retry.ts           5 retry action handlers
[ ] lib/sentinel/send-sns.ts                SNS publish + message builder
[ ] lib/sentinel/in-app-notification.ts     write to notifications DynamoDB
[ ] lib/sentinel/compile-brief.ts           SentinelBriefSummary for Zeus

Health check modules
[ ] lib/sentinel/checks/lambda-health.ts    CloudWatch Errors metric query
[ ] lib/sentinel/checks/ec2-health.ts       heartbeat age check
[ ] lib/sentinel/checks/inngest-health.ts   Inngest API step failure check
[ ] lib/sentinel/checks/dynamo-health.ts    DynamoDB error metric query
[ ] lib/sentinel/checks/elevenlabs.ts       quota remaining check (4 accounts)
[ ] lib/sentinel/checks/s3-health.ts        expected asset presence check

Inngest
[ ] inngest/functions/sentinel-monitor.ts   scheduled poll function
[ ] EventBridge rule: rate(2 minutes)        fires rrq/sentinel.poll
[ ] Wire channelMode check — SENTINEL only fires in AUTOPILOT

Lambda worker integration
[ ] Add shipLog() call to catch block in every Lambda worker (6 workers)
[ ] Add SENTINEL_ENDPOINT env var to every Lambda (points to SignOz)
[ ] EC2 UserData bootstrap: add heartbeat loop (all 3 EC2 types)

Zeus integration
[ ] lib/the-line/compile-zeus-brief.ts      include sentinelSummary section
[ ] Zeus prompt updated to expect SENTINEL section in brief

Testing
[ ] Test Lambda error → Haiku strategy → RESTART_LAMBDA → resolved
[ ] Test EC2 no-heartbeat → Haiku strategy → RELAUNCH_EC2 → resolved
[ ] Test ElevenLabs quota exhausted → ROTATE_ACCOUNT → resolved
[ ] Test all retries fail HIGH severity → SNS sent → in-app written
[ ] Test all retries fail MEDIUM severity → no SNS → in-app only
[ ] Test channelMode = MANUAL → SENTINEL does not activate
[ ] Test channelMode = REX_MANUAL → SENTINEL does not activate
[ ] Test no alertPhoneNumber → SNS skipped gracefully → warning logged
[ ] Test Zeus brief includes SENTINEL summary
[ ] Test SignOz receives logs from Lambda error path
[ ] Test DynamoDB TTL — resolved alerts expire after 90 days
```
