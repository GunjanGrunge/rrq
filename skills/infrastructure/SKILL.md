---
name: infrastructure
description: >
  RRQ infrastructure cost control. Three rules govern all AWS spend:
  all DynamoDB tables run PAY_PER_REQUEST billing (zero idle cost),
  both EC2 GPU instances are job-launched with warm-pool scheduling
  (never always-on), and every EC2 instance uses a two-layer termination
  system — self-termination as the primary mechanism, Lambda Watchdog as
  the safety net for crash or hang scenarios. Read this skill before
  creating any DynamoDB table, any EC2 launch configuration, or any
  CloudWatch alarm in the system. Quality is never compromised.
  Idle spend is always zero.
---

# RRQ Infrastructure — Cost Control

## The Philosophy

```
Quality is non-negotiable.
Idle spend is always zero.

A 10-20 minute boot window before production is acceptable.
Paying for a machine sitting idle 23hrs/day is not.
The system knows the production schedule in advance.
Zeus uses that knowledge to pre-boot exactly when needed.

Normal path:  instance self-terminates when job is done.
Failure path: Lambda Watchdog fires if instance is still alive
              30 minutes beyond its expected window.
              Terminates the instance. Notifies Zeus immediately.
```

---

## The Three Rules

```
RULE 1 — DynamoDB:   Every table uses PAY_PER_REQUEST billing.
                     No provisioned capacity anywhere in the system.
                     Zero traffic = zero cost. No exceptions.

RULE 2 — EC2:        Both GPU instances are job-launched.
                     None are always-on. None are reserved.
                     Zeus schedules boot before production starts.
                     Every instance self-terminates on job completion.

RULE 3 — Watchdog:   Every EC2 instance has a two-layer termination system.
                     Layer 1: instance self-terminates (primary).
                     Layer 2: Lambda Watchdog force-terminates if Layer 1
                              fails due to crash, hang, or snag.
```

---

## Rule 1 — DynamoDB PAY_PER_REQUEST

### Why

PROVISIONED capacity bills for reserved RCU/WCU every hour whether the
system is active or not. PAY_PER_REQUEST bills only for actual reads
and writes. When no job is running — DynamoDB cost is exactly $0.00.

### Billing Config — Import Everywhere

```typescript
// lib/infrastructure/dynamo-config.ts
// Import this wherever a table is created.
// Never hardcode BillingMode in any other file.

export const DYNAMO_BILLING = {
  BillingMode: "PAY_PER_REQUEST",
} as const;

// Standard table creation pattern:
// await dynamodb.send(new CreateTableCommand({
//   TableName: "table-name",
//   ...DYNAMO_BILLING,
//   KeySchema: [...],
//   AttributeDefinitions: [...],
// }));
```

### Full Table Registry

Every DynamoDB table in the system. One place. One billing mode. No drift.

