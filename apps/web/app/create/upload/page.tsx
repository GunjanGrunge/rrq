"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePipelineStore, STEP_DOWNSTREAM } from "@/lib/pipeline-store";
import { StepFailureCard } from "@/components/pipeline/StepFailureCard";
import PipelineStepWaiting from "@/components/pipeline/PipelineStepWaiting";
import type { SEOOutput } from "@/lib/types/pipeline";
import type { AvSyncOutputType, ShortsGenOutputType } from "@rrq/lambda-types";
import { CheckCircle, Upload, Download, Copy, ExternalLink, RotateCcw } from "lucide-react";

const SUBTASK_LABELS = [
  "Upload Short — scheduled to go live 2–3 hours early",
  "Upload main video with full title, description, and tags",
  "Set the approved thumbnail",
  "Assign to the correct playlist",
  "Pin opening comment and post a community update",
  "Hand off to Zeus for ongoing performance monitoring",
];

interface UploadResult {
  youtube: {
    videoId: string;
    videoUrl: string;
    status: string;
    scheduledTime?: string;
    thumbnailSet: boolean;
    pinnedCommentId?: string;
  };
  short?: {
    videoId: string;
    videoUrl: string;
    status: string;
  };
  errors: string[];
  nextSteps: string[];
}

// ── Manual description copy panel ─────────────────────────────────────────────
function DescriptionPanel({ seoOutput }: { seoOutput: SEOOutput | undefined }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!seoOutput) return null;

  const chaptersText = (seoOutput.chapters ?? [])
    .map((c) => `${c.timestamp} ${c.title}`)
    .join("\n");

  const tagsText = (seoOutput.tags ?? []).join(", ");

  return (
    <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-bg-border">
        <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">
          Video Details — copy for manual upload
        </span>
      </div>
      <div className="divide-y divide-bg-border">
        {/* Title */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest">Title</span>
            <button
              onClick={() => copy(seoOutput.finalTitle ?? "", "title")}
              className="flex items-center gap-1 font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
            >
              {copied === "title" ? <CheckCircle size={11} className="text-accent-success" /> : <Copy size={11} />}
              {copied === "title" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="font-lora text-sm text-text-primary">{seoOutput.finalTitle}</p>
        </div>

        {/* Description */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest">Description</span>
            <button
              onClick={() => copy(seoOutput.description ?? "", "desc")}
              className="flex items-center gap-1 font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
            >
              {copied === "desc" ? <CheckCircle size={11} className="text-accent-success" /> : <Copy size={11} />}
              {copied === "desc" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="font-lora text-sm text-text-secondary leading-relaxed max-h-32 overflow-y-auto">
            {seoOutput.description}
          </p>
        </div>

        {/* Chapters */}
        {chaptersText && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest">Chapters</span>
              <button
                onClick={() => copy(chaptersText, "chapters")}
                className="flex items-center gap-1 font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
              >
                {copied === "chapters" ? <CheckCircle size={11} className="text-accent-success" /> : <Copy size={11} />}
                {copied === "chapters" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="font-dm-mono text-xs text-text-secondary whitespace-pre-wrap">{chaptersText}</pre>
          </div>
        )}

        {/* Tags */}
        {tagsText && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest">Tags</span>
              <button
                onClick={() => copy(tagsText, "tags")}
                className="flex items-center gap-1 font-dm-mono text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
              >
                {copied === "tags" ? <CheckCircle size={11} className="text-accent-success" /> : <Copy size={11} />}
                {copied === "tags" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="font-dm-mono text-xs text-text-secondary">{tagsText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload result view ─────────────────────────────────────────────────────────
function UploadResult({
  result,
  seoOutput,
  avSyncOutput,
  onRerun,
}: {
  result: UploadResult;
  seoOutput: SEOOutput | undefined;
  avSyncOutput: AvSyncOutputType | undefined;
  onRerun: () => void;
}) {
  const s3Key = avSyncOutput?.finalVideoS3Key;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-accent-success/10 border border-accent-success/30 flex items-center justify-center shrink-0">
          <CheckCircle size={18} className="text-accent-success" />
        </div>
        <div>
          <h1 className="font-syne text-2xl font-bold text-text-primary">Published to YouTube</h1>
          <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
            Your video is live and scheduled. Zeus is now monitoring performance.
          </p>
        </div>
      </div>

      {/* Video links */}
      <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-bg-border">
          <span className="font-dm-mono text-[10px] text-accent-primary tracking-widest uppercase">YouTube Links</span>
        </div>
        <div className="divide-y divide-bg-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <span className="font-dm-mono text-xs text-text-secondary block">Main Video</span>
              <span className="font-dm-mono text-xs text-text-primary">{result.youtube.videoId}</span>
            </div>
            <a
              href={result.youtube.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary hover:text-bg-base font-dm-mono text-[10px] transition-all duration-150 rounded"
            >
              <ExternalLink size={11} /> View
            </a>
          </div>
          {result.short?.videoId && (
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-dm-mono text-xs text-text-secondary block">Short</span>
                <span className="font-dm-mono text-xs text-text-primary">{result.short.videoId}</span>
              </div>
              <a
                href={result.short.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary hover:text-bg-base font-dm-mono text-[10px] transition-all duration-150 rounded"
              >
                <ExternalLink size={11} /> View
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Errors if any */}
      {result.errors.length > 0 && (
        <div className="bg-accent-warning/5 border border-accent-warning/30 rounded-md p-4">
          <span className="font-dm-mono text-[10px] text-accent-warning tracking-widest uppercase block mb-2">
            Non-critical warnings
          </span>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="font-dm-mono text-xs text-text-secondary">· {e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onRerun}
          className="flex items-center gap-1.5 font-dm-mono text-[11px] text-text-tertiary hover:text-accent-primary transition-colors"
        >
          <RotateCcw size={11} /> Re-upload
        </button>
      </div>
    </div>
  );
}

// ── Pre-upload manual panel ────────────────────────────────────────────────────
function ManualUploadPanel({
  seoOutput,
  avSyncOutput,
  onAutoUpload,
  uploading,
}: {
  seoOutput: SEOOutput | undefined;
  avSyncOutput: AvSyncOutputType | undefined;
  onAutoUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-syne text-2xl font-bold text-text-primary">Ready to Publish</h1>
        <p className="font-lora text-sm text-text-secondary mt-1 leading-relaxed">
          Upload automatically via your connected YouTube account, or download the video and details to upload yourself.
        </p>
      </div>

      {/* Auto-upload button */}
      <button
        onClick={onAutoUpload}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-accent-primary text-bg-base font-syne font-bold text-sm tracking-wider rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
            Uploading to YouTube…
          </>
        ) : (
          <>
            <Upload size={15} />
            UPLOAD TO YOUTUBE AUTOMATICALLY
          </>
        )}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-bg-border" />
        <span className="font-dm-mono text-[10px] text-text-tertiary">or upload manually</span>
        <div className="flex-1 h-px bg-bg-border" />
      </div>

      {avSyncOutput?.finalVideoS3Key && (
        <div className="bg-bg-surface border border-bg-border rounded-md p-4 flex items-center justify-between">
          <div>
            <p className="font-syne text-sm font-bold text-text-primary">Final Video</p>
            <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5 truncate max-w-xs">
              {avSyncOutput.finalVideoS3Key}
            </p>
          </div>
          <span className="font-dm-mono text-[10px] text-text-tertiary">
            Available in your S3 bucket
          </span>
        </div>
      )}

      <DescriptionPanel seoOutput={seoOutput} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const { outputs, jobId, stepStatuses, setStep, setStepOutput, setStepStatus, rerunStep } =
    usePipelineStore();
  const router = useRouter();
  const hasRun = useRef(false);

  const [subTasksDone, setSubTasksDone] = useState<boolean[]>([false, false, false, false, false, false]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(true);

  useEffect(() => { setStep(13); }, [setStep]);

  const uploadResult = outputs[13] as UploadResult | undefined;
  const seoOutput = outputs[3] as SEOOutput | undefined;
  const avSyncOutput = outputs[10] as AvSyncOutputType | undefined;
  const shortsOutput = outputs[12] as ShortsGenOutputType | undefined;

  // If output exists, stay on page and show result
  useEffect(() => {
    if (uploadResult) {
      if (stepStatuses[13] !== "complete") setStepStatus(13, "complete");
      setShowManual(false);
    }
  }, [uploadResult]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runUpload() {
    if (!jobId || uploading) return;
    hasRun.current = true;
    setUploading(true);
    setShowManual(false);
    setError(null);
    setStepStatus(13, "running");
    setSubTasksDone([false, false, false, false, false, false]);

    try {
      const res = await fetch("/api/pipeline/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, seoOutput, avSyncOutput, shortsOutput }),
      });

      if (!res.ok || !res.body) throw new Error(`Upload API returned ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string; stageIndex?: number; message?: string; data?: unknown; error?: string;
            };
            if (event.type === "stage_complete" && typeof event.stageIndex === "number") {
              setSubTasksDone((prev) => {
                const next = [...prev];
                next[event.stageIndex!] = true;
                return next;
              });
            }
            if (event.type === "result") {
              setStepOutput(13, event.data);
              setStepStatus(13, "complete");
              setUploading(false);
              setShowManual(false);
            }
            if (event.type === "error") throw new Error(event.error ?? "Upload failed");
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      setStepStatus(13, "error");
      setUploading(false);
      setShowManual(true);
    }
  }

  if (error || (stepStatuses[13] === "error" && !uploading)) {
    return (
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6">
        <StepFailureCard
          stepNumber={13}
          stepLabel="Upload"
          errorMessage={error ?? "Upload failed."}
          showDownstreamWarning={false}
          downstreamCount={0}
          onRerunStep={() => {
            rerunStep(13);
            hasRun.current = false;
            setError(null);
            setSubTasksDone([false, false, false, false, false, false]);
            setShowManual(true);
          }}
        />
        {/* Still show manual copy panel on error */}
        <DescriptionPanel seoOutput={seoOutput} />
      </div>
    );
  }

  if (uploadResult && !showManual) {
    return (
      <UploadResult
        result={uploadResult}
        seoOutput={seoOutput}
        avSyncOutput={avSyncOutput}
        onRerun={() => {
          rerunStep(13);
          hasRun.current = false;
          setSubTasksDone([false, false, false, false, false, false]);
          setShowManual(true);
        }}
      />
    );
  }

  if (uploading) {
    return (
      <PipelineStepWaiting
        stepNumber={13}
        title="Publishing to YouTube"
        description="Your Short and main video are being uploaded to your connected YouTube channel. All metadata — title, description, tags, thumbnail, and playlist — is applied from the SEO step."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        }
        subTasks={SUBTASK_LABELS.map((label, i) => ({ label, done: subTasksDone[i] }))}
        estimatedTime="~2 minutes"
      />
    );
  }

  return (
    <ManualUploadPanel
      seoOutput={seoOutput}
      avSyncOutput={avSyncOutput}
      onAutoUpload={runUpload}
      uploading={uploading}
    />
  );
}
