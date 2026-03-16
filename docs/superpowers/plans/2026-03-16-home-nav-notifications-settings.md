# Home Page, Navigation, Bell Notifications & Settings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a home/dashboard page, bell notification dropdown, wired settings page, and clean up header navigation so authenticated users have a complete navigation hub.

**Architecture:** Extract `STEP_SLUGS`/`STEPS` to a shared lib file, then build 4 new/modified files (home page, settings page, bell component, inbox deep-link) plus edit the header. All routes are already protected by existing middleware allowlist pattern — no middleware changes needed.

**Tech Stack:** Next.js 14 App Router, Clerk v7, Zustand (`useNotificationStore`, `usePipelineStore`), Tailwind CSS, `lucide-react`, `font-syne`/`font-dm-mono` tokens

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/lib/pipeline-steps.ts` | CREATE | Shared `STEP_SLUGS` + `STEPS` exports |
| `apps/web/app/(app)/home/page.tsx` | CREATE | Dashboard hub: Studio hero, nav cards, LIVE NOW feed |
| `apps/web/app/(app)/settings/page.tsx` | CREATE | Profile edit, plan upgrade placeholders, sign out |
| `apps/web/components/layout/BellNotification.tsx` | CREATE | Bell icon + unread badge + notification dropdown |
| `apps/web/components/layout/Header.tsx` | EDIT | Remove History button, wire Settings link, add Bell, wordmark → `/home` |
| `apps/web/components/layout/PipelineProgress.tsx` | EDIT | Delete local `STEP_SLUGS`/`STEPS`, import from lib |
| `apps/web/app/(app)/inbox/page.tsx` | EDIT | Add `InboxDeepLink` child + `<Suspense>` for `?message=` param |
| `apps/web/middleware.ts` | CONFIRM ONLY | Already protects `/home` and `/settings` — no change |

---

## Chunk 1: Shared Pipeline Steps Lib + PipelineProgress Update

### Task 1: Create `apps/web/lib/pipeline-steps.ts`

**Files:**
- Create: `apps/web/lib/pipeline-steps.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/lib/pipeline-steps.ts

export const STEPS = [
  { number: 1, label: "Research" },
  { number: 2, label: "Script" },
  { number: 3, label: "SEO" },
  { number: 4, label: "Quality" },
  { number: 5, label: "Audio" },
  { number: 6, label: "Avatar" },
  { number: 7, label: "B-Roll" },
  { number: 8, label: "Images" },
  { number: 9, label: "Visuals" },
  { number: 10, label: "AV Sync" },
  { number: 11, label: "Vera QA" },
  { number: 12, label: "Shorts" },
  { number: 13, label: "Upload" },
];