```typescript
export const ALL_TABLES = [

  // Agent & Channel Memory
  { TableName: "agent-scores",         PK: "agentId",    TTL: null },
  { TableName: "channel-health",       PK: "date",       TTL: null },
  { TableName: "video-memory",         PK: "videoId",    TTL: "expiresAt" }, // 180 days
  { TableName: "rex-watchlist",        PK: "topicId",    TTL: "expiresAt" }, // 30 days
  { TableName: "regum-schedule",       PK: "date",       TTL: null },
  { TableName: "production-jobs",      PK: "jobId",      TTL: "expiresAt" }, // 90 days

  // Inter-Agent Communication
  { TableName: "agent-messages",       PK: "messageId",  TTL: "ttl"        }, // 30 days
  { TableName: "zeus-briefs",          PK: "briefDate",  TTL: null },
  { TableName: "the-line-log",         PK: "runId",      TTL: "expiresAt" }, // 60 days

  // ARIA Portfolio
  { TableName: "aria-portfolio",       PK: "weekKey",    TTL: null },
  { TableName: "evidence-log",         PK: "entryId",    TTL: "expiresAt" }, // 90 days
  { TableName: "signal-cache",         PK: "topicId",    TTL: "ttl"        }, // 30 min
  { TableName: "topic-queue",          PK: "topicId",    TTL: "expiresAt" }, // 7 days

  // SNIPER Geo Intelligence
  { TableName: "geo-strategies",       PK: "topicId",    TTL: "expiresAt" }, // 30 days
  { TableName: "market-performance",   PK: "marketCode", SK: "date", TTL: null },

  // ORACLE Knowledge
  { TableName: "oracle-updates",       PK: "runId",      SK: "domainId", TTL: "expiresAt" }, // 14 days
  { TableName: "oracle-knowledge-index", PK: "domainId", TTL: null },

  // Council & Retro
  { TableName: "council-sessions",     PK: "councilId",  TTL: null }, // permanent

  // Theo Community
  { TableName: "theo-comment-actions", PK: "videoId",    SK: "commentId", TTL: "expiresAt" }, // 60 days
  { TableName: "theo-ab-tests",        PK: "videoId",    TTL: null },
  { TableName: "theo-community-posts", PK: "postId",     TTL: null },
  { TableName: "theo-playlist-audit",  PK: "auditDate",  TTL: "expiresAt" }, // 90 days
  { TableName: "theo-weekly-reports",  PK: "reportDate", TTL: "expiresAt" }, // 90 days

  // Mission & Channel State
  { TableName: "channel-milestones",   PK: "milestone",  TTL: null }, // permanent
  { TableName: "channel-settings",     PK: "userId",     TTL: null },

  // Auth & User
  { TableName: "user-tokens",          PK: "userId",     TTL: null },
  { TableName: "user-settings",        PK: "userId",     TTL: null },

  // Cold Start & Onboarding
  { TableName: "cold-start-sprints",   PK: "userId",     TTL: "expiresAt" }, // 30 days
  { TableName: "channel-audit",        PK: "userId",     TTL: null },

  // Living Prompt Engine (THE LINE)
  { TableName: "agent-prompts-static", PK: "agentId",    TTL: null }, // seed at build, never overwrite
  { TableName: "agent-prompts-dynamic",PK: "agentId",    TTL: null }, // THE LINE writes, Zeus approves
  { TableName: "prompt-update-queue",  PK: "updateId",   TTL: "expiresAt" }, // 14 days
  { TableName: "prompt-history",       PK: "agentId",    SK: "version", TTL: null }, // permanent — rollback

  // Rex Memory Store additions
  { TableName: "source_weights",  PK: "sourceId",    TTL: null },
  { TableName: "topic_history",   PK: "topicHash",   TTL: "ttl"       }, // 72h default
  { TableName: "niche_profiles",  PK: "channelId",   TTL: null },
  { TableName: "rrq_state",       PK: "instanceId",  TTL: null },

  // Avatar Roster
  // avatar-profiles — Presenter roster
  //   PK: channelId, SK: presenterId
  //   Fields: seed, base_prompt, s3_reference, personality[],
  //           expression_hints[], performance_scores, evolution_history[]
  { TableName: "avatar-profiles", PK: "channelId",   SK: "presenterId", TTL: null },

  // Notifications & Confidence
  // notifications — User notification inbox
  //   PK: userId, SK: notificationId
  //   GSI: jobId (query all notifications for a job)
  //   Fields: type, jobId, videoTitle, stuckAt, attempts, lastScore,
  //           threshold, zeusVerdict, options[], expiresAt, autoDecision,
  //           read, resolved, resolvedBy
  //   TTL: 30 days
  //   Written by: Zeus escalation handler
  //   Read by: frontend notification system
  { TableName: "notifications",       PK: "userId",    SK: "notificationId", TTL: "expiresAt" }, // 30 days

  // channel-confidence — Niche+mode confidence score cache
  //   PK: channelId
  //   Fields: overall, label, perNiche[], crossNicheCoherence,
  //           suggestions[], risks[], evaluatedAt
  //   TTL: 24 hours
  //   Written by: onboarding confidence eval Haiku call
  //   Read by: onboarding UI, channel settings page
  { TableName: "channel-confidence",  PK: "channelId", TTL: "expiresAt" }, // 24 hours

  // series-registry — Anime series state machine (COMING SOON — spec only, not built)
  //   PK: channelId, SK: seriesId
  //   Fields: title, premise, episodeCount, currentArc,
  //           nextEpisodeBrief, audienceSignals[], status
  { TableName: "series-registry",     PK: "channelId", SK: "seriesId",       TTL: null }, // COMING_SOON table (spec only, not built)

] as const;
```

