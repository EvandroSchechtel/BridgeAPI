"use client";

import { useState } from "react";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";
import { AIChat } from "@/components/layout/AIChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left — Platform sidebar + navigation (expandable) */}
      <PlatformSidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
      />

      {/* Center — Page content (changes by route) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Right — AI Chat (always visible) */}
      <div className="w-[380px] shrink-0 border-l border-border">
        <AIChat />
      </div>
    </div>
  );
}
