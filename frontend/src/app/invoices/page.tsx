"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { api, Invoice, PaginatedResponse } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SearchInput,
  StatusBadge,
} from "@/components/ui";

const filters = ["ALL", "DRAFT", "SENT", "PAID", "CANCELLED"] as const;
const invoiceStatuses = filters.filter((filter) => filter !== "ALL");

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "invoiceNumber" | "issueDate" | "dueDate">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", "10");
    const qs = params.toString();
    api
      .get<PaginatedResponse<Invoice>>(`/invoices${qs ? `?${qs}` : ""}`)
      .then((response) => { setInvoices(response.data); setTotal(response.meta.total); setTotalPages(response.meta.totalPages); })
      .catch((e: Error) => setError(e.message));
  }, [search, status, dateFrom, dateTo, sortBy, sortOrder, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this invoice?")) return;
    try {
      setError("");
      await api.delete(`/invoices/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete invoice");
    }
  }

  async function updateStatus(id: string, nextStatus: string) {
    setUpdatingId(id);
    setError("");
    try {
      const updated = await api.patch<Invoice>(`/invoices/${id}`, {
        status: nextStatus,
      });
      setInvoices((current) =>
        current.map((invoice) => (invoice.id === id ? updated : invoice)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoice");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create and manage your invoices"
        action={
          <Link href="/invoices/new">
            <PrimaryButton>
              <Plus className="h-4 w-4" />
              New Invoice
            </PrimaryButton>
          </Link>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search by invoice number..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatus(f); setPage(1); }}
              className={`rounded-lg px-3 py-2 text-sm ${
                status === f
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f === "ALL" ? "All Invoices" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-slate-600">From <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
        <label className="text-sm text-slate-600">To <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
        <select aria-label="Sort invoices by" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}>
          <option value="createdAt">Sort by created date</option><option value="invoiceNumber">Invoice number</option><option value="issueDate">Invoice date</option><option value="dueDate">Due date</option>
        </select>
        <select aria-label="Invoice sort order" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<FileText className="h-7 w-7" />}
                      title="No invoices found"
                      description="Create your first invoice to get started"
                      action={
                        <Link href="/invoices/new">
                          <PrimaryButton>
                            <Plus className="h-4 w-4" />
                            New Invoice
                          </PrimaryButton>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="group cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open invoice ${inv.invoiceNumber}`}
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/invoices/${inv.id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 group-hover:text-blue-600">
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {inv.client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(inv.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(inv.dueDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(inv.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <StatusBadge status={inv.status} />
                        <select
                          aria-label={`Change status for ${inv.invoiceNumber}`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                          value={inv.status}
                          disabled={updatingId === inv.id}
                          onChange={(event) =>
                            updateStatus(inv.id, event.target.value)
                          }
                        >
                          {invoiceStatuses.map((invoiceStatus) => (
                            <option key={invoiceStatus} value={invoiceStatus}>
                              {invoiceStatus.charAt(0) +
                                invoiceStatus.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={api.pdfUrl(inv.id)}
                          target="_blank"
                          rel="noreferrer"
                          title="Download PDF"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void remove(inv.id);
                          }}
                          title="Delete invoice"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
