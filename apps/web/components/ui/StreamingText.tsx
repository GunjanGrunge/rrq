"use client";

import { useEffect, useRef, useState } from "react";

interface StreamingTextProps {
  content: string;
  speed?: number; // ms per character
  onComplete?: () => void;
  className?: string;
}

export default function StreamingText({
  content,
  speed = 20,
  onComplete,
  className = "",
}: StreamingTextProps) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");

    const tick = () => {
      if (indexRef.current < content.length) {
        indexRef.current += 1;
        setDisplayed(content.slice(0, indexRef.current));
        timerRef.current = setTimeout(tick, speed);
      } else {
        onComplete?.();
      }
    };

    timerRef.current = setTimeout(tick, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, speed, onComplete]);

  return (
    <span className={`text-script ${className}`}>
      {displayed}
      {displayed.length < content.length && (
        <span className="inline-block w-0.5 h-4 bg-accent-primary ml-0.5 animate-pulse" />
      )}
    </span>
  );
}
