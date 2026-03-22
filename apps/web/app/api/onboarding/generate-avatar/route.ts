import { auth } from "@clerk/nextjs/server";
import { runFluxPortraitBatch } from "@/lib/video-pipeline/flux-portrait";
import { getS3Client } from "@/lib/aws-clients";
import { CopyObjectCommand } from "@aws-sdk/client-s3";

const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "rrq-content-fa-gunjansarkar-contentfactoryassetsbucket-srcbvfzu";

/**
 * One-time onboarding endpoint — generates avatar portraits via Replicate Flux.
 * Uploads to avatars/dynamic/{channelId}/{presenterId}/reference.jpg (flux-portrait path)
 * then copies to avatars/{presenterId}/reference.jpg (SkyReels canonical path).
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobId = body.jobId ?? `onboarding-${Date.now()}`;
  const channelId = body.channelId ?? userId;
  const presenterId = body.presenterId ?? "avatar_1";
  const seed = body.seed ?? 42;
  const prompt = body.prompt ??
    "Professional female presenter, 30s, confident warm expression, studio lighting, " +
    "clean background, front-facing, sharp focus, photorealistic portrait";

  try {
    const output = await runFluxPortraitBatch({
      channelId,
      jobId,
      presenters: [{ presenterId, seed, base_prompt: prompt }],
    });

    // Copy to canonical path that SkyReels expects: avatars/{presenterId}/reference.jpg
    const s3 = getS3Client();
    const dynamicKey = `avatars/dynamic/${channelId}/${presenterId}/reference.jpg`;
    const canonicalKey = `avatars/${presenterId}/reference.jpg`;

    await s3.send(new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${dynamicKey}`,
      Key: canonicalKey,
    }));

    console.log(`[onboarding/generate-avatar] Copied ${dynamicKey} → ${canonicalKey}`);

    return Response.json({ success: true, data: output, canonicalKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[onboarding/generate-avatar:${userId}] Failed:`, message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
