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

    // ── Light Lambdas (zip deploy) ───────────────────────────────────

    const audioGen = new sst.aws.Function("AudioGen", {
      handler: "lambdas/audio-gen/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    const shortsGen = new sst.aws.Function("ShortsGen", {
      handler: "lambdas/shorts-gen/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "10 minutes",
      memory: "1024 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    const uploader = new sst.aws.Function("Uploader", {
      handler: "lambdas/uploader/src/handler.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    // ── Heavy Lambdas (container deploy) ─────────────────────────────

    const avSync = new sst.aws.Function("AvSync", {
      handler: "lambdas/av-sync/src/handler.handler",
      runtime: "container",
      timeout: "15 minutes",
      memory: "3008 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    const researchVisual = new sst.aws.Function("ResearchVisual", {
      handler: "lambdas/research-visual/src/handler.handler",
      runtime: "container",
      timeout: "5 minutes",
      memory: "2048 MB",
      environment: sharedEnv,
      link: [assetsBucket],
    });

    const visualGen = new sst.aws.Function("VisualGen", {
      handler: "lambdas/visual-gen/src/handler.handler",
      runtime: "container",
      timeout: "10 minutes",   // Remotion bundle on cold start needs extra headroom
      memory: "3008 MB",       // Remotion webpack bundling requires extra memory
      environment: {
        ...sharedEnv,
        REMOTION_BUNDLE_PATH: "/opt/remotion-bundle",  // pre-baked in Docker, skips bundle() on warm
      },
      link: [assetsBucket],
    });

    // ── TONY — Code Agent Lambda ──────────────────────────────────────
    // Sandboxed JS execution engine called by MUSE, REX, REGUM, ORACLE.
    // runtime: container — needs Puppeteer for scrape outputType tasks.
    // IAM: S3 PutObject to jobs/{jobId}/tony/ only — no other AWS permissions.

    const codeAgent = new sst.aws.Function("CodeAgent", {
      handler: "lambdas/code-agent/src/handler.handler",
      runtime: "container",
      timeout: "1 minute",   // 30s sandbox + 15s Haiku gen + buffer
      memory: "1024 MB",
      environment: {
        ...sharedEnv,
        LAMBDA_CODE_AGENT: "rrq-code-agent",
      },
      link: [assetsBucket],
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
