"use client";

import { UserButton } from "@clerk/nextjs";
import { Settings, Menu } from "lucide-react";
import Link from "next/link";
import PipelineProgress from "./PipelineProgress";
import BellNotification from "./BellNotification";
import { useUIStore } from "@/lib/ui-store";

export default function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="h-14 bg-bg-base border-b border-bg-border flex items-center px-6 justify-between shrink-0 z-40">
      {/* Mobile: hamburger */}
      <button
        onClick={toggleSidebar}
        className="md:hidden mr-3 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={18} />
      </button>

      {/* Left: Wordmark */}
      <Link href="/home" className="flex items-center gap-2 group">
        <div className="w-1.5 h-1.5 bg-accent-primary group-hover:scale-110 transition-transform duration-200 shrink-0" />
        <span className="font-syne font-bold text-sm text-text-primary tracking-[0.25em] uppercase">
          RRQ
        </span>
      </Link>

      {/* Centre: Pipeline progress */}
      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
        <PipelineProgress />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="text-text-secondary hover:text-text-primary transition-colors duration-200"
          title="Settings"
        >
          <Settings size={16} />
        </Link>
        <BellNotification />
        <UserButton
          appearance={{
            elements: {
              avatarBox:
                "w-7 h-7 ring-1 ring-bg-border hover:ring-accent-primary transition-all duration-200",
            },
          }}
        />
      </div>
    </header>
  );
}
