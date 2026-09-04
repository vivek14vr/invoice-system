"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingProvider, Spinner } from "@/components/Loader";
import { Sidebar } from "@/components/Sidebar";
import { api, AuthResponse, AuthUser } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const userRef = useRef<AuthUser | null>(null);

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
    if (userRef.current) return;

    let active = true;
    api
      .get<AuthResponse>("/auth/me")
      .then(async (response) => {
        if (!active) return;
        userRef.current = response.user;
        setUser(response.user);
      })
      .catch(() => {
        if (active) {
          userRef.current = null;
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
      userRef.current = null;
      setUser(null);
      router.replace("/login");
      router.refresh();
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
          onLogout={logout}
        />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </LoadingProvider>
  );
}