### TTL — Free Automatic Expiry

DynamoDB TTL is free. Every table that does not need permanent records
uses TTL to auto-delete old items. Keeps table size small and read
costs low even under PAY_PER_REQUEST.

```typescript
// Enable TTL when creating each table that uses it:
await dynamodb.send(new UpdateTimeToLiveCommand({
  TableName: tableName,
  TimeToLiveSpecification: {
    Enabled:       true,
    AttributeName: "expiresAt", // or "ttl" for signal-cache and agent-messages
  },
}));

// When writing items — always set the expiry in epoch seconds:
const expiresAt = Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60); // 180 days
```

---

## Rule 2 — EC2 Job-Based Launch with Warm Pool

### The Three Instances

```
g5.12xlarge   SkyReels V2    Avatar / talking head segments
              Spot price:    ~$1.60/hr
              Max job time:  90min
              Boot time:     ~10-12min (4× A10G, 28GB model)

g5.2xlarge    Wan2.2         B-roll / environment segments
              Spot price:    ~$0.45/hr
              Max job time:  60min
              Boot time:     ~8-10min (1× A10G)

g4dn.xlarge   FLUX.1 [dev]   Portrait generation (channel onboarding + roster expansion only)
              Spot price:    ~$0.20/hr
              NOT always-on — fires on channel onboarding + roster expansion only
              Self-terminates after portrait batch completes
              Per-batch cost: ~$0.15-0.25 (3-5 portraits at ~3-4 min each)
              Steady state cost: near-zero (portraits reused forever via SkyReels)
              Model: open source Apache 2.0, weights stored in S3
```

### Zeus Warm Pool Scheduling

Zeus reads `regum-schedule` from DynamoDB to know exactly when Qeon
will need each instance. Zeus pre-boots with lead time so instances are
warm and ready when production reaches the GPU steps. No cold-start
delay in production — just a pre-production wait that Zeus manages.

```typescript
// lib/infrastructure/ec2-scheduler.ts

const BOOT_LEAD_TIME_MINUTES = {
  SKYREELS: 14,  // g5.12xlarge — larger model, longer boot
  WAN2:     12,  // g5.2xlarge
} as const;

const MAX_JOB_MINUTES = {
  SKYREELS: 90,
  WAN2:     60,
} as const;

// Zeus calls this when a production job is confirmed after council sign-off
export async function scheduleInstanceBoot(
  jobId: string,
  estimatedProductionStart: Date,
  requiredInstances: Array<keyof typeof BOOT_LEAD_TIME_MINUTES>
): Promise<void> {

  for (const instance of requiredInstances) {
    const bootAt = new Date(
      estimatedProductionStart.getTime()
      - BOOT_LEAD_TIME_MINUTES[instance] * 60 * 1000
    );

    await createOneTimeBootRule(instance, jobId, bootAt);

    console.log(
      `[EC2-SCHEDULER] ${instance} boot at ${bootAt.toISOString()} ` +
      `(${BOOT_LEAD_TIME_MINUTES[instance]}min lead)`
    );
  }
}

async function createOneTimeBootRule(
  instance: string,
  jobId: string,
  bootAt: Date
): Promise<void> {

  const events = new EventBridgeClient({ region: process.env.AWS_REGION });
  const ruleName = `rrq-boot-${instance.toLowerCase()}-${jobId}`;

  await events.send(new PutRuleCommand({
    Name:               ruleName,
    ScheduleExpression: dateToCronExpression(bootAt),
    State:              "ENABLED",
    Description:        `One-time boot: ${instance} for job ${jobId}`,
  }));

  await events.send(new PutTargetsCommand({
    Rule:    ruleName,
    Targets: [{
      Id:    "boot-lambda",
      Arn:   process.env.EC2_BOOT_LAMBDA_ARN!,
      Input: JSON.stringify({ instance, jobId }),
    }],
  }));
}

function dateToCronExpression(date: Date): string {
  return (
    `cron(${date.getUTCMinutes()} ${date.getUTCHours()} ` +
    `${date.getUTCDate()} ${date.getUTCMonth() + 1} ? ${date.getUTCFullYear()})`
  );
}
```

### EC2 Boot Lambda

