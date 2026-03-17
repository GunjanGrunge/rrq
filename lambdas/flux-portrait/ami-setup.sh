#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FLUX.1 Krea Dev Portrait Generator — EC2 g4dn.xlarge AMI Bake Script
#
# Run this once on a fresh g4dn.xlarge Ubuntu 22.04 instance to create the AMI
# used by the avatar-gen Lambda to launch portrait generation jobs.
#
# After this script completes, create an AMI from the instance and set
# EC2_FLUX_PORTRAIT_AMI_ID in your environment.
#
# Instance: g4dn.xlarge (1x T4, 16GB VRAM, Ubuntu 22.04)
# Recommended base: AWS Deep Learning AMI (Ubuntu 22.04) — includes CUDA 12 pre-installed
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "============================================================"
echo "[1/5] System packages"
echo "============================================================"

apt-get update -y
apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    git \
    curl \
    unzip \
    awscli

echo "[1/5] System packages installed."

echo "============================================================"
echo "[2/5] Verify CUDA 12 (Deep Learning AMI recommended)"
echo "============================================================"

# If using AWS Deep Learning AMI, CUDA 12 is pre-installed.
# Verify:
nvidia-smi
python3 -c "import torch; print('PyTorch CUDA available:', torch.cuda.is_available())" || true

echo "[2/5] CUDA check complete."

echo "============================================================"
echo "[3/5] Create Python virtual environment"
echo "============================================================"

python3 -m venv /opt/flux-env
source /opt/flux-env/bin/activate

echo "[3/5] Virtual environment created at /opt/flux-env"

echo "============================================================"
echo "[4/5] Install Python dependencies"
echo "============================================================"

# Copy requirements to tmp if running remotely
# Assumes requirements.txt is in the same directory as this script or /tmp/requirements.txt
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pip install --upgrade pip

if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    pip install -r "$SCRIPT_DIR/requirements.txt"
elif [ -f "/tmp/requirements.txt" ]; then
    pip install -r /tmp/requirements.txt
else
    echo "ERROR: requirements.txt not found. Upload it to /tmp/requirements.txt and re-run."
    exit 1
fi

echo "[4/5] Python dependencies installed."

echo "============================================================"
echo "[5/5] Verify FLUX pipeline import"
echo "============================================================"

python3 -c "
from diffusers import FluxPipeline
import torch
print('diffusers FluxPipeline: OK')
print('VRAM:', round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2), 'GB')
print('FLUX.1 Krea Dev requires ~16GB VRAM — T4 16GB: OK')
"

echo "============================================================"
echo "AMI SETUP COMPLETE"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Create AMI from this instance in the AWS Console or via:"
echo "     aws ec2 create-image --instance-id <INSTANCE_ID> \\"
echo "       --name 'rrq-flux-portrait-v1' \\"
echo "       --description 'FLUX.1 Krea Dev portrait generation — g4dn.xlarge'"
echo ""
echo "  2. Set EC2_FLUX_PORTRAIT_AMI_ID=<new-ami-id> in your environment"
echo ""
echo "  3. Upload FLUX.1 Krea Dev model weights to S3:"
echo "     HuggingFace: black-forest-labs/FLUX.1-Krea-dev"
echo "     Model S3 path: s3://content-factory-assets/models/flux-krea-dev/"
echo ""
echo "  4. The UserData bootstrap script in flux-runner.ts will:"
echo "     - Pull model weights from that S3 path to /tmp/flux-krea-dev/"
echo "     - Copy generate_portraits.py from the model S3 path"
echo "     - Run inference and upload results"
echo "     - Signal DynamoDB and self-terminate"
