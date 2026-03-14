"use client";

import { useState, useCallback } from "react";
import type { SSEProgressEvent } from "@/lib/pipeline-sse";

export interface StepProgressState {
  completedStages: number[];
  statusLine: string;
  isRunning: boolean;
}

export function useStepProgress() {
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [statusLine, setStatusLine] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const reset = useCallback(() => {
    setCompletedStages([]);
    setStatusLine("");
    setIsRunning(false);
  }, []);

  const consume = useCallback(async <T>(
    url: string,
    body: object,
    onResult: (data: T) => void,
    onError: (msg: string) => void,
  ): Promise<void> => {
    setIsRunning(true);
    setCompletedStages([]);
    setStatusLine("");

    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Unknown error");
        onError(text);
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event: SSEProgressEvent = JSON.parse(line.slice(5).trim());

            if (event.type === "stage_complete" && event.stageIndex !== undefined) {
              setCompletedStages(prev => [...prev, event.stageIndex!]);
            } else if (event.type === "status_line" && event.message) {
              setStatusLine(event.message);
            } else if (event.type === "result") {
              onResult(event.data as T);
              setIsRunning(false);
            } else if (event.type === "error") {
              onError(event.error ?? "Unknown error");
              setIsRunning(false);
              return;
            }
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Request failed");
      setIsRunning(false);
    }
  }, []);

  return { completedStages, statusLine, isRunning, consume, reset };
}
