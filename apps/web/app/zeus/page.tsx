"use client";

import { useState } from "react";
import { useAgentStore } from "@/lib/agent-store";
import { Brain } from "lucide-react";
import { OverviewTab } from "./components/OverviewTab";
import { CommsTab } from "./components/CommsTab";
import { LiveTab } from "./components/LiveTab";
import { AgentsTab } from "./components/AgentsTab";
import { KanbanTab } from "./components/KanbanTab";

type Tab = "OVERVIEW" | "COMMS" | "LIVE" | "AGENTS" | "KANBAN";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "OVERVIEW", label: "OVERVIEW" },
  { id: "COMMS", label: "COMMS" },
  { id: "LIVE", label: "LIVE" },
  { id: "AGENTS", label: "AGENTS" },
  { id: "KANBAN", label: "KANBAN" },
];

export default function ZeusPage() {
  const { isAutonomousMode } = useAgentStore();
  const [activeTab, setActiveTab] = useState<Tab>("OVERVIEW");

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Zeus sub-header */}
      <div className="border-b border-bg-border px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-syne font-bold text-lg text-text-primary tracking-wider">
            ZEUS COMMAND CENTER
          </span>
          <div
            className={`flex items-center gap-1.5 ${
              isAutonomousMode ? "text-accent-success" : "text-text-tertiary"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isAutonomousMode
                  ? "bg-accent-success animate-pulse"
                  : "bg-text-tertiary"
              }`}
            />
            <span className="font-dm-mono text-xs tracking-widest uppercase">
              {isAutonomousMode ? "Agents Active" : "Standby"}
            </span>
          </div>
        </div>
        <Brain size={20} className="text-accent-primary" />
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-0 border-b border-bg-border shrink-0 px-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              font-dm-mono text-[11px] tracking-widest px-4 py-3 border-b-2 transition-all duration-150
              ${activeTab === tab.id
                ? "border-accent-primary text-accent-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "OVERVIEW" && <OverviewTab />}
        {activeTab === "COMMS" && <CommsTab />}
        {activeTab === "LIVE" && <LiveTab />}
        {activeTab === "AGENTS" && <AgentsTab />}
        {activeTab === "KANBAN" && <KanbanTab />}
      </div>
    </div>
  );
}
