"use client";

import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { api, ReportResponse } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { Card, PageHeader, PrimaryButton, inputClass } from "@/components/ui";

export default function ReportsPage() {
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const query = new URLSearchParams({ type, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }).toString();

  async function fetchReport() {
    setError("");
    try { setReport(await api.get<ReportResponse>(`/reports?${query}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to fetch report"); }
  }

  return <div>
    <PageHeader title="Reports" subtitle="Filter and export invoices, payments and expenses." />
    {error ? <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card> : null}
    <Card className="mb-6 p-5">
      <div className="grid gap-4 md:grid-cols-4 md:items-end">
        <label className="text-sm text-slate-600">Report type<select className={`${inputClass} mt-1`} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All records</option><option value="invoices">Invoices</option><option value="payments">Payments</option><option value="expenses">Expenses</option></select></label>
        <label className="text-sm text-slate-600">From date<input className={`${inputClass} mt-1`} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label className="text-sm text-slate-600">To date<input className={`${inputClass} mt-1`} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <div className="flex gap-2"><PrimaryButton type="button" onClick={fetchReport}><BarChart3 className="h-4 w-4" />Fetch Report</PrimaryButton><a href={api.reportsExportUrl(query)}><PrimaryButton type="button" variant="secondary"><Download className="h-4 w-4" />CSV</PrimaryButton></a></div>
      </div>
    </Card>
    {report ? <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Invoices", report.summary.invoiceCount], ["Payments", report.summary.paymentCount], ["Expenses", report.summary.expenseCount], ["Invoiced", report.summary.invoicedAmount], ["Received", report.summary.receivedAmount]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{typeof value === "number" && ["Invoiced", "Received"].includes(String(label)) ? formatMoney(value) : value}</p></Card>)}</div>
      <Card><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Number</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">{report.rows.map((row, index) => <tr key={`${row.type}-${row.number}-${index}`}><td className="px-4 py-3">{row.type}</td><td className="px-4 py-3">{formatDate(row.date)}</td><td className="px-4 py-3">{row.number}</td><td className="px-4 py-3">{row.party || "—"}</td><td className="px-4 py-3 text-right">{formatMoney(row.amount)}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3 text-right">{row.balanceDue === "" ? "—" : formatMoney(row.balanceDue)}</td></tr>)}</tbody></table></div></Card>
    </> : <Card className="p-10 text-center text-sm text-slate-500">Select a date range and fetch a report.</Card>}
  </div>;
}
