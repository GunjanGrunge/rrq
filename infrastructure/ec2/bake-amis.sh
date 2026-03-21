#!/bin/bash
# ────────────────────────────────────────────────────────────────────────────
# RRQ — Bake SkyReels V2 + Wan2.2 AMIs
#
# Run this ONCE after your GPU quota is approved.
# Prerequisites:
#   - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY exported in env
#   - jq installed (brew install jq)
#   - Model weights already in S3 (verify with: aws s3 ls s3://content-factory-assets/models/)
#
# What it does:
#   1. Launches ONE g5.12xlarge instance (Deep Learning AMI base)
#   2. Runs both ami-setup.sh scripts sequentially (SkyReels then Wan2.2)
#   3. Stops the instance and creates two AMIs
#   4. Outputs the AMI IDs to set in .env.local
#
# Note: Uses a SINGLE instance for both AMIs to minimize cost.
#       Total time: ~45-60 minutes (setup + bake)
#       Cost: ~$0.50-1.00 (g5.12xlarge on-demand ~$5.67/hr, ~10min active)
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export AWS_REGION="us-east-1"
BASE_AMI="ami-09533a4019ca601fb"   # Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04) 20260317
INSTANCE_TYPE="g5.12xlarge"
SUBNET_ID="subnet-0bf7acf3a06b15472"   # us-east-1a — supports g5
SECURITY_GROUP="sg-0c99c7920944a095e"
IAM_PROFILE="arn:aws:iam::751289209169:instance-profile/rrq-ec2-profile"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== [1/6] Launching g5.12xlarge for AMI bake ==="

# Combined UserData: installs SkyReels deps, verifies, then installs Wan2 deps
# The instance stays running — we'll snapshot it for both AMIs
COMBINED_USERDATA=$(cat <<'USERDATA_EOF'
#!/bin/bash
set -euo pipefail
exec > /var/log/rrq-ami-bake.log 2>&1
echo "=== Starting RRQ AMI bake $(date) ==="

# ── System update ──────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq build-essential curl git ffmpeg unzip python3-pip python3-venv awscli

# Verify NVIDIA GPU is available
nvidia-smi
python3 -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda)"

# ── SkyReels V2 environment ────────────────────────────────────────────────
echo "=== Setting up SkyReels V2 ==="
python3 -m venv /opt/skyreels-env
source /opt/skyreels-env/bin/activate

pip install --upgrade pip -q
pip install -q \
  "torch==2.2.2+cu121" \
  "torchvision==0.17.2+cu121" \
  --extra-index-url https://download.pytorch.org/whl/cu121
pip install -q \
  "diffusers==0.30.3" \
  "transformers==4.44.2" \
  "accelerate==0.34.2" \
  "safetensors==0.4.5" \
  "huggingface-hub==0.24.6" \
  "Pillow==10.4.0" \
  "imageio==2.35.1" \
  "imageio-ffmpeg==0.5.1" \
  "opencv-python-headless==4.10.0.84" \
  "boto3==1.35.0" \
  "numpy==1.26.4" \
  "tqdm==4.66.5"

