"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  notifyLoadingStart,
  notifyLoadingStop,
  subscribeLoading,
} from "@/lib/loading-bus";

type LoadingContextValue = {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => subscribeLoading(setCount), []);

  const startLoading = useCallback(() => notifyLoadingStart(), []);
  const stopLoading = useCallback(() => notifyLoadingStop(), []);

  const value = useMemo(
    () => ({
      isLoading: count > 0,
      startLoading,
      stopLoading,
    }),
    [count, startLoading, stopLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {count > 0 ? <GlobalLoaderOverlay /> : null}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return ctx;
}

export function Spinner({
  className = "h-8 w-8",
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 ${className}`}
    />
  );
}

export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function GlobalLoaderOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/10 pt-6 backdrop-blur-[1px]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
        <Spinner className="h-4 w-4" />
        <span className="text-sm font-medium text-slate-700">Loading...</span>
      </div>
    </div>
  );
}
