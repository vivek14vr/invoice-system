"use client";

import { useEffect } from "react";
import { LoadingProvider } from "@/components/Loader";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLInputElement &&
        el.type === "number" &&
        document.activeElement === el
      ) {
        el.blur();
      }
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <LoadingProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </LoadingProvider>
  );
}
