# RRQ Phase 5 — Infrastructure

Provisions all AWS infrastructure for the RRQ agent memory stack:
DynamoDB tables, S3 buckets (config), Bedrock Knowledge Base (config),
and EventBridge scheduled rules.

---

## Prerequisites

1. AWS CLI configured with credentials that can create DynamoDB tables and EventBridge rules.
2. Copy `.env.example` to `.env.local` at the project root and fill in:

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=content-factory-assets
RRQ_MEMORY_BUCKET=rrq-memory
EVENTBRIDGE_INNGEST_TARGET_ARN=arn:aws:lambda:us-east-1:...  # Lambda bridge ARN
```

---

## Run Setup

From the `infrastructure/` directory:

```bash
npm install
npm run phase5
```

Or from project root:

```bash
npx tsx infrastructure/setup.ts
```

This runs three steps in order:
1. Creates all DynamoDB tables (skips existing ones)
2. Seeds agent-status, rrq_state, and source_weights
3. Creates/updates all EventBridge scheduled rules

---

## Manual AWS Console Steps

These cannot be scripted without CDK and must be done manually:

### S3 Buckets

```bash
# Create buckets
aws s3 mb s3://content-factory-assets --region us-east-1
aws s3 mb s3://rrq-memory --region us-east-1

# Enable versioning on rrq-memory (episodic memory must not lose history)
aws s3api put-bucket-versioning \
  --bucket rrq-memory \
  --versioning-configuration Status=Enabled

# Add lifecycle rules via Console:
# content-factory-assets:
#   jobs/*  → transition to STANDARD_IA after 30 days
#   tmp/*   → expire after 7 days
# rrq-memory:
#   episodes/* → transition to GLACIER after 365 days
```

### Bedrock Knowledge Base

1. AWS Console → Amazon Bedrock → Knowledge Bases → **Create knowledge base**
2. **Name**: `rrq-agent-memory`
3. **IAM role**: Create new role (or attach `BEDROCK_KB_POLICY` from `s3/iam-policy.ts`)
4. **Embedding model**: `Amazon Titan Embeddings Text v2`
5. **Vector store**: Amazon OpenSearch Serverless (Bedrock creates and manages it)
6. **Data source** → S3:
   - Bucket: `rrq-memory`
   - Prefix filter: `episodes/`
   - Chunking strategy: Fixed size, **300 tokens**, 20% overlap
7. Click **Create** → wait for KB to become active
8. Copy the **Knowledge Base ID** → set `BEDROCK_KB_ID` in Vercel env vars
9. Copy the **Data Source ID** → set `BEDROCK_DS_ID` in Vercel env vars

### IAM Policies

Attach policies from `s3/iam-policy.ts` to the correct roles:

| Policy export | Attach to |
|---|---|
| `LAMBDA_S3_POLICY` | Lambda execution role (audio-gen, visual-gen, av-sync, shorts-gen, uploader, code-agent) |
| `LAMBDA_DYNAMO_POLICY` | Lambda execution role (same roles above) |
| `EC2_S3_POLICY` | EC2 instance profile (SkyReels + Wan2.2 + FLUX portrait instances) |
| `EC2_DYNAMO_POLICY` | EC2 instance profile (same instances above) |
| `BEDROCK_KB_POLICY` | Zeus Lambda execution role |
| `SES_SEND_POLICY` | Any Lambda that sends notifications (Zeus, escalation handler) |
| `SECRETS_MANAGER_POLICY` | All Lambda and EC2 roles |

---

## EventBridge → Inngest Wiring

EventBridge scheduled rules fire on schedule but cannot call Vercel directly.
The bridge works as follows:

```
EventBridge Rule (cron/rate)
  → Lambda "eb-inngest-bridge" (relay Lambda)
    → POST https://{your-app}.vercel.app/api/inngest-trigger
      → inngest.send({ name: eventName, data: detail })
        → Inngest function runs
```

### Deploy the bridge Lambda

The bridge Lambda is a minimal Node.js function:

```javascript
// handler.js
export const handler = async (event) => {
  const url = process.env.INNGEST_TRIGGER_URL;
  const secret = process.env.INNGEST_BRIDGE_SECRET;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret,
    },
    body: JSON.stringify(event),
  });
};
```

Environment vars for bridge Lambda:
- `INNGEST_TRIGGER_URL` = `https://{your-app}.vercel.app/api/inngest-trigger`
- `INNGEST_BRIDGE_SECRET` = shared secret (also set in Vercel as `INNGEST_BRIDGE_SECRET`)

After deploying the bridge Lambda:
1. Set `EVENTBRIDGE_INNGEST_TARGET_ARN` to the Lambda ARN
2. Re-run `npm run phase5` — rules will be wired to the target

---

## DynamoDB Table Reference

All 55 tables are defined in `dynamodb/tables.ts`. Key tables:

| Table | Stream | TTL |
|---|---|---|
| `production-jobs` | Yes (triggers Inngest qeonWorkflow) | — |
| `rex-watchlist` | — | `expiresAt` |
| `notifications` | — | `expiresAt` |
| `harvy-roi-signals` | — | `expiresAt` (90d) |
| `agent-decision-log` | — | `expiresAt` (90d) |
| `agent-policy-audit-log` | — | `expiresAt` (365d) |
| `sentinel-alerts` | — | `resolvedAt` |

All tables use `PAY_PER_REQUEST` billing (on-demand). No capacity planning needed.

---

## Verify Setup

```bash
# List DynamoDB tables
aws dynamodb list-tables --region us-east-1 | jq '.TableNames | length'
# Expected: 55

# List EventBridge rules
aws events list-rules --region us-east-1 | jq '.Rules | map(.Name)'

# Check agent-status seed
aws dynamodb scan --table-name agent-status --region us-east-1 | jq '.Count'
# Expected: 13
```
