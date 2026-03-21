import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export const metadata = {
  title: "Cold Start Research — RRQ",
  description: "24-hour deep research sprint for new channel launch",
};

export default function ColdStartLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-bg-base">{children}</main>
      </div>
    </div>
  );
}
