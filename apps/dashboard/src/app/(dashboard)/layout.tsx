"use client";

import { useState } from "react";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";
import { LiveFeed } from "@/components/layout/LiveFeed";
import { AIChat } from "@/components/layout/AIChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left — Platform sidebar (expandable) */}
      <PlatformSidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
      />

      {/* Center — Live Feed */}
      <div className="flex-1 flex flex-col min-w-0">
        <LiveFeed />
      </div>

      {/* Right — AI Chat */}
      <div className="w-[380px] shrink-0 border-l border-border">
        <AIChat />
      </div>
    </div>
  );
}
