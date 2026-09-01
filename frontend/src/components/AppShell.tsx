"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingProvider, Spinner } from "@/components/Loader";
import { Sidebar } from "@/components/Sidebar";
import { api, AuthResponse, AuthUser, Workspace } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

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

  useEffect(() => {
    if (pathname === "/login") return;

    let active = true;
    api
      .get<AuthResponse>("/auth/me")
      .then(async (response) => {
        if (!active) return;
        setUser(response.user);
        const available = await api.get<Workspace[]>("/auth/workspaces");
        if (active) setWorkspaces(available);
      })
      .catch(() => {
        if (active) {
          setUser(null);
          router.replace("/login");
        }
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } finally {
      setUser(null);
      router.replace("/login");
      router.refresh();
    }
  }

  async function switchWorkspace(companyId: string) {
    const response = await api.post<AuthResponse>("/auth/switch-workspace", { companyId });
    setUser(response.user);
    router.replace("/");
    router.refresh();
  }

  async function createWorkspace(name: string) {
    const workspace = await api.post<Workspace>("/auth/workspaces", { name });
    setWorkspaces((items) => [...items, workspace]);
    await switchWorkspace(workspace.id);
  }

  async function deleteWorkspace(companyId: string) {
    await api.delete(`/auth/workspaces/${companyId}`);
    const available = await api.get<Workspace[]>('/auth/workspaces');
    setWorkspaces(available);
    if (user?.companyId === companyId) {
      const fallback = available[0];
      if (fallback) await switchWorkspace(fallback.id);
    }
  }

  if (pathname === "/login") {
    return <LoadingProvider>{children}</LoadingProvider>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-9 w-9" label="Checking session" />
      </div>
    );
  }

  return (
    <LoadingProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          user={user}
          workspaces={workspaces}
          onLogout={logout}
          onSwitchWorkspace={switchWorkspace}
          onCreateWorkspace={createWorkspace}
          onDeleteWorkspace={deleteWorkspace}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </LoadingProvider>
  );
}
