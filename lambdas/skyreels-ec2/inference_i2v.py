"""
SkyReels V2 I2V Inference Script
=================================
Runs on EC2 g5.12xlarge spot instance (4× NVIDIA A10G, 96GB VRAM total).

Usage:
  python inference_i2v.py
    --beats_json    /tmp/beats.json
    --reference_image /tmp/avatar/reference.jpg
    --audio_dir     /tmp/audio/
    --output_dir    /tmp/output/
    --resolution    720p
    --job_id        abc123

Writes per-beat MP4 segments + manifest.json to --output_dir.
The bootstrap script pushes output_dir to S3 after this exits.

Model: SkyReels-V2-I2V-14B-720P
  Weights: /tmp/skyreels-v2/SkyReels-V2-I2V-14B-720P/
  Checkpoint structure mirrors Hugging Face diffusers layout.
"""

import argparse
import json
import os
import time
import subprocess
from pathlib import Path

import torch
from diffusers import CogVideoXImageToVideoPipeline
from diffusers.utils import load_image, export_to_video
from PIL import Image


# ─── Resolution map ──────────────────────────────────────────────────────────

RESOLUTION_MAP = {
    "720p":  (1280, 720),
    "1080p": (1920, 1080),
}

# ─── Expression hint weighting ───────────────────────────────────────────────
# SkyReels V2 uses negative/positive prompt structure for expression control.
# These map voice cue → additional positive prompt fragments.

EXPRESSION_PROMPTS = {
    "curious anticipation, slight brow raise":   "eyebrows slightly raised, curious expression, anticipatory look",
    "confident assertion, direct eye contact":   "confident gaze, direct eye contact, assertive expression",
    "reflective pause, slight head tilt":        "thoughtful expression, slight head tilt, reflective pause",
    "conversational warmth, gentle smile":       "warm smile, friendly expression, natural conversational tone",
    "open curiosity, questioning brow":          "questioning expression, raised eyebrow, open curious look",
    "shift energy, brief neutral reset":         "neutral expression, slight pause, energetic reset",
    "focused intensity on single word":          "intense focused expression, direct gaze, emphasis",
}


# ─── Audio duration helper ────────────────────────────────────────────────────