export const STEP_SLUGS: Record<number, string> = {
  1: "research", 2: "script", 3: "seo", 4: "quality",
  5: "audio", 6: "avatar", 7: "broll", 8: "images", 9: "visuals",
  10: "av-sync", 11: "vera-qa", 12: "shorts", 13: "upload",
};
```

- [ ] **Step 2: Update `PipelineProgress.tsx` to import from lib**

Remove the local `STEPS` and `STEP_SLUGS` constants (lines 7–27) and replace with:

```typescript
import { STEPS, STEP_SLUGS } from "@/lib/pipeline-steps";
```

Keep all other code in `PipelineProgress.tsx` unchanged.

- [ ] **Step 3: Verify the app builds with no import errors**

```bash
cd /Users/gunjansarkar/Downloads/yt-content-factory
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors about `STEPS` or `STEP_SLUGS`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/pipeline-steps.ts apps/web/components/layout/PipelineProgress.tsx
git commit -m "refactor: extract STEP_SLUGS and STEPS to lib/pipeline-steps.ts"
```

---

## Chunk 2: Header Cleanup + Bell Notification Component

### Task 2: Create `BellNotification.tsx`

**Files:**
- Create: `apps/web/components/layout/BellNotification.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/components/layout/BellNotification.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import Link from "next/link";
import {
  useNotificationStore,
  getUnreadCount,
} from "@/lib/notifications/notification-store";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BellNotification() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { messages, markRead, deleteMessage } = useNotificationStore();
  const unreadCount = getUnreadCount(messages);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // filter deleted, sort newest first, cap at 5
  const visibleMessages = messages
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  function handleClearRead() {
    messages
      .filter((m) => m.read && !m.deletedAt)
      .forEach((m) => deleteMessage(m.messageId));
  }

  function handleItemClick(messageId: string) {
    markRead(messageId);
    setOpen(false);
    router.push(`/inbox?message=${messageId}`);
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-text-secondary hover:text-text-primary transition-colors duration-200"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-accent-primary text-bg-base font-dm-mono text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-8 w-[340px] bg-bg-surface border border-bg-border rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
            <span className="font-syne font-bold text-sm text-text-primary">
              Notifications
            </span>
            <button
              onClick={handleClearRead}
              className="font-dm-mono text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Clear read
            </button>
          </div>

          {/* Message list */}
          {visibleMessages.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-dm-mono text-xs text-text-tertiary">No notifications</p>
            </div>
          ) : (
            <div>
              {visibleMessages.map((m) => (
                <button
                  key={m.messageId}
                  onClick={() => handleItemClick(m.messageId)}
                  className={`w-full text-left px-4 py-3 border-b border-bg-border flex gap-2.5 items-start transition-colors hover:bg-bg-elevated ${
                    !m.read ? "bg-accent-primary/5" : "opacity-40"
                  }`}
                >
                  {/* Dot */}
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                      !m.read ? "bg-accent-primary" : "bg-bg-border"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`font-dm-mono text-[10px] font-bold uppercase ${
                          m.tier === "critical" ? "text-accent-primary" : "text-text-tertiary"
                        }`}
                      >
                        {m.agentSource}
                      </span>
                      <span className="font-dm-mono text-[9px] text-text-tertiary">
                        {formatRelativeTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="font-dm-mono text-[11px] text-text-primary mb-0.5 truncate">
                      {m.title}
                    </p>
                    <p className="font-dm-mono text-[10px] text-text-secondary truncate">
                      {m.body}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 text-center">
            <Link
              href="/inbox"
              onClick={() => setOpen(false)}
              className="font-dm-mono text-[11px] text-accent-primary hover:text-accent-primary/80 transition-colors tracking-wide"
            >
              View all in Inbox →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `Header.tsx`**

Make these changes to [Header.tsx](apps/web/components/layout/Header.tsx):

1. Remove `History` from the lucide-react import
2. Add import for `BellNotification`
3. Change wordmark `href="/"` → `href="/home"`
4. Replace the History button with nothing (delete it)
5. Replace the Settings `<button>` with `<Link href="/settings">`
6. Add `<BellNotification />` between Settings link and `UserButton`

Full updated file:

```typescript
// apps/web/components/layout/Header.tsx
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
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/BellNotification.tsx apps/web/components/layout/Header.tsx
git commit -m "feat: add bell notification dropdown, wire settings link, remove history button"
```

---

## Chunk 3: Home Page

### Task 3: Create `apps/web/app/(app)/home/page.tsx`

**Files:**
- Create: `apps/web/app/(app)/home/page.tsx`

- [ ] **Step 1: Create the home page**

```typescript
// apps/web/app/(app)/home/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePipelineStore } from "@/lib/pipeline-store";
import {
  useNotificationStore,
  getUnreadCount,
} from "@/lib/notifications/notification-store";
import { STEP_SLUGS, STEPS } from "@/lib/pipeline-steps";
import StatusPill from "@/components/ui/StatusPill";

// Per-step agent status lines
const STEP_AGENT_LINES: Record<number, string> = {
  1:  "Rex is scanning for signals...",
  2:  "Muse is writing the script...",
  3:  "Regum is optimising metadata...",
  4:  "Vera is checking uniqueness...",
  5:  "Audio generation in progress...",
  6:  "SkyReels is rendering avatar...",
  7:  "Wan2.2 is generating b-roll...",
  8:  "TONY is building visuals...",
  9:  "Puppeteer is rendering charts...",
  10: "FFmpeg is stitching the cut...",
  11: "Vera is running final QA...",
  12: "Generating Shorts cut...",
  13: "Uploading to YouTube...",
};

export default function HomePage() {
  const router = useRouter();
  const { sessions } = usePipelineStore();
  const { messages } = useNotificationStore();
  const unreadCount = getUnreadCount(messages);

  // Active sessions: at least one step is "running"
  const activeSessions = Object.values(sessions).filter((session) =>
    Object.values(session.stepStatuses).some((s) => s === "running")
  );

  function handleJobCardClick(sessionCurrentStep: number) {
    const slug = STEP_SLUGS[sessionCurrentStep];
    if (!slug || sessionCurrentStep === 0) return;
    router.push(`/create/${slug}`);
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[720px] mx-auto space-y-6">

        {/* Studio Mode hero */}
        <div className="border border-accent-primary/30 bg-accent-primary/5 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-dm-mono text-[10px] text-accent-primary tracking-[2px] uppercase mb-1">
                Studio Mode
              </p>
              <h1 className="font-syne font-bold text-xl text-text-primary mb-2">
                Start a new video from topic to upload.
              </h1>
              <p className="font-dm-mono text-xs text-text-secondary">
                Research → Script → SEO → Quality Gate → Production → Upload
              </p>
            </div>
            <Link
              href="/create"
              className="shrink-0 bg-accent-primary text-bg-base font-dm-mono text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-accent-primary/90 transition-colors whitespace-nowrap"
            >
              → Start New Video
            </Link>
          </div>
        </div>

        {/* Nav cards row */}
        <div className="grid grid-cols-3 gap-4">
          {/* GO RRQ */}
          <Link
            href="/zeus"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group"
          >
            <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-2">
              GO RRQ
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Autopilot mode
            </p>
          </Link>

          {/* Inbox */}
          <Link
            href="/inbox"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group relative"
          >
            {unreadCount > 0 && (
              <span className="absolute top-4 right-4 bg-accent-primary text-bg-base font-dm-mono text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
            <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-2">
              Inbox
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Agent updates
            </p>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            className="border border-bg-border bg-bg-surface rounded-xl p-5 hover:border-accent-primary/30 transition-colors group"
          >
            <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-2">
              Settings
            </p>
            <p className="font-syne font-bold text-sm text-text-primary group-hover:text-accent-primary transition-colors">
              Account &amp; preferences
            </p>
          </Link>
        </div>

        {/* Active Jobs — only shown when at least one session is running */}
        {activeSessions.length > 0 && (
          <div>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
              <p className="font-dm-mono text-[10px] text-accent-primary tracking-[2px] uppercase">
                Live Now
              </p>
            </div>

            <div className="space-y-3">
              {activeSessions.map((session) => {
                const currentStep = session.currentStep;
                const slug = STEP_SLUGS[currentStep];
                const isClickable = currentStep !== 0 && slug !== undefined;
                const stepLabel = STEPS.find((s) => s.number === currentStep)?.label ?? "—";
                const agentLine = STEP_AGENT_LINES[currentStep] ?? "Processing...";
                const topic =
                  session.brief !== null ? session.brief.topic : "Starting up...";
                const progress = Math.round((currentStep / 13) * 100);

                return (
                  <div
                    key={session.jobId}
                    onClick={isClickable ? () => handleJobCardClick(currentStep) : undefined}
                    className={`border border-bg-border bg-bg-surface rounded-xl p-5 ${
                      isClickable
                        ? "cursor-pointer hover:border-accent-primary/30 transition-colors"
                        : "cursor-default"
                    }`}
                  >
                    {/* Topic + step pill row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-syne font-bold text-sm text-text-primary truncate">
                          {topic}
                        </p>
                        <p className="font-dm-mono text-[10px] text-text-secondary mt-0.5">
                          {agentLine}
                        </p>
                      </div>
                      <StatusPill status="running" label={stepLabel} />
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="font-dm-mono text-[9px] text-text-tertiary mt-1 text-right">
                      Step {currentStep} of 13
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/home/page.tsx
git commit -m "feat: add home dashboard page with Studio hero, nav cards, and LIVE NOW feed"
```

---

## Chunk 4: Settings Page

### Task 4: Create `apps/web/app/(app)/settings/page.tsx`

**Files:**
- Create: `apps/web/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

```typescript
// apps/web/app/(app)/settings/page.tsx
"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const PLANS = [
  { id: "starter", label: "Starter", price: "$19", videos: "15 videos / mo", popular: false },
  { id: "creator", label: "Creator", price: "$49", videos: "50 videos / mo", popular: true },
  { id: "agency",  label: "Agency",  price: "$149", videos: "Unlimited", popular: false },
] as const;

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  function startEdit() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEditing(true);
    setSaveStatus("idle");
    setSaveError("");
  }

  function cancelEdit() {
    setEditing(false);
    setSaveStatus("idle");
    setSaveError("");
  }

  async function handleSave() {
    if (!user) return;
    try {
      await user.update({ firstName, lastName });
      setEditing(false);
      setSaveStatus("saved");
      setSaveError("");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err: unknown) {
      // Clerk throws ClerkAPIResponseError — access .message directly
      const message = (err as { message?: string }).message ?? "Failed to save";
      setSaveError(message);
      setSaveStatus("error");
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  const currentPlan =
    (user?.publicMetadata?.plan as string | undefined) ?? "free";

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-dm-mono text-xs text-text-tertiary">Loading...</p>
      </div>
    );
  }

  const avatarInitial = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[560px] mx-auto">
        {/* Page title */}
        <div className="mb-7">
          <h1 className="font-syne font-bold text-xl text-text-primary mb-1">Settings</h1>
          <p className="font-dm-mono text-[10px] text-text-tertiary">Manage your account and preferences</p>
        </div>

        {/* Section 1: Profile */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5 mb-4">
          <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-4">Profile</p>

          {/* Avatar + email row */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 bg-bg-elevated border border-bg-border rounded-full flex items-center justify-center text-text-secondary font-syne font-bold text-lg shrink-0">
              {avatarInitial}
            </div>
            <div>
              <p className="font-dm-mono text-sm text-text-primary">{user?.fullName ?? "—"}</p>
              <p className="font-dm-mono text-[10px] text-text-tertiary">{email}</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <p className="font-dm-mono text-[10px] text-text-tertiary mb-2">Display Name</p>
            {!editing ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 font-dm-mono text-xs text-text-primary">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName ?? user?.lastName ?? "—"}
                </div>
                <button
                  onClick={startEdit}
                  className="bg-transparent border border-accent-primary text-accent-primary font-dm-mono text-[11px] px-3.5 py-2 rounded-lg hover:bg-accent-primary/10 transition-colors whitespace-nowrap"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setSaveStatus("idle"); setSaveError(""); }}
                    placeholder="First name"
                    className="flex-1 bg-bg-elevated border border-bg-border focus:border-accent-primary rounded-lg px-3 py-2 font-dm-mono text-xs text-text-primary outline-none transition-colors"
                  />
                  <input
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setSaveStatus("idle"); setSaveError(""); }}
                    placeholder="Last name"
                    className="flex-1 bg-bg-elevated border border-bg-border focus:border-accent-primary rounded-lg px-3 py-2 font-dm-mono text-xs text-text-primary outline-none transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    className="bg-accent-primary text-bg-base font-dm-mono text-[11px] font-bold px-4 py-1.5 rounded-lg hover:bg-accent-primary/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="border border-bg-border text-text-secondary font-dm-mono text-[11px] px-4 py-1.5 rounded-lg hover:border-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  {saveStatus === "error" && (
                    <span className="font-dm-mono text-xs text-accent-error">{saveError}</span>
                  )}
                </div>
              </div>
            )}
            {/* "Saved" renders only after editing closes — single render path, no dead code */}
            {saveStatus === "saved" && !editing && (
              <p className="font-dm-mono text-xs text-accent-success mt-1">Saved</p>
            )}
          </div>
        </div>

        {/* Section 2: Plan */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5 mb-4">
          <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-4">Plan</p>

          {/* Current plan row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-dm-mono text-sm text-text-primary capitalize">{currentPlan} Plan</p>
              {currentPlan === "free" && (
                <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">3 videos / month</p>
              )}
            </div>
            <span className="bg-bg-elevated border border-bg-border font-dm-mono text-[10px] text-text-tertiary px-2 py-1 rounded">
              CURRENT
            </span>
          </div>

          {/* Plan tier cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative bg-bg-elevated rounded-lg p-3 text-center border ${
                    plan.popular
                      ? "border-accent-primary/60"
                      : isCurrent
                      ? "border-bg-border/80"
                      : "border-bg-border"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-accent-primary text-bg-base font-dm-mono text-[8px] font-bold px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  )}
                  <p className="font-syne font-bold text-sm text-text-primary mb-1">{plan.label}</p>
                  <p className="font-dm-mono text-base font-bold text-accent-primary mb-0.5">{plan.price}</p>
                  <p className="font-dm-mono text-[9px] text-text-tertiary mb-2">/ month</p>
                  <p className="font-dm-mono text-[9px] text-text-secondary mb-3">{plan.videos}</p>
                  <button
                    onClick={() => {
                      // No toast library in project — use browser alert as placeholder
                      alert("Stripe integration coming soon");
                    }}
                    className={`w-full font-dm-mono text-[10px] py-1.5 rounded ${
                      plan.popular
                        ? "bg-accent-primary text-bg-base font-bold hover:bg-accent-primary/90"
                        : "border border-bg-border text-text-tertiary hover:border-text-tertiary"
                    } transition-colors`}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="font-dm-mono text-[10px] text-text-tertiary text-center">
            Stripe integration coming soon
          </p>
        </div>

        {/* Section 3: Account */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
          <p className="font-dm-mono text-[10px] text-text-tertiary uppercase tracking-widest mb-4">Account</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-dm-mono text-xs text-text-primary">Sign out</p>
              <p className="font-dm-mono text-[10px] text-text-tertiary mt-0.5">
                Sign out of your account on this device
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="border border-bg-border text-text-secondary font-dm-mono text-[11px] px-4 py-1.5 rounded-lg hover:border-text-secondary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/settings/page.tsx
git commit -m "feat: add settings page with profile edit, plan tiers, and sign out"
```

---

## Chunk 5: Inbox Deep-Link

### Task 5: Edit `apps/web/app/(app)/inbox/page.tsx`

**Files:**
- Modify: `apps/web/app/(app)/inbox/page.tsx`

- [ ] **Step 1: Add the `InboxDeepLink` child component and Suspense wrapper**

At the top of [inbox/page.tsx](apps/web/app/(app)/inbox/page.tsx):

1. The file already has `import { useEffect } from "react"` — **merge** `Suspense` into that line:
   ```typescript
   import { useEffect, Suspense } from "react";
   ```
2. Add the new navigation import:
   ```typescript
   import { useSearchParams } from "next/navigation";
   ```

Add the `InboxDeepLink` component definition directly above `InboxPage` (after the `DEMO_MESSAGES` and `VIEW_LABELS` constants):

```typescript
function InboxDeepLink() {
  const searchParams = useSearchParams();
  const { messages, setActiveMessage } = useNotificationStore();

  useEffect(() => {
    const id = searchParams.get("message");
    // Guard: only call setActiveMessage if message exists in store.
    // Note: if store hydrates after mount (e.g. demo seed in useEffect), this will
    // silently not deep-link — this is intentional per spec ("no action taken if not found").
    if (id && messages.find((m) => m.messageId === id)) {
      setActiveMessage(id);
    }
  // Intentionally runs on mount only — query param does not change after navigation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
```

Inside the `return` of `InboxPage`, add `<Suspense fallback={null}><InboxDeepLink /></Suspense>` as the first child of the outermost `<div>`:

```tsx
return (
  <div className="flex h-full bg-bg-base">
    <Suspense fallback={null}>
      <InboxDeepLink />
    </Suspense>
    {/* Left panel */}
    ...existing content...
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/inbox/page.tsx
git commit -m "feat: add inbox deep-link via ?message= query param"
```

---

## Chunk 6: Middleware Confirmation + Final Build Check

### Task 6: Confirm middleware + final verification

**Files:**
- Confirm (no edit): `apps/web/middleware.ts`

- [ ] **Step 1: Verify middleware does NOT list `/home` or `/settings` as public routes**

Open [middleware.ts](apps/web/middleware.ts) and confirm the `isPublicRoute` matcher only contains:
- `"/"`
- `"/sign-in(.*)"`
- `"/sign-up(.*)"`
- `"/api/webhooks/(.*)"`

`/home` and `/settings` are NOT in this list, so they are already protected by `auth.protect()`. No changes needed.

- [ ] **Step 2: Run full type-check**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -50
```

Expected: zero errors.

- [ ] **Step 3: Start the dev server and manually verify each feature**

```bash
cd /Users/gunjansarkar/Downloads/yt-content-factory && npm run dev --workspace=apps/web
```

Manual checklist:
- [ ] Navigate to `/home` — Studio Mode hero, 3 nav cards, no LIVE NOW section (no active jobs)
- [ ] RRQ wordmark in header → navigates to `/home`
- [ ] Settings gear icon → navigates to `/settings`
- [ ] History/clock icon is **gone**
- [ ] Bell icon shows `0` (no badge) with no unread messages
- [ ] Bell click → dropdown opens; click outside → closes
- [ ] `/settings` loads with profile, plan cards, sign out button
- [ ] Display name Edit button → shows two inputs; Cancel → reverts
- [ ] Navigate to `/inbox?message=demo-1` → demo-1 message opens automatically in right panel

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify middleware covers home and settings routes"
```
