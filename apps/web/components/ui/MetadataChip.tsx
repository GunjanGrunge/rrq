"use client";

import { X } from "lucide-react";

interface MetadataChipProps {
  label: string;
  variant?: "keyword" | "tag" | "category";
  removable?: boolean;
  onRemove?: () => void;
}

const VARIANT_STYLES = {
  keyword: "border-bg-border-hover text-text-secondary hover:border-accent-primary hover:text-accent-primary",
  tag: "border-accent-info/40 text-accent-info",
  category: "border-accent-primary/40 text-accent-primary",
};

export default function MetadataChip({
  label,
  variant = "keyword",
  removable = false,
  onRemove,
}: MetadataChipProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-sm
        border font-dm-mono text-[11px] tracking-wide
        transition-all duration-150
        ${VARIANT_STYLES[variant]}
      `}
    >
      <span>{label}</span>
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