def get_audio_duration_ms(audio_path: str) -> int:
    """Use ffprobe to get precise audio duration in milliseconds."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", audio_path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    info = json.loads(result.stdout)
    duration_s = float(info["streams"][0]["duration"])
    return int(duration_s * 1000)


# ─── Main inference loop ──────────────────────────────────────────────────────

def run_inference(
    beats: list[dict],
    reference_image_path: str,
    audio_dir: str,
    output_dir: str,
    model_dir: str,
    resolution: tuple[int, int],
    job_id: str,
) -> list[dict]:
    """
    Run SkyReels V2 I2V for each beat in sequence.
    Returns list of segment metadata written to manifest.json.
    """

    print(f"[skyreels][{job_id}] Loading model from {model_dir}...")
    start_load = time.time()

    pipe = CogVideoXImageToVideoPipeline.from_pretrained(
        model_dir,
        torch_dtype=torch.float16,
    )
    pipe.enable_model_cpu_offload()
    pipe.enable_vae_slicing()
    pipe.enable_vae_tiling()

    load_time = time.time() - start_load
    print(f"[skyreels][{job_id}] Model loaded in {load_time:.1f}s")

    reference_image = load_image(reference_image_path)
    width, height = resolution
    segments = []

    for i, beat in enumerate(beats):
        section_id = beat["sectionId"]
        audio_s3_key = beat["audioS3Key"]
        cue_map = beat.get("cueMap", [])

        # Audio file is already local — pulled by bootstrap
        audio_filename = Path(audio_s3_key).name
        audio_path = os.path.join(audio_dir, audio_filename)

        if not os.path.exists(audio_path):
            print(f"[skyreels][{job_id}] WARNING: audio not found at {audio_path}, skipping beat {section_id}")
            continue

        duration_ms = get_audio_duration_ms(audio_path)
        # SkyReels generates at 8fps by default; num_frames drives duration
        fps = 24
        num_frames = max(8, int((duration_ms / 1000) * fps))

        # Build expression hint from the dominant cue in this beat
        expression_hint = ""
        if cue_map:
            # Use cue at the midpoint of the beat as dominant expression
            mid_cue = cue_map[len(cue_map) // 2]
            expression_hint = mid_cue.get("expressionHint", "")

        positive_prompt = (
            "A professional YouTube presenter speaking to camera, "
            "cinematic lighting, sharp focus, 720p quality"
        )
        if expression_hint and expression_hint in EXPRESSION_PROMPTS:
            positive_prompt += ", " + EXPRESSION_PROMPTS[expression_hint]

        negative_prompt = (
            "blurry, distorted, deformed face, low quality, "
            "multiple people, text overlay, watermark"
        )

        print(f"[skyreels][{job_id}] Rendering beat {i+1}/{len(beats)}: {section_id} ({duration_ms}ms, {num_frames} frames)")

        beat_start = time.time()

        # SkyReels V2 I2V inference
        # Note: conditioning_frame_scale controls how strongly the reference image anchors identity
        output = pipe(
            image=reference_image,
            prompt=positive_prompt,
            negative_prompt=negative_prompt,
            height=height,
            width=width,
            num_frames=num_frames,
            num_inference_steps=50,
            guidance_scale=6.0,
            generator=torch.Generator(device="cuda").manual_seed(42 + i),
        )

        frames = output.frames[0]
        segment_filename = f"{section_id}.mp4"
        segment_path = os.path.join(output_dir, segment_filename)

        export_to_video(frames, segment_path, fps=fps)

        beat_time_ms = int((time.time() - beat_start) * 1000)
        print(f"[skyreels][{job_id}] Beat {section_id} rendered in {beat_time_ms}ms")

        segments.append({
            "sectionId": section_id,
            # S3 key will be set by bootstrap after upload
            "s3Key": f"jobs/{job_id}/segments/skyreels/{segment_filename}",
            "durationMs": duration_ms,
            "resolution": f"{width}x{height}",
            "renderTimeMs": beat_time_ms,
        })

        # Free GPU memory between beats
        torch.cuda.empty_cache()

    return segments


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--beats_json",       required=True)
    parser.add_argument("--reference_image",  required=True)
    parser.add_argument("--audio_dir",        required=True)
    parser.add_argument("--output_dir",       required=True)
    parser.add_argument("--resolution",       default="720p")
    parser.add_argument("--job_id",           required=True)
    parser.add_argument(
        "--model_dir",
        default="/tmp/skyreels-v2/SkyReels-V2-I2V-14B-720P",
    )
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    with open(args.beats_json) as f:
        beats = json.load(f)

    resolution = RESOLUTION_MAP.get(args.resolution, (1280, 720))

    total_start = time.time()
    segments = run_inference(
        beats=beats,
        reference_image_path=args.reference_image,
        audio_dir=args.audio_dir,
        output_dir=args.output_dir,
        model_dir=args.model_dir,
        resolution=resolution,
        job_id=args.job_id,
    )

    total_time_ms = int((time.time() - total_start) * 1000)
    total_duration_ms = sum(s["durationMs"] for s in segments)

    manifest = {
        "jobId": args.job_id,
        "segments": segments,
        "totalDurationMs": total_duration_ms,
        "renderTimeMs": total_time_ms,
        "model": "SkyReels-V2-I2V-14B-720P",
        "resolution": args.resolution,
    }

    manifest_path = os.path.join(args.output_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"[skyreels][{args.job_id}] All {len(segments)} beats complete in {total_time_ms}ms")
    print(f"[skyreels][{args.job_id}] Manifest written to {manifest_path}")


if __name__ == "__main__":
    main()