Fires once per job per instance type. Launches the spot instance,
tags it, records the instance ID in `production-jobs`, then deletes
the one-time EventBridge rule.

```typescript
// lib/infrastructure/lambdas/ec2-boot.ts

const EC2_LAUNCH_CONFIG = {
  SKYREELS: {
    ImageId:      () => process.env.EC2_SKYREELS_AMI_ID!,
    InstanceType: "g5.12xlarge" as const,
    MaxSpotPrice: "2.00",
  },
  WAN2: {
    ImageId:      () => process.env.EC2_WAN2_AMI_ID!,
    InstanceType: "g5.2xlarge" as const,
    MaxSpotPrice: "0.65",
  },
};

export async function handler(event: { instance: string; jobId: string }) {

  const { instance, jobId } = event;
  const config = EC2_LAUNCH_CONFIG[instance as keyof typeof EC2_LAUNCH_CONFIG];
  if (!config) throw new Error(`Unknown instance type: ${instance}`);

  const ec2 = new EC2Client({ region: process.env.AWS_REGION });

  const result = await ec2.send(new RunInstancesCommand({
    ImageId:      config.ImageId(),
    InstanceType: config.InstanceType,
    MinCount:     1,
    MaxCount:     1,
    InstanceMarketOptions: {
      MarketType:  "spot",
      SpotOptions: {
        SpotInstanceType: "one-time",
        MaxPrice:         config.MaxSpotPrice,
      },
    },
    UserData: Buffer.from(
      buildUserData(instance as keyof typeof MAX_JOB_MINUTES, jobId)
    ).toString("base64"),
    IamInstanceProfile: { Name: process.env.EC2_INSTANCE_PROFILE! },
    TagSpecifications: [{
      ResourceType: "instance",
      Tags: [
        { Key: "rrq-job",      Value: jobId },
        { Key: "rrq-instance", Value: instance },
        { Key: "rrq-booted",   Value: new Date().toISOString() },
        { Key: "Name",         Value: `rrq-${instance.toLowerCase()}-${jobId}` },
      ],
    }],
  }));

  const instanceId = result.Instances?.[0]?.InstanceId;
  if (!instanceId) throw new Error("EC2 launch returned no instance ID");

  // Record in production-jobs so Watchdog and Qeon can find it
  const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
  await dynamo.send(new UpdateItemCommand({
    TableName: "production-jobs",
    Key:       { jobId: { S: jobId } },
    UpdateExpression:
      "SET #inst = :id, #booted = :at",
    ExpressionAttributeNames: {
      "#inst":   `${instance.toLowerCase()}InstanceId`,
      "#booted": `${instance.toLowerCase()}BootedAt`,
    },
    ExpressionAttributeValues: {
      ":id": { S: instanceId },
      ":at": { S: new Date().toISOString() },
    },
  }));

  // Delete the one-time EventBridge rule — it has fired
  const events = new EventBridgeClient({ region: process.env.AWS_REGION });
  const ruleName = `rrq-boot-${instance.toLowerCase()}-${jobId}`;
  await events.send(new RemoveTargetsCommand({ Rule: ruleName, Ids: ["boot-lambda"] }));
  await events.send(new DeleteRuleCommand({ Name: ruleName }));

  console.log(`[EC2-BOOT] ${instance} launched: ${instanceId} for job ${jobId}`);
}
```

### UserData — Self-Termination Script (Layer 1)

Every instance runs this. Self-termination is always the primary exit.
The script handles normal completion, job failure, and internal hang.
It also checks for a queued next job before terminating — keeping the
instance warm across back-to-back videos to avoid redundant boot cycles.

