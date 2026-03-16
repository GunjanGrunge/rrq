# Design: Home Page, Navigation Improvements, Bell Notifications, Settings Page

**Date:** 2026-03-16
**Status:** Approved

---

## Context

The app currently has no home/dashboard page — signed-in users land directly on `/create`. There is no way to navigate between sections (Inbox, Zeus, Settings) without knowing the URLs. The header contains a non-functional History/clock button and a non-functional Settings button. There is no bell notification indicator. The Settings page directory exists but has no implementation. This design adds all four of these connected improvements.

---

## 1. Home Page (`/app/(app)/home/page.tsx` → route `/home`)

### Layout: Studio Mode hero + nav cards + live jobs feed (Option B)

**Route:** `/home` — accessible from the RRQ wordmark in the header (currently `/`)

**Structure (top to bottom):**

1. **Studio Mode hero card** — full-width amber-accented card. Label: "STUDIO MODE". Subtext: "Start a new video from topic to upload." Large `→ Start New Video` CTA button navigates to `/create`.

2. **Nav cards row** — 3 equal cards below the hero:
   - **GO RRQ** → `/zeus` — "Autopilot mode"
   - **Inbox** → `/inbox` — "Agent updates" + unread badge count (pulled from `useNotificationStore`, `getUnreadCount()`)
   - **Settings** → `/settings` — "Account & preferences"

3. **Active Jobs section** — title "LIVE NOW" with pulsing amber dot. Hidden entirely when no session has a running step. A session is considered active when `Object.values(session.stepStatuses).some(s => s === "running")` — sessions with all steps `"ready"` or `"complete"` are not shown. Reads from `usePipelineStore()` — iterates all `sessions` entries and filters to active ones. Each active job renders as a card:
   - Job topic: guard `session.brief !== null` before reading `session.brief.topic`; if `null`, show "Starting up..."
   - Current running step label (e.g., "Quality Gate") — derived from the first step where `stepStatuses[n] === "running"`, mapped via `STEP_SLUGS` from `lib/pipeline-steps.ts`
   - Agent status line (e.g., "Vera is checking uniqueness...") — static per-step string, defined in the home page component
   - Progress bar: `(currentStep / 13) * 100%`
   - Step status pill (reuses existing `StatusPill` component)
   - Clicking the card navigates to `/create/${STEP_SLUGS[currentStep]}`. Guard: if `currentStep === 0` or `STEP_SLUGS[currentStep]` is undefined, the card is non-clickable (no `onClick`, `cursor-default`). `STEP_SLUGS` imported from `lib/pipeline-steps.ts`
   - Jobs stacked vertically, no limit

**Data sources:**
- Active jobs: `usePipelineStore()` — `sessions`, `activeJobId`
- Unread count on Inbox card: `const { messages } = useNotificationStore(); const unreadCount = getUnreadCount(messages);` where `getUnreadCount` is the exported selector from `notification-store.ts`

---

## 2. Header Changes (`apps/web/components/layout/Header.tsx`)

### Remove history button
Remove the `<History>` icon button entirely (the clock icon). No replacement needed.

### Wire Settings button
Change the existing `<Settings>` icon button from a `<button>` with no action to a `<Link href="/settings">` (using Next.js `Link` with `legacyBehavior` or wrapping with `<button>` using `router.push`).

### Add Bell notification icon
Between the Settings link and `UserButton`, add a `BellNotification` component:

**`apps/web/components/layout/BellNotification.tsx`** (new file):
- Bell icon (`lucide-react` `Bell`) with amber badge showing `getUnreadCount(messages)`. Badge hidden when count = 0.
- On click: toggles a dropdown panel. Clicking outside closes it (use `useRef` + `useEffect` for outside click detection).

**Dropdown panel** (renders as absolute-positioned div below bell, `z-50`):
- Header row: "Notifications" title (font-syne bold) + "Clear read" button (font-dm-mono, right-aligned). "Clear read" loops over `messages.filter(m => m.read && !m.deletedAt)` and calls `deleteMessage(m.messageId)` for each — soft-deletes them to Trash. No batch store action exists; loop happens in the component handler.
- Message list: filter first (`!m.deletedAt`), then sort by `createdAt` descending (highest timestamp first), then take first 5. Cap applied after filtering.
  - **Unread item**: amber dot, warm background tint (`bg-accent-primary/5`), full opacity. Shows: agent name (uppercase, amber if tier=critical else muted), title, truncated body preview, relative timestamp.
  - **Read item**: no dot, dimmed (`opacity-40`), no background tint.
  - Clicking any item: calls `markRead(messageId)`, closes dropdown, navigates to `/inbox?message={messageId}`.
- Footer: "View all in Inbox →" link → `/inbox`. Amber text, font-dm-mono.
- Empty state: "No notifications" centered, muted text.

**Unread count badge:** amber circle, black text, `font-dm-mono text-[9px] font-bold`. Shows raw number, no "99+" cap needed for now.

---

## 3. Inbox Deep-Link (`/inbox?message={messageId}`)

The existing inbox page at `apps/web/app/(app)/inbox/page.tsx` needs to read the `message` query param on mount and call `setActiveMessage(messageId)` if present. This makes bell notification clicks open the correct message thread directly.

