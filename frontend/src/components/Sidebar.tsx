"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/api";
import {
  Box,
  CreditCard,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  ReceiptIndianRupee,
  Settings,
  Users,
  BarChart3,
  Building2,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FilePlus2 },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: ReceiptIndianRupee },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/products", label: "Products", icon: Box },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users & Companies", icon: Users },
];

export function Sidebar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compact = !hoverExpanded;

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  return (
    <aside
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        setHoverExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") {
          leaveTimer.current = setTimeout(() => setHoverExpanded(false), 180);
        }
      }}
      className={`relative z-40 flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white shadow-sm transition-[width] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] ${compact ? "w-[72px]" : "w-64"}`}
    >
      <div className={`flex h-20 shrink-0 items-center gap-3 px-2 md:px-5 ${compact ? "justify-center" : "justify-center md:justify-start"}`}>
        <Image
          src="/girjasoft_logo-removebg-preview.png"
          alt="Girjasoft"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
          <div className={`${compact ? "hidden" : "hidden md:block"}`}>
          <Image
            src="/girjasoft_name_logo-removebg-preview.png"
            alt="Girjasoft"
            width={110}
            height={20}
            className="h-5 w-[110px] object-contain object-left"
          />
          <p className="text-xs text-slate-500">Invoice System</p>
        </div>
      </div>

      <div className="h-16 shrink-0 px-2 pb-2 md:px-3">
        <div
          aria-label={`Workspace: ${user.workspace?.name ?? "Default workspace"}`}
          title={compact ? (user.workspace?.name ?? "Default workspace") : undefined}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 text-left text-sm hover:bg-slate-50 md:justify-start md:px-3"
        >
          <Building2 className={`h-5 w-5 shrink-0 text-slate-500 ${compact ? "block" : "md:hidden"}`} aria-hidden="true" />
          <div className={`${compact ? "hidden" : "hidden min-w-0 flex-1 md:block"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
            <p className="truncate font-medium text-slate-700">{user.workspace?.name ?? "Default workspace"}</p>
          </div>
        </div>
      </div>

      <nav className="hidden min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 md:block">
        {nav.filter((item) => item.href !== "/users" || user.role === "ADMIN").map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center rounded-lg py-2.5 text-sm transition ${compact ? "justify-center px-2" : "gap-3 px-3"} ${
                active
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-500"}`}
              />
              <span className={`min-w-0 whitespace-nowrap ${compact ? "hidden" : "block"}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2 md:hidden">
        {nav.filter((item) => item.href !== "/users" || user.role === "ADMIN").map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm ${
                active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-500"}`} />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={`shrink-0 border-t border-slate-200 ${compact ? "p-2" : "p-2 md:p-4"}`}>
        <div className={`flex ${compact ? "flex-col items-center gap-2" : "items-center gap-3 justify-center md:justify-start"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            A
          </div>
          <div className={`${compact ? "hidden" : "hidden min-w-0 flex-1 md:block"}`}>
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Logout"
            title={compact ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 hidden text-center text-[11px] text-slate-400 md:block">
          Powered by girjasoft
        </p>
      </div>
    </aside>
  );
}