```bash
#!/bin/bash
# RRQ Worker UserData — injected per instance at launch
# Placeholders replaced by buildUserData() before base64 encoding

set -e

INSTANCE_TYPE="{{INSTANCE_TYPE}}"     # SKYREELS | WAN2
JOB_ID="{{JOB_ID}}"
REGION="{{AWS_REGION}}"
MAX_JOB_MINUTES={{MAX_JOB_MINUTES}}   # 90 | 60 | 45
IDLE_GRACE_MINUTES=15
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
POLL_INTERVAL=30

log() {
  echo "[RRQ-${INSTANCE_TYPE}] $1" | tee -a /var/log/rrq-worker.log
}

self_terminate() {
  log "Self-terminating: $1"
  aws ec2 terminate-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --output text
}

# Internal hang watchdog — independent process
# Kills the instance if max job time exceeded regardless of job status
(
  sleep $(( MAX_JOB_MINUTES * 60 ))
  log "MAX JOB TIME EXCEEDED (${MAX_JOB_MINUTES}min) — internal watchdog firing"
  self_terminate "internal-hang-watchdog"
) &
INTERNAL_WATCHDOG_PID=$!

run_job() {
  local job_id="$1"
  log "Starting inference server for job: $job_id"

  cd /opt/rrq
  python3 server.py --job-id "$job_id" --instance-type "$INSTANCE_TYPE" &
  SERVER_PID=$!

  # Poll DynamoDB for job completion
  log "Polling DynamoDB for job completion..."
  STATUS_KEY="${INSTANCE_TYPE,,}Status"

  while true; do
    STATUS=$(aws dynamodb get-item \
      --table-name production-jobs \
      --key "{\"jobId\": {\"S\": \"$job_id\"}}" \
      --region "$REGION" \
      --query "Item.${STATUS_KEY}.S" \
      --output text 2>/dev/null || echo "UNKNOWN")

    if [[ "$STATUS" == "COMPLETE" || "$STATUS" == "FAILED" ]]; then
      log "Job $job_id finished with status: $STATUS"
      kill "$SERVER_PID" 2>/dev/null || true
      return 0
    fi
    sleep "$POLL_INTERVAL"
  done
}

# Run the initial job
run_job "$JOB_ID"

# Kill internal watchdog — job finished in time
kill "$INTERNAL_WATCHDOG_PID" 2>/dev/null || true

# Check for a queued next job before terminating
# Keeps instance warm across back-to-back videos
log "Checking for queued next job..."

NEXT_JOB=$(aws dynamodb query \
  --table-name production-jobs \
  --index-name status-createdAt \
  --key-condition-expression "#s = :queued" \
  --filter-expression "contains(requiredInstances, :inst)" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values \
    "{\":queued\": {\"S\": \"QUEUED\"}, \":inst\": {\"S\": \"$INSTANCE_TYPE\"}}" \
  --region "$REGION" \
  --query "Items[0].jobId.S" \
  --output text 2>/dev/null || echo "None")

if [[ "$NEXT_JOB" != "None" && "$NEXT_JOB" != "" && "$NEXT_JOB" != "null" ]]; then
  log "Next job found: $NEXT_JOB — staying warm"

  # Claim the job — mark this instance as handling it
  aws dynamodb update-item \
    --table-name production-jobs \
    --key "{\"jobId\": {\"S\": \"$NEXT_JOB\"}}" \
    --update-expression "SET ${INSTANCE_TYPE,,}InstanceId = :id" \
    --expression-attribute-values "{\":id\": {\"S\": \"$INSTANCE_ID\"}}" \
    --region "$REGION" \
    --condition-expression "attribute_not_exists(${INSTANCE_TYPE,,}InstanceId)"

  JOB_ID="$NEXT_JOB"
  run_job "$JOB_ID"
fi

# No queued job — idle grace period then self-terminate
log "No queued job. Idle grace: ${IDLE_GRACE_MINUTES}min"
sleep $(( IDLE_GRACE_MINUTES * 60 ))
self_terminate "job-complete-idle-grace-elapsed"
```

```typescript
// lib/infrastructure/ec2-scheduler.ts — UserData builder

function buildUserData(
  instance: keyof typeof MAX_JOB_MINUTES,
  jobId: string
): string {
  return USER_DATA_TEMPLATE
    .replace(/{{INSTANCE_TYPE}}/g,    instance)
    .replace(/{{JOB_ID}}/g,           jobId)
    .replace(/{{AWS_REGION}}/g,       process.env.AWS_REGION!)
    .replace(/{{MAX_JOB_MINUTES}}/g,  String(MAX_JOB_MINUTES[instance]));
}
```

---

## Rule 3 — Lambda Watchdog (Layer 2)

The safety net. Only activates when Layer 1 has failed.
Runs every 15 minutes. Near-zero cost when nothing is wrong.

### Trigger Timeline Per Instance