Uses `useSearchParams()` from `next/navigation`. Because `useSearchParams()` requires a `<Suspense>` boundary in Next.js 14 App Router, extract the query-param reading logic into a child component (`InboxDeepLink`) wrapped in `<Suspense fallback={null}>` inside the inbox page. The child component reads the param on mount and calls `setActiveMessage(messageId)` only if the message exists in the store: `if (messages.find(m => m.messageId === id)) setActiveMessage(id)`. If the message is not found (deleted or not yet loaded), no action is taken — the existing inbox handles `activeMessageId` pointing to a non-existent message gracefully (shows empty right panel).

---

## 4. Settings Page (`apps/web/app/(app)/settings/page.tsx`)

New file. Three sections, `max-w-[560px] mx-auto` layout.

### Section 1: Profile
- Shows Clerk user avatar initial + email (read-only, from `useUser()`)
- **Display Name field**: two separate inputs — First Name and Last Name — pre-filled with `user.firstName` and `user.lastName`. Edit button toggles from read-only display (`{firstName} {lastName}`) to two inline inputs. Save calls `user.update({ firstName, lastName })`. Cancel restores original values without saving.
- `user.update()` is async and can throw. On save success: show brief inline "Saved" in `text-accent-success font-dm-mono text-xs`, fades after 2s (via `setTimeout` clearing a `saved` state flag). On error: show the Clerk error message (from the caught error's `.message`) in `text-accent-error font-dm-mono text-xs` below the inputs, persistent until the user edits again.

### Section 2: Plan
- Shows current plan from `user.publicMetadata.plan` (Clerk). Defaults to "free" if not set.
- Current plan shown with "CURRENT" badge.
- Three upgrade tier cards: Starter ($19/15 videos), Creator ($49/50 videos — "POPULAR" badge, amber border), Agency ($149/unlimited).
- All "Upgrade" buttons are `<button>` elements with `onClick` that shows a toast: "Stripe integration coming soon". No actual redirect.
- Current plan's card is highlighted differently — slightly brighter border.

### Section 3: Account
- Single row: "Sign out" label + description + Sign out button.
- Sign out calls Clerk's `useClerk().signOut()` then redirects to `/sign-in`.

---

## 5. Navigation: Header RRQ Link → `/home`

The RRQ wordmark in the header currently links to `/`. Change it to link to `/home` for authenticated users. The public landing page at `/` remains unchanged.

Since the header renders inside `(app)` layout (authenticated only), the link can unconditionally point to `/home`.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `apps/web/lib/pipeline-steps.ts` | NEW — move `STEP_SLUGS` (and `STEPS` array) here from `PipelineProgress.tsx`; export both |
| `apps/web/app/(app)/home/page.tsx` | NEW — home page |
| `apps/web/app/(app)/settings/page.tsx` | NEW — settings page |
| `apps/web/components/layout/BellNotification.tsx` | NEW — bell icon + dropdown |
| `apps/web/components/layout/Header.tsx` | EDIT — remove History button, wire Settings link, add BellNotification, change wordmark href to `/home` |
| `apps/web/components/layout/PipelineProgress.tsx` | EDIT — delete local `STEP_SLUGS` and `STEPS` constants; import both from `lib/pipeline-steps.ts` |
| `apps/web/app/(app)/inbox/page.tsx` | EDIT — read `?message=` query param, call `setActiveMessage` on mount |
| `apps/web/middleware.ts` | CONFIRM — existing middleware uses a public-route allowlist + `auth.protect()` for all other routes, so `/home` and `/settings` are already protected. Verify `/home` and `/settings` are not listed in the public allowlist; no other change needed. |

---

## What Does NOT Change

- Public landing page at `/` — untouched
- Sidebar navigation — untouched
- `notification-store.ts` — no changes needed, `getUnreadCount()` and `deleteMessage()` already exist
- `pipeline-store.ts` — no changes needed, sessions + step data already available
- Inbox page core functionality — only adding query param handling
- Stripe integration — not implemented, buttons are placeholders only
- `/api/notifications` — no backend changes

---

## Verification

1. **Home page**: Navigate to `/home` — hero card, 3 nav cards, and live jobs section visible. Start a pipeline job, return to `/home` — job appears in LIVE NOW section with correct step label and progress. Click job card → navigates to correct step page.
2. **Header**: History/clock icon is gone. Settings icon navigates to `/settings`. Bell shows amber badge count matching unread messages in store.
3. **Bell dropdown**: Click bell — dropdown opens. Unread items have amber dot + tinted background. Read items are dimmed. "Clear read" soft-deletes read items (they appear in Trash in `/inbox`). Clicking a notification closes dropdown and opens that message in `/inbox`.
4. **Inbox deep-link**: Navigate to `/inbox?message=<id>` — correct message thread opens automatically.
5. **Settings — display name**: Edit display name → save → Clerk `user.fullName` updates. "Saved" confirmation appears.
6. **Settings — plan**: Upgrade buttons show "coming soon" toast. Current plan is highlighted.
7. **Settings — sign out**: Sign out button calls Clerk signOut and redirects to `/sign-in`.
