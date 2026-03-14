import { fork } from "child_process"; // eslint-disable-line security/detect-child-process -- intentional sandboxed execution
import { writeFileSync, unlinkSync } from "fs";
import { ALLOWED_DOMAINS } from "./allowlist";

export interface SandboxResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionMs: number;
}

/**
 * Execute Haiku-generated JavaScript in an isolated child process.
 *
 * Isolation layers:
 * 1. Separate OS process (child_process.fork) — crash isolation, memory isolation
 * 2. No AWS credentials in child env — cannot call AWS
 * 3. fetch() patched with domain allowlist — outbound HTTP restricted
 * 4. --disallow-code-generation-from-strings — blocks eval / new Function
 * 5. Hard SIGKILL after timeoutMs — cannot be caught or deferred
 * 6. Lambda microVM = primary network isolation boundary
 *
 * Generated code contract:
 * - No import/require statements (runs in clean Node context)
 * - Returns results via process.send({ success: true, output: <serializable> })
 * - On error: process.send({ success: false, error: "<message>" })
 */
export async function executeSandboxed(
  generatedCode: string,
  context: Record<string, unknown>,
  timeoutMs: number = 30_000
): Promise<SandboxResult> {
  const startMs = Date.now();
  const workerPath = `/tmp/tony-worker-${Date.now()}-${Math.random().toString(36).slice(2)}.js`;

  // Build the worker file: context + allowlist patch + generated code
  const workerSource = buildWorkerSource(generatedCode, context);
  writeFileSync(workerPath, workerSource, "utf8");

  return new Promise((resolve) => {
    const child = fork(workerPath, [], {
      env: {
        // Minimal env — no AWS credentials, no secrets
        NODE_ENV: "sandbox",
        PATH: process.env.PATH ?? "",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      execArgv: ["--disallow-code-generation-from-strings"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      cleanup(workerPath);
      resolve({
        success: false,
        error: `TONY sandbox timeout after ${timeoutMs}ms`,
        executionMs: Date.now() - startMs,
      });
    }, timeoutMs);

    // Capture stderr for debugging
    child.stderr?.on("data", (data: Buffer) => {
      console.warn(`[tony-sandbox] stderr: ${data.toString().slice(0, 200)}`);
    });

    child.on("message", (msg: { success: boolean; output?: unknown; error?: string }) => {
      clearTimeout(timer);
      child.kill("SIGKILL");
      cleanup(workerPath);
      resolve({
        success: msg.success,
        output: msg.output,
        error: msg.error,
        executionMs: Date.now() - startMs,
      });
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      cleanup(workerPath);
      if (code !== 0 && code !== null) {
        resolve({
          success: false,
          error: `TONY worker exited with code ${code}`,
          executionMs: Date.now() - startMs,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      cleanup(workerPath);
      resolve({
        success: false,
        error: `TONY worker spawn error: ${err.message}`,
        executionMs: Date.now() - startMs,
      });
    });
  });
}

function buildWorkerSource(generatedCode: string, context: Record<string, unknown>): string {
  // Inject context as frozen constants — code cannot reassign them
  const contextInjection = Object.entries(context)
    .map(([k, v]) => {
      const safe = JSON.stringify(v);
      return `const ${k} = Object.freeze(${safe});`;
    })
    .join("\n");

  // Serialize allowlist for injection into worker (no require allowed in sandbox)
  const allowedDomainsJson = JSON.stringify(ALLOWED_DOMAINS);

  return `
"use strict";

// ── Context variables (frozen, injected by TONY) ──────────────────────────
${contextInjection}

// ── fetch() allowlist patch ───────────────────────────────────────────────
const _TONY_ALLOWED = ${allowedDomainsJson};
const _originalFetch = globalThis.fetch;
globalThis.fetch = async function(url, opts) {
  let hostname;
  try { hostname = new URL(String(url)).hostname; } catch { throw new Error("TONY: invalid URL: " + url); }
  const allowed = _TONY_ALLOWED.some(d => hostname === d || hostname.endsWith("." + d));
  if (!allowed) throw new Error("TONY: blocked domain: " + hostname + " (not in allowlist)");
  return _originalFetch(url, opts);
};

// ── Agent-generated code ──────────────────────────────────────────────────
${generatedCode}
`;
}

function cleanup(workerPath: string): void {
  try { unlinkSync(workerPath); } catch { /* best-effort */ }
}
