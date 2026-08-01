"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  FilePlus2,
  FileText,
  UserPlus,
  Users,
  CreditCard,
} from "lucide-react";
import { api, DashboardData } from "@/lib/api";
import { formatMoney, statusLabel } from "@/lib/format";
import { Card, PageHeader, StatusBadge } from "@/components/ui";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const quickActions = [
    {
      href: "/clients/new",
      label: "New Client",
      icon: UserPlus,
      color: "bg-blue-50 text-blue-600",
    },
    {
      href: "/quotations/new",
      label: "New Quote",
      icon: FilePlus2,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      href: "/invoices/new",
      label: "New Invoice",
      icon: FileText,
      color: "bg-violet-50 text-violet-600",
    },
    {
      href: "/payments/new",
      label: "New Payment",
      icon: CreditCard,
      color: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your business this month."
      />

      {error ? (
        <Card className="mb-6 p-4 text-sm text-rose-600">{error}</Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-slate-300 hover:shadow">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-800">
                  {item.label}
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Clients",
            value: String(data?.totals.clients ?? 0),
            icon: Users,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Invoiced",
            value: formatMoney(data?.totals.invoiced ?? 0),
            icon: FileText,
            color: "text-violet-600 bg-violet-50",
          },
          {
            label: "Paid",
            value: formatMoney(data?.totals.paid ?? 0),
            icon: ArrowUpRight,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Overdue",
            value: formatMoney(data?.totals.overdue ?? 0),
            icon: AlertCircle,
            color: "text-slate-600 bg-slate-100",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <OverviewCard
          title="Invoice Overview"
          href="/invoices"
          rows={data?.invoiceOverview ?? []}
        />
        <OverviewCard
          title="Quote Overview"
          href="/quotations"
          rows={data?.quoteOverview ?? []}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentList
          title="Recent Invoices"
          empty="No invoices yet"
          items={(data?.recentInvoices ?? []).map((inv) => ({
            id: inv.id,
            href: `/invoices/${inv.id}`,
            title: inv.invoiceNumber,
            subtitle: inv.client?.name ?? "—",
            amount: formatMoney(inv.total),
            status: inv.status,
          }))}
        />
        <RecentList
          title="Recent Quotes"
          empty="No quotations yet"
          items={(data?.recentQuotes ?? []).map((q) => ({
            id: q.id,
            href: `/quotations/${q.id}`,
            title: q.quoteNumber,
            subtitle: q.client?.name ?? "—",
            amount: formatMoney(q.total),
            status: q.status,
          }))}
        />
      </div>
    </div>
  );
}

function OverviewCard({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: { status: string; count: number; amount: number }[];
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-sm text-blue-600 hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.status}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={row.status} />
                <span className="text-sm text-slate-600">{row.count}</span>
              </div>
              <span className="text-sm font-medium text-slate-800">
                {formatMoney(row.amount)}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function RecentList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: {
    id: string;
    href: string;
    title: string;
    subtitle: string;
    amount: string;
    status: string;
  }[];
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800">
                  {item.amount}
                </p>
                <p className="text-xs text-slate-500">
                  {statusLabel(item.status)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
