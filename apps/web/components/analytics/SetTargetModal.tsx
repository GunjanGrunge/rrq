"use client";

import { useState, useEffect } from "react";
import {
  X, DollarSign, MessageSquare, Eye, TrendingUp, Users, Layers, Check, Send,
} from "lucide-react";

export type TargetType =
  | "REVENUE_GROWTH"
  | "MORE_COMMENTS"
  | "MORE_VIEWS"
  | "REVENUE_TARGET"
  | "SUBSCRIBER_TARGET"
  | "COMBINED";

export interface ChannelTarget {
  type: TargetType;
  value?: number;
}

interface TargetOption {
  type: TargetType;
  label: string;
  desc: string;
  icon: React.ElementType;
  hasInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

const OPTIONS: TargetOption[] = [
  {
    type: "REVENUE_GROWTH",
    label: "Revenue Growth",
    desc: "Increase channel revenue",
    icon: TrendingUp,
  },
  {
    type: "MORE_COMMENTS",
    label: "More Comments",
    desc: "Boost engagement per video",
    icon: MessageSquare,
  },
  {
    type: "MORE_VIEWS",
    label: "More Views",
    desc: "Promote video — get more views",
    icon: Eye,
  },
  {
    type: "REVENUE_TARGET",
    label: "Revenue Target",
    desc: "Hit a specific monthly goal",
    icon: DollarSign,
    hasInput: true,
    inputLabel: "$/month",
    inputPlaceholder: "e.g. 500",
  },
  {
    type: "SUBSCRIBER_TARGET",
    label: "Subscriber Target",
    desc: "Reach a subscriber milestone",
    icon: Users,
    hasInput: true,
    inputLabel: "subscribers",
    inputPlaceholder: "e.g. 10000",
  },
  {
    type: "COMBINED",
    label: "Combined",
    desc: "Revenue + Views together",
    icon: Layers,
  },
];

const AMBER = "#f5a623";
const MAX = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SetTargetModal({ open, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<TargetType[]>([]);
  const [inputValues, setInputValues] = useState<Partial<Record<TargetType, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load existing targets on open
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(null);
    fetch("/api/zeus/targets")
      .then((r) => r.json())
      .then((data) => {
        if (data.targets?.length) {
          setSelected(data.targets.map((t: ChannelTarget) => t.type));
          const vals: Partial<Record<TargetType, string>> = {};
          for (const t of data.targets as ChannelTarget[]) {
            if (t.value != null) vals[t.type] = String(t.value);
          }
          setInputValues(vals);
        }
      })
      .catch(() => {/* non-fatal */});
  }, [open]);

