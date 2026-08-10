"use client";

import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FilePlus2 },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: ReceiptIndianRupee },
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

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex shrink-0 items-center gap-3 px-5 py-5">
        <Image
          src="/girjasoft_logo-removebg-preview.png"
          alt="Girjasoft"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <div>
          <Image
            src="/girjasoft_name_logo-removebg-preview.png"
            alt="Girjasoft"
            width={110}
            height={20}
            className="h-5 w-auto object-contain object-left"
          />
          <p className="text-xs text-slate-500">Invoice System</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-500"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            A
          </div>
          <div className="min-w-0 flex-1">
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
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Powered by girjasoft
        </p>
      </div>
    </aside>
  );
}
