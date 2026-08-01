"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { api, Invoice } from "@/lib/api";
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    const qs = params.toString();
    api
      .get<Invoice[]>(`/invoices${qs ? `?${qs}` : ""}`)
      .then(setInvoices)
      .catch((e: Error) => setError(e.message));
  }, [search, status]);

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
            onChange={setSearch}
            placeholder="Search by invoice number..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
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
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {inv.invoiceNumber}
                      </Link>
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
                      <div className="flex items-center gap-2">
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
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => remove(inv.id)}
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
      </Card>
    </div>
  );
}