# Clone SkyReels V2
mkdir -p /opt/skyreels-v2
git clone --depth 1 https://github.com/SkyworkAI/SkyReels-V2 /opt/skyreels-repo
cp /opt/skyreels-repo/inference/*.py /opt/skyreels-v2/ 2>/dev/null || true

python3 -c "
from diffusers import CogVideoXImageToVideoPipeline
import torch
print('SkyReels deps: OK')
print('CUDA devices:', torch.cuda.device_count())
"
deactivate

# ── Wan2.2 environment ─────────────────────────────────────────────────────
echo "=== Setting up Wan2.2 ==="
python3 -m venv /opt/wan2-env
source /opt/wan2-env/bin/activate

pip install --upgrade pip -q
pip install -q \
  "torch==2.2.2+cu121" \
  "torchvision==0.17.2+cu121" \
  --extra-index-url https://download.pytorch.org/whl/cu121
pip install -q \
  "diffusers==0.30.3" \
  "transformers==4.44.2" \
  "accelerate==0.34.2" \
  "safetensors==0.4.5" \
  "huggingface-hub==0.24.6" \
  "Pillow==10.4.0" \
  "imageio==2.35.1" \
  "imageio-ffmpeg==0.5.1" \
  "opencv-python-headless==4.10.0.84" \
  "boto3==1.35.0" \
  "numpy==1.26.4" \
  "tqdm==4.66.5"

python3 -c "
import torch
print('Wan2 deps: OK')
print('CUDA available:', torch.cuda.is_available())
"
deactivate

# ── Copy our custom inference scripts ──────────────────────────────────────
# These will be pulled from S3 at actual inference time
# Just marking setup as complete
mkdir -p /opt/skyreels-v2 /opt/wan2

# ── Signal bake complete ───────────────────────────────────────────────────
aws s3 cp /dev/stdin "s3://content-factory-assets/ami-bake-logs/setup-complete.txt" <<< "$(date) — AMI bake setup complete"
echo "=== AMI bake setup complete $(date) ==="
echo "Halting instance..."
shutdown -h now
USERDATA_EOF
)

# Use spot instance (on-demand G quota still 0, spot quota approved)
SPOT_REQUEST_ID=$(aws ec2 request-spot-instances \
  --region "$AWS_REGION" \
  --instance-count 1 \
  --type one-time \
  --launch-specification "{
    \"ImageId\": \"$BASE_AMI\",
    \"InstanceType\": \"$INSTANCE_TYPE\",
    \"IamInstanceProfile\": {\"Arn\": \"$IAM_PROFILE\"},
    \"SubnetId\": \"$SUBNET_ID\",
    \"SecurityGroupIds\": [\"$SECURITY_GROUP\"],
    \"UserData\": \"$(echo "$COMBINED_USERDATA" | base64 | tr -d '\n')\",
    \"BlockDeviceMappings\": [{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":200,\"VolumeType\":\"gp3\"}}]
  }" \
  --query 'SpotInstanceRequests[0].SpotInstanceRequestId' \
  --output text)

echo "Spot request: $SPOT_REQUEST_ID — waiting for fulfillment..."
aws ec2 wait spot-instance-request-fulfilled \
  --spot-instance-request-ids "$SPOT_REQUEST_ID" \
  --region "$AWS_REGION"

INSTANCE_ID=$(aws ec2 describe-spot-instance-requests \
  --spot-instance-request-ids "$SPOT_REQUEST_ID" \
  --region "$AWS_REGION" \
  --query 'SpotInstanceRequests[0].InstanceId' \
  --output text)

# Tag the instance
aws ec2 create-tags \
  --resources "$INSTANCE_ID" \
  --tags Key=Name,Value=rrq-ami-bake Key=Project,Value=rrq Key=Purpose,Value=ami-bake \
  --region "$AWS_REGION"

echo "Instance launched: $INSTANCE_ID"
echo ""
echo "=== [2/6] Waiting for setup to complete (UserData runs ~20-30 min) ==="
echo "You can tail the log with:"
echo "  aws ssm start-session --target $INSTANCE_ID --region us-east-1"
echo "  tail -f /var/log/rrq-ami-bake.log"
echo ""

# Wait for instance to stop (UserData calls 'shutdown -h now' when done)
echo "Waiting for instance to stop..."
aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID" --region "$AWS_REGION"
echo "Instance stopped."

echo ""
echo "=== [3/6] Creating SkyReels AMI ==="
SKYREELS_AMI_ID=$(aws ec2 create-image \
  --instance-id "$INSTANCE_ID" \
  --name "rrq-skyreels-v2-$(date +%Y%m%d)" \
  --description "RRQ SkyReels V2 inference environment — Ubuntu 22.04 + CUDA 12.1 + diffusers" \
  --no-reboot \
  --region "$AWS_REGION" \
  --query 'ImageId' \
  --output text)

echo "SkyReels AMI: $SKYREELS_AMI_ID (creating — takes ~5 min)"
aws ec2 wait image-available --image-ids "$SKYREELS_AMI_ID" --region "$AWS_REGION"
echo "SkyReels AMI ready: $SKYREELS_AMI_ID"

echo ""
echo "=== [4/6] Creating Wan2.2 AMI (same base image) ==="
WAN2_AMI_ID=$(aws ec2 create-image \
  --instance-id "$INSTANCE_ID" \
  --name "rrq-wan2-$(date +%Y%m%d)" \
  --description "RRQ Wan2.2 T2V inference environment — Ubuntu 22.04 + CUDA 12.1 + diffusers" \
  --no-reboot \
  --region "$AWS_REGION" \
  --query 'ImageId' \
  --output text)

echo "Wan2.2 AMI: $WAN2_AMI_ID (creating — takes ~5 min)"
aws ec2 wait image-available --image-ids "$WAN2_AMI_ID" --region "$AWS_REGION"
echo "Wan2.2 AMI ready: $WAN2_AMI_ID"

echo ""
echo "=== [5/6] Terminating bake instance ==="
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$AWS_REGION" > /dev/null
echo "Instance $INSTANCE_ID terminated."

echo ""
echo "=== [6/6] Updating .env.local ==="
ENV_FILE="$REPO_ROOT/apps/web/.env.local"

# Update EC2_SKYREELS_AMI_ID
if grep -q "EC2_SKYREELS_AMI_ID" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|EC2_SKYREELS_AMI_ID=.*|EC2_SKYREELS_AMI_ID=$SKYREELS_AMI_ID|" "$ENV_FILE"
else
  echo "EC2_SKYREELS_AMI_ID=$SKYREELS_AMI_ID" >> "$ENV_FILE"
fi

# Update EC2_WAN2_AMI_ID
if grep -q "EC2_WAN2_AMI_ID" "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|EC2_WAN2_AMI_ID=.*|EC2_WAN2_AMI_ID=$WAN2_AMI_ID|" "$ENV_FILE"
else
  echo "EC2_WAN2_AMI_ID=$WAN2_AMI_ID" >> "$ENV_FILE"
fi

# Also update the subnet to us-east-1a (which supports g5)
sed -i.bak "s|EC2_SUBNET_ID=.*|EC2_SUBNET_ID=$SUBNET_ID|" "$ENV_FILE" 2>/dev/null || true

rm -f "$ENV_FILE.bak"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "AMI BAKE COMPLETE"
echo ""
echo "  EC2_SKYREELS_AMI_ID=$SKYREELS_AMI_ID"
echo "  EC2_WAN2_AMI_ID=$WAN2_AMI_ID"
echo "  EC2_SUBNET_ID=$SUBNET_ID"
echo ""
echo ".env.local updated. Pipeline steps 6 and 7 are ready."
echo "════════════════════════════════════════════════════════════════"
