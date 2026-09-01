"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthUser, Workspace } from "@/lib/api";
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
  ChevronDown,
  Plus,
  BarChart3,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
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
  workspaces,
  onLogout,
  onSwitchWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
}: {
  user: AuthUser;
  workspaces: Workspace[];
  onLogout: () => void;
  onSwitchWorkspace: (companyId: string) => Promise<void>;
  onCreateWorkspace: (name: string) => Promise<void>;
  onDeleteWorkspace: (companyId: string) => Promise<void>;
}) {
  const pathname = usePathname();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("sidebar-collapsed") === "true",
  );
  const isSystemAdmin = user.email.trim().toLowerCase() === "admin@girjasoft.com";
  const isDefaultWorkspace = user.workspace?.name === "Default Company";

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  async function createWorkspace() {
    const name = window.prompt("New workspace name");
    if (!name?.trim()) return;
    try {
      await onCreateWorkspace(name.trim());
      setWorkspaceOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to create workspace");
    }
  }

  return (
    <aside className={`flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-[72px] md:w-64"}`}>
      <div className={`flex shrink-0 items-center gap-3 px-2 py-4 md:px-5 md:py-5 ${collapsed ? "justify-center" : "justify-center md:justify-start"}`}>
        <Image
          src="/girjasoft_logo-removebg-preview.png"
          alt="Girjasoft"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <div className={`${collapsed ? "hidden" : "hidden md:block"}`}>
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

      <div className="relative px-2 pb-3 md:px-3">
        <button
          type="button"
          onClick={() => setWorkspaceOpen((open) => !open)}
          aria-label={`Workspace: ${user.workspace?.name ?? "Default workspace"}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-left text-sm hover:bg-slate-50 md:justify-start md:px-3"
        >
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
            <p className="truncate font-medium text-slate-700">{user.workspace?.name ?? "Default workspace"}</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
        {workspaceOpen && (
          <div className="absolute left-2 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg md:left-3 md:right-3 md:w-auto">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="flex items-center gap-1 rounded-md">
                <button
                  type="button"
                  onClick={async () => {
                    await onSwitchWorkspace(workspace.id);
                    setWorkspaceOpen(false);
                  }}
                  className={`min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm ${workspace.id === user.companyId ? "bg-blue-50 font-medium text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <span className="block truncate">{workspace.name}</span>
                </button>
                {isSystemAdmin && workspace.name !== "Default Company" ? (
                  <button
                    type="button"
                    aria-label={`Delete ${workspace.name}`}
                    title={`Delete ${workspace.name}`}
                    onClick={async () => {
                      if (!window.confirm(`Delete workspace \"${workspace.name}\" and all its data? This cannot be undone.`)) return;
                      try {
                        await onDeleteWorkspace(workspace.id);
                        setWorkspaceOpen(false);
                      } catch (error) {
                        window.alert(error instanceof Error ? error.message : "Failed to delete workspace");
                      }
                    }}
                    className="rounded-md p-2 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
            {isSystemAdmin && isDefaultWorkspace ? (
              <button type="button" onClick={createWorkspace} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50">
                <Plus className="h-4 w-4" /> Create workspace
              </button>
            ) : null}
          </div>
        )}
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
              className={`flex items-center rounded-lg py-2.5 text-sm transition ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${
                active
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-500"}`}
              />
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
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

      <div className="shrink-0 border-t border-slate-200 p-2 md:p-4">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : "justify-center md:justify-start"}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            A
          </div>
          <div className={`${collapsed ? "hidden" : "hidden min-w-0 flex-1 md:block"}`}>
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="mt-3 hidden min-h-11 w-full items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <p className="mt-3 hidden text-center text-[11px] text-slate-400 md:block">
          Powered by girjasoft
        </p>
      </div>
    </aside>
  );
}