```
SKYREELS (90min max + 15min idle + 30min buffer) = fires at 135min
WAN2     (60min max + 15min idle + 30min buffer) = fires at 105min

If instance alive beyond these thresholds — Layer 1 failed.
Watchdog terminates and notifies Zeus.
```

### Watchdog Lambda

```typescript
// lib/infrastructure/lambdas/ec2-watchdog.ts
// EventBridge: rate(15 minutes) — always running, usually a no-op

const WATCHDOG_THRESHOLD_MINUTES = {
  SKYREELS: 135,   // 90 + 15 + 30
  WAN2:     105,   // 60 + 15 + 30
} as const;

export async function handler(): Promise<void> {

  const ec2    = new EC2Client({ region: process.env.AWS_REGION });
  const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

  // Find all running RRQ-tagged instances
  const result = await ec2.send(new DescribeInstancesCommand({
    Filters: [
      { Name: "tag-key",              Values: ["rrq-job"] },
      { Name: "instance-state-name",  Values: ["running", "pending"] },
    ],
  }));

  const instances = result.Reservations?.flatMap(r => r.Instances ?? []) ?? [];

  for (const instance of instances) {

    const instanceId   = instance.InstanceId!;
    const instanceType = instance.Tags?.find(t => t.Key === "rrq-instance")?.Value as
                         keyof typeof WATCHDOG_THRESHOLD_MINUTES | undefined;
    const jobId        = instance.Tags?.find(t => t.Key === "rrq-job")?.Value;
    const bootedAt     = instance.Tags?.find(t => t.Key === "rrq-booted")?.Value;

    if (!instanceType || !jobId || !bootedAt) continue;
    if (!(instanceType in WATCHDOG_THRESHOLD_MINUTES)) continue;

    const aliveMinutes =
      (Date.now() - new Date(bootedAt).getTime()) / 60_000;

    const threshold = WATCHDOG_THRESHOLD_MINUTES[instanceType];

    // Still within expected window — do nothing
    if (aliveMinutes < threshold) continue;

    // LAYER 1 HAS FAILED — force terminate
    console.error(
      `[WATCHDOG] ${instanceType} ${instanceId} alive ` +
      `${Math.round(aliveMinutes)}min (threshold: ${threshold}min). ` +
      `Force-terminating.`
    );

    await ec2.send(new TerminateInstancesCommand({
      InstanceIds: [instanceId],
    }));

    const payload = {
      instanceId,
      instanceType,
      jobId,
      aliveMinutes:  Math.round(aliveMinutes),
      maxMinutes:    threshold,
      action:        "FORCE_TERMINATED",
      message:
        `${instanceType} instance alive ${Math.round(aliveMinutes)}min ` +
        `beyond threshold (${threshold}min). Self-termination failed. ` +
        `Watchdog force-terminated. Check job ${jobId} in CloudWatch logs.`,
    };

    // Notify Zeus via agent-messages
    await dynamo.send(new PutItemCommand({
      TableName: "agent-messages",
      Item: {
        messageId: { S: `watchdog-${instanceId}-${Date.now()}` },
        type:      { S: "WATCHDOG_TERMINATION" },
        from:      { S: "INFRASTRUCTURE" },
        to:        { S: "ZEUS" },
        priority:  { S: "HIGH" },
        urgency:   { S: "IMMEDIATE" },
        sentAt:    { S: new Date().toISOString() },
        payload:   { S: JSON.stringify(payload) },
        ttl:       { N: String(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60) },
      },
    }));

    // Mark the production job as WATCHDOG_FAILED
    await dynamo.send(new UpdateItemCommand({
      TableName: "production-jobs",
      Key:       { jobId: { S: jobId } },
      UpdateExpression:
        "SET #s = :status, watchdogFiredAt = :now, watchdogPayload = :payload",
      ExpressionAttributeNames:  { "#s": "status" },
      ExpressionAttributeValues: {
        ":status":  { S: "WATCHDOG_FAILED" },
        ":now":     { S: new Date().toISOString() },
        ":payload": { S: JSON.stringify(payload) },
      },
    }));
  }
}
```

### Watchdog EventBridge Rule

