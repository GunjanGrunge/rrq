#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# SkyReels V2 AMI Bootstrap
# Run this ONCE on a fresh g5.12xlarge Ubuntu 22.04 instance to bake the AMI.
# After running: stop the instance, create AMI, set EC2_SKYREELS_AMI_ID in env.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== [1/6] System update ==="
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

echo "=== [2/6] CUDA 12.1 + NVIDIA drivers ==="
# Assumes base AMI has CUDA 12 — Deep Learning AMI (Ubuntu 22.04) is recommended
# If starting from scratch:
# wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
# dpkg -i cuda-keyring_1.1-1_all.deb
# apt-get update && apt-get install -y cuda-toolkit-12-1

# Verify GPU
nvidia-smi
python3 -c "import torch; print('CUDA available:', torch.cuda.is_available())"

echo "=== [3/6] Python virtual environment ==="
python3 -m venv /opt/skyreels-env
source /opt/skyreels-env/bin/activate

echo "=== [4/6] Install Python dependencies ==="
pip install --upgrade pip -q
pip install -r /tmp/requirements.txt -q

echo "=== [5/6] Clone SkyReels V2 repository ==="
mkdir -p /tmp/skyreels-v2
git clone https://github.com/SkyworkAI/SkyReels-V2 /tmp/skyreels-repo
# Copy inference scripts to runtime location
cp /tmp/skyreels-repo/inference/*.py /tmp/skyreels-v2/ 2>/dev/null || true

# Copy our custom inference script
cp /tmp/inference_i2v.py /tmp/skyreels-v2/inference_i2v.py

echo "=== [6/6] Verify setup ==="
python3 -c "
from diffusers import CogVideoXImageToVideoPipeline
import torch
print('diffusers: OK')
print('CUDA devices:', torch.cuda.device_count())
print('VRAM per device (GB):', [torch.cuda.get_device_properties(i).total_memory / 1e9 for i in range(torch.cuda.device_count())])
"

echo ""
echo "========================================================"
echo "AMI SETUP COMPLETE"
echo ""
echo "Next steps:"
echo "  1. DOWNLOAD model weights (see model download instructions below)"
echo "     DO NOT bake weights into AMI — pull from S3 at launch time"
echo "  2. Stop this instance"
echo "  3. Create AMI: Actions > Image and templates > Create image"
echo "  4. Set EC2_SKYREELS_AMI_ID=<ami-id> in your environment"
echo ""
echo "Model S3 path: s3://content-factory-assets/models/skyreels-v2/"
echo "========================================================"
