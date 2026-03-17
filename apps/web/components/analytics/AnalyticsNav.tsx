"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Shield } from "lucide-react";

const TABS = [
  { label: "Channel", href: "/analytics/channel", icon: BarChart3 },
  { label: "Agents", href: "/analytics/agents", icon: Bot },
  { label: "Policies", href: "/analytics/policies", icon: Shield },
];

export default function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-bg-border px-6 bg-bg-base sticky top-0 z-10">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              flex items-center gap-2 px-4 py-3.5 text-xs font-dm-mono tracking-widest uppercase
              border-b-2 transition-all duration-200
              ${active
                ? "border-accent-primary text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-bg-border-hover"
              }
            `}
          >
            <Icon size={13} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