```typescript
{
  Name:               "rrq-ec2-watchdog",
  ScheduleExpression: "rate(15 minutes)",
  State:              "ENABLED",
  Description:        "RRQ EC2 Idle Watchdog — Layer 2 safety net",
  Targets: [{
    Id:  "watchdog-lambda",
    Arn: process.env.EC2_WATCHDOG_LAMBDA_ARN!,
  }],
}
```

### THE LINE Routing for WATCHDOG_TERMINATION

Add to THE LINE filter rules:

```typescript
// In lib/the-line/filter.ts ESCALATION_RULES:
"WATCHDOG_TERMINATION":            "INCLUDE_IN_BRIEF",      // first firing
"WATCHDOG_TERMINATION_REPEATED":   "ESCALATE_IMMEDIATELY",  // 2+ in 24hrs = systemic problem
```

Zeus morning brief entry for a watchdog event:

```
⚠ WATCHDOG FIRED — WAN2 g5.2xlarge
  Instance:  i-0abc123def456
  Job:       job-2026-03-13-004
  Alive:     112min (threshold: 105min)
  Action:    Force-terminated

  Possible causes: OOM, spot interruption, Wan2.2 process crash, network partition.
  Recommendation:  Jason to check CloudWatch logs for job-2026-03-13-004.
                   Determine if video needs re-queue.
  No action required now — production pipeline unblocked.
```

---

## Dynamic Instance URL Resolution

Qeon resolves the instance URL at runtime by querying EC2 for the
running instance tagged to the current job.

```typescript
// lib/infrastructure/ec2-resolver.ts

export async function getInstanceServerUrl(
  jobId: string,
  instanceType: "SKYREELS" | "WAN2",
  port: number = 8080,
  maxWaitSeconds: number = 120
): Promise<string> {

  const ec2 = new EC2Client({ region: process.env.AWS_REGION });
  const start = Date.now();

  while (Date.now() - start < maxWaitSeconds * 1000) {

    const result = await ec2.send(new DescribeInstancesCommand({
      Filters: [
        { Name: "tag:rrq-job",      Values: [jobId] },
        { Name: "tag:rrq-instance", Values: [instanceType] },
        { Name: "instance-state-name", Values: ["running"] },
      ],
    }));

    const ip = result.Reservations?.[0]?.Instances?.[0]?.PrivateIpAddress;

    if (ip) {
      // Verify the inference server is ready
      const url = `http://${ip}:${port}`;
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return url;
      } catch {
        // Server not ready yet — keep waiting
      }
    }

    await new Promise(r => setTimeout(r, 10_000)); // poll every 10s
  }

  throw new Error(
    `${instanceType} server not ready for job ${jobId} after ${maxWaitSeconds}s`
  );
}

// Qeon usage before Step 7 (b-roll):
// const wan2Url = await getInstanceServerUrl(jobId, "WAN2");
// const broll   = await generateBroll(wan2Url, brollBatch);
```

---

## Environment Variables

```bash
# AWS SES — Transactional Email Notifications
SES_FROM_ADDRESS=notifications@rrq.ai   # verified sender domain
SES_REGION=us-east-1
SES_CONFIGURATION_SET=rrq-transactional  # for bounce/complaint tracking

# EC2 AMIs — baked with model weights, one per instance type
EC2_SKYREELS_AMI_ID=              # g5.12xlarge + SkyReels V2 preloaded
EC2_WAN2_AMI_ID=                  # g5.2xlarge  + Wan2.2 FP8 preloaded

# Portrait generation — fires on onboarding + roster expansion only, not per-video
EC2_FLUX_PORTRAIT_AMI_ID=         # g4dn.xlarge + FLUX.1 [dev] FP8 preloaded
EC2_FLUX_PORTRAIT_INSTANCE_TYPE=g4dn.xlarge
FLUX_PORTRAIT_MODEL_PATH=s3://content-factory-assets/models/flux1-dev/

EC2_INSTANCE_PROFILE=             # IAM role — DynamoDB + S3 + ec2:TerminateInstances
EC2_BOOT_LAMBDA_ARN=              # ARN of ec2-boot Lambda
EC2_WATCHDOG_LAMBDA_ARN=          # ARN of ec2-watchdog Lambda

AWS_REGION=                       # e.g. us-east-1

