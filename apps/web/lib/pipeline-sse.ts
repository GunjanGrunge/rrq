export interface SSEProgressEvent {
  type: "stage_complete" | "status_line" | "result" | "error";
  stageIndex?: number;
  message?: string;
  data?: unknown;
  error?: string;
}

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const emit = (event: SSEProgressEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const done = () => {
    try { controller.close(); } catch { /* already closed */ }
  };

  return { stream, emit, done };
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
