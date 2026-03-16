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