# REMOVED — delete these if present:
# EC2_FLUX_AMI_ID=                FLUX EC2 eliminated — TONY Lambda handles all image gen
# EC2_FLUX_INSTANCE_ID=           never existed in final design
# EC2_FLUX_SERVER_URL=            never existed in final design
# TONY_LAMBDA_ARN is in the main CLAUDE.md env var list
```

---

## CLAUDE.md Architecture Decision to Update

```
OLD:
| EC2 reserved for FLUX | Always-hot image gen — cold start penalty worse than fixed cost |

NEW:
| TONY Lambda for images | Zero EC2 for stills. Remotion/Recharts/D3 renders all section  |
|                        | cards, concept images, thumbnails. Lambda-only, no boot time,  |
|                        | no idle cost. Oracle Domain 9 keeps TONY's toolbox current.    |
```

---

## Build Checklist

```
DynamoDB — PAY_PER_REQUEST:
[ ] Create lib/infrastructure/dynamo-config.ts
    Export DYNAMO_BILLING and ALL_TABLES
[ ] Audit every CreateTableCommand in codebase
    Add BillingMode: PAY_PER_REQUEST to every table
[ ] Enable TTL on all tables with TTL fields (see ALL_TABLES registry)
[ ] Confirm no PROVISIONED tables exist in AWS console after deploy

EC2 Warm Pool:
[ ] Create lib/infrastructure/ec2-scheduler.ts
    scheduleInstanceBoot(), createOneTimeBootRule(), buildUserData()
[ ] Create lib/infrastructure/ec2-resolver.ts
    getInstanceServerUrl() — dynamic IP resolution with health check poll
[ ] Create lib/infrastructure/lambdas/ec2-boot.ts
    Spot launcher — tags instance, records ID in production-jobs,
    deletes one-time EventBridge rule after firing
[ ] Update UserData template for both instances (SKYREELS, WAN2)
    Add self-termination script, internal hang watchdog, next-job check
[ ] Wire Zeus scheduler — call scheduleInstanceBoot() after council sign-off
    Zeus reads regum-schedule to determine estimatedProductionStart
[ ] Update CLAUDE.md architecture decisions table

Watchdog — Lambda Safety Net:
[ ] Create lib/infrastructure/lambdas/ec2-watchdog.ts
[ ] IAM permissions for watchdog Lambda:
    ec2:DescribeInstances, ec2:TerminateInstances,
    dynamodb:PutItem, dynamodb:UpdateItem on agent-messages + production-jobs
[ ] Deploy EventBridge rule: rrq-ec2-watchdog — rate(15 minutes)
[ ] Add EC2_WATCHDOG_LAMBDA_ARN to env vars
[ ] Add WATCHDOG_TERMINATION to THE LINE filter rules
    INCLUDE_IN_BRIEF (first), ESCALATE_IMMEDIATELY (2+ in 24hrs)
[ ] Test: launch a tagged test instance, verify watchdog terminates it at threshold
[ ] Test: verify Zeus receives WATCHDOG_TERMINATION in morning brief
[ ] Test: verify production-jobs updated to WATCHDOG_FAILED

Cost Verification:
[ ] All DynamoDB tables show PAY_PER_REQUEST in AWS console — zero provisioned
[ ] No always-on EC2 instances in account
[ ] Set AWS Budgets alert at $50/month — unexpected spend caught immediately
[ ] Run one full video production — verify EC2 boots, produces, self-terminates
[ ] Check AWS Cost Explorer the following day — confirm idle cost near $0
```

---

## Expected Monthly Cost

```
Producing 20 videos/month (5/week)

DynamoDB PAY_PER_REQUEST:        ~$2-4/month
EC2 SkyReels  20 × 35min × $1.60/hr:  ~$19/month
EC2 Wan2.2    20 × 20min × $0.45/hr:   ~$3/month
Lambda (boot + watchdog + TONY):  ~$0.10/month
S3, Bedrock, ElevenLabs:        unchanged

Total EC2 + DynamoDB:           ~$24-26/month

Zero-idle guarantee:
  DynamoDB:   $0.00  (PAY_PER_REQUEST, zero reads/writes)
  EC2:        $0.00  (all instances terminated between jobs)
  Lambda:     ~$0.05 (watchdog runs every 15min, no-ops are free tier)
  Total idle: ~$0.05/month
```
