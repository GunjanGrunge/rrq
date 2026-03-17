"""
Wan2.2 B-Roll Inference Script
Runs on EC2 g5.2xlarge — generates atmospheric video segments for B_ROLL beats.

Usage:
  python generate_broll.py
    --prompts_json  /tmp/prompts.json
    --output_dir    /tmp/output/
    --resolution    720p
    --job_id        abc123
    --model_dir     /tmp/wan2.2/Wan2.2-T2V-A14B-FP8

prompts.json format:
  [
    { "sectionId": "intro", "prompt": "...", "durationMs": 5000 },
    ...
  ]

Writes per-beat MP4 segments + manifest.json to --output_dir.
S3 key format: jobs/{job_id}/segments/wan2/{sectionId}.mp4
"""

import argparse
import json
import os
import time
from pathlib import Path

import boto3
import torch
from diffusers import WanPipeline
from diffusers.utils import export_to_video


# ── CLI args ─────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Wan2.2 B-Roll inference")
    parser.add_argument("--prompts_json", required=True, help="Path to prompts JSON file")
    parser.add_argument("--output_dir", required=True, help="Output directory for MP4 segments")
    parser.add_argument("--resolution", default="720p", choices=["720p", "1080p"], help="Output resolution")
    parser.add_argument("--job_id", required=True, help="Pipeline job ID for logging and S3 keys")
    parser.add_argument("--model_dir", required=True, help="Local path to Wan2.2 model directory")
    return parser.parse_args()


# ── Resolution config ─────────────────────────────────────────────────────────

RESOLUTION_MAP = {
    "720p":  {"height": 720,  "width": 1280},
    "1080p": {"height": 1080, "width": 1920},
}


# ── DynamoDB status helper ────────────────────────────────────────────────────

def update_dynamo_status(job_id: str, status: str, error_msg: str = "") -> None:
    """Write wan2Status back to DynamoDB so the orchestrator can poll."""
    region = os.environ.get("AWS_REGION", "us-east-1")
    dynamo = boto3.client("dynamodb", region_name=region)

    update_expr = "SET wan2Status = :s"
    expr_values = {":s": {"S": status}}

    if error_msg:
        update_expr += ", wan2Error = :e"
        expr_values[":e"] = {"S": error_msg}

    try:
        dynamo.update_item(
            TableName="pipeline-jobs",
            Key={"jobId": {"S": job_id}},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
    except Exception as exc:
        # Non-fatal — DynamoDB update failure should not crash inference
        print(f"[wan2][{job_id}] WARNING: DynamoDB update failed: {exc}")


# ── Main inference ────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    job_id = args.job_id
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    res_cfg = RESOLUTION_MAP[args.resolution]
    height = res_cfg["height"]
    width = res_cfg["width"]
    fps = 24
    num_inference_steps = 30
    guidance_scale = 5.0

    print(f"[wan2][{job_id}] Loading prompts from {args.prompts_json}")
    with open(args.prompts_json, "r") as f:
        prompts = json.load(f)

    if not prompts:
        raise ValueError(f"[wan2][{job_id}] No prompts found in {args.prompts_json}")

    print(f"[wan2][{job_id}] {len(prompts)} beats to render at {args.resolution}")

    # ── Load model ──────────────────────────────────────────────────────────
    print(f"[wan2][{job_id}] Loading Wan2.2 pipeline from {args.model_dir}")
    pipe = WanPipeline.from_pretrained(
        args.model_dir,
        torch_dtype=torch.float16,
        local_files_only=True,
    )
    pipe.enable_model_cpu_offload()
    pipe.enable_vae_tiling()
    print(f"[wan2][{job_id}] Pipeline loaded")

    # ── Render loop ─────────────────────────────────────────────────────────
    segments = []
    total_start_ms = int(time.time() * 1000)

    for i, beat in enumerate(prompts):
        section_id = beat["sectionId"]
        prompt = beat["prompt"]
        duration_ms = beat["durationMs"]

        num_frames = max(8, int(duration_ms / 1000 * fps))
        output_path = str(output_dir / f"{section_id}.mp4")

        print(f"[wan2][{job_id}] Rendering beat {section_id} ({num_frames} frames, {duration_ms}ms)")
        beat_start_ms = int(time.time() * 1000)

        generator = torch.Generator(device="cuda").manual_seed(42 + i)

        frames = pipe(
            prompt=prompt,
            height=height,
            width=width,
            num_frames=num_frames,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).frames[0]

        export_to_video(frames, output_path, fps=fps)

        beat_render_ms = int(time.time() * 1000) - beat_start_ms
        print(f"[wan2][{job_id}] Beat {section_id} rendered in {beat_render_ms}ms")

        segments.append({
            "sectionId": section_id,
            "s3Key": f"jobs/{job_id}/segments/wan2/{section_id}.mp4",
            "durationMs": duration_ms,
            "resolution": args.resolution,
            "renderTimeMs": beat_render_ms,
        })

        # Free VRAM between beats
        torch.cuda.empty_cache()

    total_render_ms = int(time.time() * 1000) - total_start_ms
    total_duration_ms = sum(s["durationMs"] for s in segments)

    # ── Write manifest ───────────────────────────────────────────────────────
    manifest = {
        "jobId": job_id,
        "segments": segments,
        "totalDurationMs": total_duration_ms,
        "renderTimeMs": total_render_ms,
        "model": "Wan2.2-T2V-A14B-FP8",
    }

    manifest_path = output_dir / "manifest.json"
    with open(str(manifest_path), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"[wan2][{job_id}] Manifest written to {manifest_path}")
    print(f"[wan2][{job_id}] All {len(segments)} beats complete in {total_render_ms}ms")


if __name__ == "__main__":
    main()
