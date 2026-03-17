#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Wan2.2 B-Roll AMI Bootstrap
# Run this ONCE on a fresh g5.2xlarge Ubuntu 22.04 instance to bake the AMI.
# After running: stop the instance, create AMI, set EC2_WAN2_AMI_ID in env.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== [1/5] System update ==="
apt-get update -qq
apt-get install -y -qq \
  build-essential \
  curl \
  git \
  ffmpeg \
  unzip \
  python3-pip \
  python3-venv \
  awscli

echo "=== [2/5] CUDA 12.1 + NVIDIA drivers ==="
# NOTE: Deep Learning AMI (Ubuntu 22.04) is recommended — it ships with CUDA 12
# already configured. If starting from a plain Ubuntu AMI instead, install
# CUDA toolkit manually before continuing:
#
#   wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
#   dpkg -i cuda-keyring_1.1-1_all.deb
#   apt-get update && apt-get install -y cuda-toolkit-12-1
#
# Verify GPU is visible and torch sees CUDA
nvidia-smi
python3 -c "import torch; print('CUDA available:', torch.cuda.is_available())"

echo "=== [3/5] Python virtual environment ==="
python3 -m venv /opt/wan2-env
source /opt/wan2-env/bin/activate
pip install --upgrade pip -q

echo "=== [4/5] Install Python dependencies ==="
pip install -r /tmp/requirements.txt -q

echo "=== [5/5] Verify setup ==="
python3 -c "
from diffusers import WanPipeline
import torch
print('WanPipeline: OK')
print('CUDA:', torch.cuda.is_available())
print('VRAM:', torch.cuda.get_device_properties(0).total_memory / 1e9, 'GB')
"

echo ""
echo "========================================================"
echo "AMI SETUP COMPLETE"
echo ""
echo "Next steps:"
echo "  1. DO NOT bake model weights into the AMI."
echo "     Weights are pulled from S3 at launch time per job."
echo "     Model S3 path: s3://content-factory-assets/models/wan2.2/"
echo "  2. Stop this instance"
echo "  3. Create AMI: Actions > Image and templates > Create image"
echo "  4. Set EC2_WAN2_AMI_ID=<ami-id> in your environment"
echo "========================================================"
