/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 infrastructure for RRQ Content Factory Lambda workers.
 *
 * Heavy Lambdas (av-sync, research-visual, visual-gen) → container images via ECR
 * Light Lambdas (audio-gen, shorts-gen, uploader) → standard zip bundles
 */
export default $config({
  app(input) {
    return {
      name: "rrq-content-factory",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },

  async run() {
    // ── Shared Resources ──────────────────────────────────────────────

    const assetsBucket = new sst.aws.Bucket("ContentFactoryAssets", {
      access: "private",
    });

    const memoryBucket = new sst.aws.Bucket("RrqMemory", {
      access: "private",
    });

    // ── Shared environment variables for all Lambdas ──────────────────

    const sharedEnv = {
      S3_BUCKET_NAME: assetsBucket.name,
      RRQ_MEMORY_BUCKET: memoryBucket.name,
      AWS_REGION_OVERRIDE: "us-east-1",
    };

    // ── Public Lambda Layers for native binaries ─────────────────────
    // FFmpeg 7.0.2 static build — our own layer in us-east-1
    // Binaries at: /opt/ffmpeg + /opt/ffprobe (zipped without /bin/ subdirectory)
    const ffmpegLayerArn = "arn:aws:lambda:us-east-1:751289209169:layer:ffmpeg-static:1";

    // ── Light Lambdas (zip deploy) ───────────────────────────────────
    // handler paths are relative to the project root (one level above infra/)

    const audioGen = new sst.aws.Function("AudioGen", {
      handler: "../lambdas/audio-gen/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        ...sharedEnv,
        ELEVENLABS_KEY_1: process.env.ELEVENLABS_KEY_1 ?? "",
        ELEVENLABS_KEY_2: process.env.ELEVENLABS_KEY_2 ?? "",
        ELEVENLABS_KEY_3: process.env.ELEVENLABS_KEY_3 ?? "",
        ELEVENLABS_KEY_4: process.env.ELEVENLABS_KEY_4 ?? "",
      },
      link: [assetsBucket],
    });

    const shortsGen = new sst.aws.Function("ShortsGen", {
      handler: "../lambdas/shorts-gen/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "10 minutes",
      memory: "1024 MB",
      environment: {
        ...sharedEnv,
        FFMPEG_PATH: "/opt/ffmpeg",
        FFPROBE_PATH: "/opt/ffprobe",
      },
      layers: [ffmpegLayerArn],
      link: [assetsBucket],
    });

    const uploader = new sst.aws.Function("Uploader", {
      handler: "../lambdas/uploader/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        ...sharedEnv,
        YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? "",
        YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ?? "",
        YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI ?? "",
      },
      link: [assetsBucket],
      permissions: [
        {
          actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
          resources: [
            `arn:aws:dynamodb:us-east-1:751289209169:table/user-tokens`,
          ],
        },
      ],
    });

    // ── Heavy Lambdas (container deploy) ─────────────────────────────
    // NOTE: These require Docker Desktop to be installed and running.
    // Run: npm run infra:deploy:containers once Docker is available.

    // @sparticuz/chromium packages its own binary — no separate layer needed
    // (chromium binary is bundled with the npm package at node_modules level)

    const avSync = new sst.aws.Function("AvSync", {
      handler: "../lambdas/av-sync/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "15 minutes",
      memory: "3008 MB",
      environment: {
        ...sharedEnv,
        FFMPEG_PATH: "/opt/ffmpeg",
        FFPROBE_PATH: "/opt/ffprobe",
      },
      layers: [ffmpegLayerArn],
      link: [assetsBucket],
    });

    const researchVisual = new sst.aws.Function("ResearchVisual", {
      handler: "../lambdas/research-visual/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "2048 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    const visualGen = new sst.aws.Function("VisualGen", {
      handler: "../lambdas/visual-gen/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "10 minutes",
      memory: "3008 MB",
      environment: {
        ...sharedEnv,
        FFMPEG_PATH: "/opt/ffmpeg",
        FFPROBE_PATH: "/opt/ffprobe",
        // Pre-built Remotion bundle in S3 — avoids bundling at runtime (no @remotion/bundler needed)
        // Build with: npm run build:remotion-bundle from repo root
        // Upload to: s3://content-factory-assets/remotion-bundle/bundle.zip
        REMOTION_BUNDLE_S3_KEY: "remotion-bundle/bundle.zip",
      },
      layers: [ffmpegLayerArn],
      link: [assetsBucket],
      // @remotion/renderer uses native .node binaries — install as-is, not inlined by esbuild
      // @remotion/bundler / @rspack are excluded: Lambda downloads the pre-built bundle from S3
      // (REMOTION_BUNDLE_S3_KEY) so bundler is never called at runtime
      nodejs: {
        install: [
          "@remotion/renderer",
        ],
        esbuild: {
          external: [
            "@remotion/bundler",
            "@rspack/core",
            "@rspack/binding",
            "@rspack/binding-linux-x64-gnu",
            "@rspack/binding-darwin-arm64",
          ],
        },
      },
    });

    // ── TONY — Code Agent Lambda ──────────────────────────────────────

    const codeAgent = new sst.aws.Function("CodeAgent", {
      handler: "../lambdas/code-agent/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "2 minutes",
      memory: "2048 MB",
      environment: {
        ...sharedEnv,
        LAMBDA_CODE_AGENT: "rrq-code-agent",
      },
      link: [assetsBucket],
      permissions: [
        {
          actions: ["bedrock:InvokeModel"],
          resources: ["arn:aws:bedrock:us-east-1::foundation-model/*"],
        },
      ],
    });

    return {
      audioGenArn: audioGen.arn,
      shortsGenArn: shortsGen.arn,
      uploaderArn: uploader.arn,
      avSyncArn: avSync.arn,
      researchVisualArn: researchVisual.arn,
      visualGenArn: visualGen.arn,
      codeAgentArn: codeAgent.arn,
      assetsBucketName: assetsBucket.name,
      memoryBucketName: memoryBucket.name,
    };
  },
});
