#!/bin/bash
# Wire EventBridge rules → Inngest trigger via API Destination (no Lambda bridge needed)
#
# EventBridge API Destination calls the Next.js /api/inngest-trigger route directly.
# Requires: APP_URL and INNGEST_BRIDGE_SECRET set in environment.
#
# Usage:
#   APP_URL=https://your-app.vercel.app INNGEST_BRIDGE_SECRET=your-secret bash infrastructure/eventbridge/wire-api-destination.sh

set -e

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-751289209169}"
APP_URL="${APP_URL:-${NEXT_PUBLIC_APP_URL}}"
BRIDGE_SECRET="${INNGEST_BRIDGE_SECRET:-}"

if [ -z "$APP_URL" ] || [ "$APP_URL" = "http://localhost:3000" ]; then
  echo "ERROR: Set APP_URL to your deployed Vercel app URL (e.g. https://rrq.vercel.app)"
  exit 1
fi

ENDPOINT_URL="${APP_URL}/api/inngest-trigger"

echo "Wiring EventBridge → ${ENDPOINT_URL}"
echo ""

# ── 1. Create API Destination connection (shared secret header) ─────────────
echo "[1/4] Creating API Destination connection..."
CONNECTION_ARN=$(aws events create-connection \
  --name rrq-inngest-connection \
  --authorization-type API_KEY \
  --auth-parameters "ApiKeyAuthParameters={ApiKeyName=x-bridge-secret,ApiKeyValue=${BRIDGE_SECRET:-rrq-bridge-$(openssl rand -hex 16)}}" \
  --region "$REGION" \
  --query "ConnectionArn" --output text 2>&1)

if echo "$CONNECTION_ARN" | grep -q "already exists"; then
  echo "  ~ connection already exists"
  CONNECTION_ARN=$(aws events describe-connection --name rrq-inngest-connection --region "$REGION" --query "ConnectionArn" --output text)
else
  echo "  + created connection: $CONNECTION_ARN"
fi

# ── 2. Create API Destination ────────────────────────────────────────────────
echo "[2/4] Creating API Destination..."
DEST_ARN=$(aws events create-api-destination \
  --name rrq-inngest-destination \
  --connection-arn "$CONNECTION_ARN" \
  --invocation-endpoint "$ENDPOINT_URL" \
  --http-method POST \
  --invocation-rate-limit-per-second 300 \
  --region "$REGION" \
  --query "ApiDestinationArn" --output text 2>&1)

if echo "$DEST_ARN" | grep -q "already exists"; then
  echo "  ~ destination already exists"
  DEST_ARN=$(aws events describe-api-destination --name rrq-inngest-destination --region "$REGION" --query "ApiDestinationArn" --output text)
else
  echo "  + created destination: $DEST_ARN"
fi

# ── 3. Create IAM role for EventBridge to invoke the API Destination ─────────
echo "[3/4] Creating EventBridge invocation role..."
ROLE_ARN=$(aws iam create-role \
  --role-name rrq-eventbridge-invoke-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"events.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }' \
  --query "Role.Arn" --output text 2>&1)

if echo "$ROLE_ARN" | grep -q "already exists"; then
  echo "  ~ role already exists"
  ROLE_ARN=$(aws iam get-role --role-name rrq-eventbridge-invoke-role --query "Role.Arn" --output text)
else
  echo "  + created role: $ROLE_ARN"
fi

# Attach invoke policy
aws iam put-role-policy \
  --role-name rrq-eventbridge-invoke-role \
  --policy-name rrq-invoke-api-destination \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":\"events:InvokeApiDestination\",
      \"Resource\":\"${DEST_ARN}\"
    }]
  }" 2>&1 | grep -v "^$" || true

# ── 4. Wire all rules to the API Destination ─────────────────────────────────
echo "[4/4] Wiring rules to API Destination..."

RULES=(
  "rrq-rex-scan:rex/scan.triggered"
  "rrq-zeus-comments:zeus/comments.triggered"
  "rrq-zeus-analytics:zeus/analytics.triggered"
  "rrq-oracle-run:oracle/run.triggered"
  "rrq-the-line-morning:the-line/morning.triggered"
  "rrq-the-line-eod:the-line/eod.triggered"
  "rrq-theo-daily:theo/daily.triggered"
  "rrq-theo-weekly:theo/weekly.triggered"
  "rrq-jason-standup:jason/standup.triggered"
  "rrq-jason-sprint-check:jason/sprint-check.triggered"
)

for RULE_DEF in "${RULES[@]}"; do
  RULE_NAME="${RULE_DEF%%:*}"
  EVENT_NAME="${RULE_DEF##*:}"

  aws events put-targets \
    --rule "$RULE_NAME" \
    --targets "[{
      \"Id\": \"inngest-api-dest\",
      \"Arn\": \"${DEST_ARN}\",
      \"RoleArn\": \"${ROLE_ARN}\",
      \"Input\": \"{\\\"detail-type\\\":\\\"${EVENT_NAME}\\\",\\\"ruleName\\\":\\\"${RULE_NAME}\\\",\\\"detail\\\":{}}\"
    }]" \
    --region "$REGION" 2>&1 | grep -E "FailedEntry|error" || true

  echo "  + wired: $RULE_NAME → $EVENT_NAME"
done

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   EventBridge → Inngest wiring complete          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  API Destination ARN: ${DEST_ARN}"
echo "  Connection ARN:      ${CONNECTION_ARN}"
echo ""
echo "  Add to .env.local / Vercel env vars:"
echo "  EVENTBRIDGE_API_DEST_ARN=${DEST_ARN}"
echo "  INNGEST_BRIDGE_SECRET=<the secret you used>"
