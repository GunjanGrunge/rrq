"""
FLUX.1 Krea Dev Portrait Generation Script
Runs on EC2 g4dn.xlarge — generates seed-locked presenter portraits.
Model: black-forest-labs/FLUX.1-Krea-dev (HuggingFace)

Usage:
  python generate_portraits.py
    --presenters_json  /tmp/presenters.json
    --output_dir       /tmp/output/
    --model_dir        /tmp/flux-krea-dev/
    --channel_id       channel_abc123
    --job_id           abc123

presenters.json format:
  [
    {
      "presenterId":    "presenter_f1",
      "seed":           2847361920,
      "base_prompt":    "Professional female presenter ...",
      "guidance_scale": 3.5,
      "num_steps":      50
    },
    ...
  ]

Writes per-presenter reference.jpg + portrait_preview.jpg + generation_metadata.json
to output_dir/{presenterId}/ and a manifest.json to output_dir.
S3 key format: avatars/dynamic/{channel_id}/{presenter_id}/reference.jpg
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import boto3
import torch
from diffusers import FluxPipeline
from PIL import Image


# ── CLI args ──────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FLUX.1 [dev] Portrait Generation")
    parser.add_argument("--presenters_json", required=True, help="Path to presenters JSON file")
    parser.add_argument("--output_dir", required=True, help="Output directory for portraits")
    parser.add_argument("--model_dir", required=True, help="Local path to FLUX.1 Krea Dev model directory")
    parser.add_argument("--channel_id", required=True, help="Channel ID for S3 key construction")
    parser.add_argument("--job_id", required=True, help="Portrait batch job ID for logging")
    return parser.parse_args()


# ── DynamoDB status helper ─────────────────────────────────────────────────────

def update_presenter_status(
    channel_id: str,
    presenter_id: str,
    portrait_status: str,
    error_msg: str = "",
) -> None:
    """Write portraitStatus back to DynamoDB so the orchestrator can poll."""
    region = os.environ.get("AWS_REGION", "us-east-1")
    dynamo = boto3.client("dynamodb", region_name=region)

    update_expr = "SET portraitStatus = :s, updatedAt = :t"
    expr_values = {
        ":s": {"S": portrait_status},
        ":t": {"S": datetime.now(timezone.utc).isoformat()},
    }

    if error_msg:
        update_expr += ", portraitError = :e"
        expr_values[":e"] = {"S": error_msg}

    try:
        dynamo.update_item(
            TableName="avatar-profiles",
            Key={
                "channelId": {"S": channel_id},
                "presenterId": {"S": presenter_id},
            },
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
    except Exception as exc:
        # Non-fatal — DynamoDB update failure should not crash inference
        print(f"[flux-portrait] WARNING: DynamoDB update failed for {presenter_id}: {exc}")


# ── Main inference ─────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    job_id = args.job_id
    channel_id = args.channel_id
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[flux-portrait][{job_id}] Loading presenters from {args.presenters_json}")
    with open(args.presenters_json, "r") as f:
        presenters = json.load(f)

    if not presenters:
        raise ValueError(f"[flux-portrait][{job_id}] No presenters found in {args.presenters_json}")

    print(f"[flux-portrait][{job_id}] {len(presenters)} portraits to generate")

    # ── Load pipeline ────────────────────────────────────────────────────────
    print(f"[flux-portrait][{job_id}] Loading FLUX.1 Krea Dev pipeline from {args.model_dir}")
    pipe = FluxPipeline.from_pretrained(
        args.model_dir,
        torch_dtype=torch.bfloat16,
        local_files_only=True,
    )
    # g4dn.xlarge has 16GB VRAM — FLUX.1 Krea Dev needs ~16GB.
    # enable_model_cpu_offload() moves layers to CPU when not in use.
    # Use standard offload (not sequential) — Krea Dev performs better with it.
    pipe.enable_model_cpu_offload()
    print(f"[flux-portrait][{job_id}] Pipeline loaded with model CPU offload")

    # ── Render loop ──────────────────────────────────────────────────────────
    portrait_records = []
    total_start_ms = int(time.time() * 1000)

    for presenter in presenters:
        presenter_id = presenter["presenterId"]
        seed = presenter["seed"]
        base_prompt = presenter["base_prompt"]
        guidance_scale = presenter.get("guidance_scale", 3.5)
        num_steps = presenter.get("num_steps", 50)

        presenter_out_dir = output_dir / presenter_id
        presenter_out_dir.mkdir(parents=True, exist_ok=True)

        reference_path = str(presenter_out_dir / "reference.jpg")
        preview_path = str(presenter_out_dir / "portrait_preview.jpg")
        metadata_path = str(presenter_out_dir / "generation_metadata.json")

        print(
            f"[flux-portrait][{job_id}] Rendering {presenter_id} "
            f"(seed={seed}, steps={num_steps}, guidance={guidance_scale})"
        )
        beat_start_ms = int(time.time() * 1000)

        # CPU seed for reproducibility across hardware — seed must be deterministic
        generator = torch.Generator(device="cpu").manual_seed(seed)

        image: Image.Image = pipe(
            prompt=base_prompt,
            num_inference_steps=num_steps,
            guidance_scale=guidance_scale,
            width=1024,
            height=1024,
            generator=generator,
        ).images[0]

        # Save full quality reference portrait
        image.save(reference_path, quality=95)

        # Save 512×512 thumbnail for approval gate UI
        image.resize((512, 512), Image.LANCZOS).save(preview_path, quality=85)

        beat_render_ms = int(time.time() * 1000) - beat_start_ms
        generated_at = datetime.now(timezone.utc).isoformat()

        # Write generation metadata audit trail
        metadata = {
            "presenterId": presenter_id,
            "seed": seed,
            "prompt": base_prompt,
            "guidance_scale": guidance_scale,
            "num_steps": num_steps,
            "width": 1024,
            "height": 1024,
            "generatedAt": generated_at,
        }
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        s3_key_base = f"avatars/dynamic/{channel_id}/{presenter_id}"
        portrait_records.append({
            "presenterId": presenter_id,
            "s3KeyReference": f"{s3_key_base}/reference.jpg",
            "s3KeyPreview": f"{s3_key_base}/portrait_preview.jpg",
            "s3KeyMetadata": f"{s3_key_base}/generation_metadata.json",
            "seed": seed,
            "generatedAt": generated_at,
        })

        print(f"[flux-portrait][{job_id}] Portrait {presenter_id} rendered in {beat_render_ms}ms")

        # Free VRAM between portraits
        torch.cuda.empty_cache()

        # Signal per-presenter completion to DynamoDB so orchestrator can poll
        update_presenter_status(channel_id, presenter_id, "rendered")

    total_render_ms = int(time.time() * 1000) - total_start_ms

    # ── Write manifest ────────────────────────────────────────────────────────
    manifest = {
        "jobId": job_id,
        "channelId": channel_id,
        "portraits": portrait_records,
        "totalRenderTimeMs": total_render_ms,
    }

    manifest_path = output_dir / "manifest.json"
    with open(str(manifest_path), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"[flux-portrait][{job_id}] Manifest written to {manifest_path}")
    print(
        f"[flux-portrait][{job_id}] All {len(portrait_records)} portraits complete "
        f"in {total_render_ms}ms"
    )


if __name__ == "__main__":
    main()