  function toggle(type: TargetType) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= MAX) {
        setError(`Max ${MAX} targets — deselect one first`);
        return prev;
      }
      return [...prev, type];
    });
  }

  async function handleSend() {
    setError(null);
    if (selected.length === 0) {
      setError("Select at least one target");
      return;
    }

    // Validate inputs
    for (const type of selected) {
      const opt = OPTIONS.find((o) => o.type === type);
      if (opt?.hasInput) {
        const raw = inputValues[type];
        if (!raw || isNaN(Number(raw)) || Number(raw) <= 0) {
          setError(`Enter a valid number for "${opt.label}"`);
          return;
        }
      }
    }

    const targets: ChannelTarget[] = selected.map((type) => {
      const opt = OPTIONS.find((o) => o.type === type)!;
      return opt.hasInput ? { type, value: Number(inputValues[type]) } : { type };
    });

    setSaving(true);
    try {
      const res = await fetch("/api/zeus/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to save targets");
        return;
      }
      setSaved(true);
      onSaved?.();
      setTimeout(onClose, 1200);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setSelected([]);
    setInputValues({});
    setError(null);
    setSaved(false);
    onClose();
  }

  if (!open) return null;

  const atMax = selected.length >= MAX;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-bg-base border border-bg-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-bg-border">
          <div>
            <p className="font-dm-mono text-[9px] tracking-[3px] uppercase" style={{ color: AMBER }}>
              Zeus Intelligence
            </p>
            <h2 className="font-syne font-bold text-lg text-text-primary mt-0.5">
              Set Channel Targets
            </h2>
            <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
              Zeus monitors + acts on these · max {MAX} targets
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-secondary transition-colors p-1 rounded-lg hover:bg-bg-surface"
          >
            <X size={16} />
          </button>
        </div>

        {/* Target grid */}
        <div className="px-6 pt-5 pb-2">
          <p className="font-dm-mono text-[9px] tracking-[2px] uppercase text-text-tertiary mb-3">
            Select up to {MAX} targets
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map((opt) => {
              const isSelected = selected.includes(opt.type);
              const isDimmed = atMax && !isSelected;

              return (
                <button
                  key={opt.type}
                  onClick={() => toggle(opt.type)}
                  className="relative text-left rounded-xl border p-4 transition-all duration-150"
                  style={{
                    borderColor: isSelected ? AMBER : isDimmed ? "#1a1a1a" : "#222222",
                    background: isSelected ? `${AMBER}0d` : isDimmed ? "#0d0d0d" : "#111111",
                    opacity: isDimmed ? 0.45 : 1,
                  }}
                >
                  {/* Check badge */}
                  {isSelected && (
                    <div
                      className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: AMBER }}
                    >
                      <Check size={9} className="text-bg-base" />
                    </div>
                  )}

                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center mb-2.5"
                    style={{
                      background: isSelected ? `${AMBER}20` : "#1a1a1a",
                      border: `1px solid ${isSelected ? AMBER + "40" : "#2a2a2a"}`,
                    }}
                  >
                    <opt.icon size={13} style={{ color: isSelected ? AMBER : "#6b6560" }} />
                  </div>

                  <div className="font-syne font-bold text-[11px] text-text-primary leading-tight">
                    {opt.label}
                  </div>
                  <div className="font-dm-mono text-[9px] text-text-tertiary mt-0.5 leading-snug">
                    {opt.desc}
                  </div>

                  {/* Inline input for value targets */}
                  {opt.hasInput && isSelected && (
                    <div
                      className="mt-3 flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5"
                      style={{ borderColor: `${AMBER}40`, background: "#0a0a0a" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {opt.type === "REVENUE_TARGET" && (
                        <span className="font-dm-mono text-[10px] text-text-tertiary">$</span>
                      )}
                      <input
                        type="number"
                        min={1}
                        placeholder={opt.inputPlaceholder}
                        value={inputValues[opt.type] ?? ""}
                        onChange={(e) =>
                          setInputValues((prev) => ({ ...prev, [opt.type]: e.target.value }))
                        }
                        className="w-full bg-transparent font-dm-mono text-[11px] text-text-primary outline-none placeholder:text-text-tertiary"
                      />
                      {opt.type === "SUBSCRIBER_TARGET" && (
                        <span className="font-dm-mono text-[9px] text-text-tertiary whitespace-nowrap">subs</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected tray */}
        {selected.length > 0 && (
          <div className="px-6 pt-4 pb-2">
            <p className="font-dm-mono text-[9px] tracking-[2px] uppercase text-text-tertiary mb-2">
              Selected — {selected.length}/{MAX}
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.map((type) => {
                const opt = OPTIONS.find((o) => o.type === type)!;
                const val = inputValues[type];
                return (
                  <div
                    key={type}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm-mono text-[10px]"
                    style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}30`, color: AMBER }}
                  >
                    <opt.icon size={9} />
                    {opt.label}
                    {val && (
                      <span className="text-text-tertiary">
                        · {opt.type === "REVENUE_TARGET" ? `$${val}/mo` : `${Number(val).toLocaleString()} subs`}
                      </span>
                    )}
                    <button
                      onClick={() => toggle(type)}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                    >
                      <X size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="px-6 pt-2 font-dm-mono text-[10px] text-red-400">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 mt-2 border-t border-bg-border">
          <button
            onClick={handleClose}
            disabled={saving}
            className="font-dm-mono text-[10px] tracking-widest uppercase text-text-tertiary hover:text-text-secondary transition-colors px-4 py-2 rounded-lg border border-bg-border hover:border-bg-border-hover disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={selected.length === 0 || saving || saved}
            className="flex items-center gap-2 font-dm-mono text-[10px] tracking-widest uppercase font-bold px-5 py-2 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: saved ? "#22c55e" : selected.length > 0 ? AMBER : "#2a2a2a",
              color: selected.length > 0 || saved ? "#0a0a0a" : "#6b6560",
            }}
          >
            {saved ? (
              <>
                <Check size={11} />
                Sent to Zeus
              </>
            ) : saving ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                Sending…
              </>
            ) : (
              <>
                <Send size={11} />
                Send to Zeus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
