"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { api, PaginatedResponse, Payment } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SearchInput,
} from "@/components/ui";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"paidAt" | "amount" | "method">("paidAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10", sortBy, sortOrder });
    if (search) params.set("search", search);
    if (method) params.set("method", method);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return api.get<PaginatedResponse<Payment>>(`/payments?${params}`).then((response) => {
      setPayments(response.data); setTotal(response.meta.total); setTotalPages(response.meta.totalPages);
    }).catch((e: Error) => setError(e.message));
  }, [search, method, dateFrom, dateTo, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete payment?")) return;
    try {
      setError("");
      await api.delete(`/payments/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete payment");
    }
  }

  function beginEdit(payment: Payment) {
    setEditing(payment);
    setEditAmount(String(payment.amount));
    setEditMethod(payment.method);
    setEditDate(payment.paidAt.slice(0, 10));
    setEditNotes(payment.notes ?? "");
    setError("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      setSavingEdit(true);
      setError("");
      await api.patch(`/payments/${editing.id}`, {
        amount: Number(editAmount), method: editMethod.trim(), paidAt: editDate, notes: editNotes.trim() || undefined,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update payment");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Track all payment records"
        action={
          <Link href="/payments/new">
            <PrimaryButton variant="success">
              <Plus className="h-4 w-4" />
              Record Payment
            </PrimaryButton>
          </Link>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      {editing ? (
        <Card className="mb-4 p-4">
          <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-5">
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min="0.01" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required aria-label="Payment amount" />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editMethod} onChange={(e) => setEditMethod(e.target.value)} required aria-label="Payment method" />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required aria-label="Payment date" />
            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" aria-label="Payment notes" />
            <div className="flex gap-2"><PrimaryButton type="submit" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save"}</PrimaryButton><button type="button" className="rounded-lg border px-3 text-sm" onClick={() => setEditing(null)}>Cancel</button></div>
          </form>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search invoice, client or method..." /></div>
        <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Filter method" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} />
        <label className="text-sm text-slate-600">From <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
        <label className="text-sm text-slate-600">To <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
        <select aria-label="Sort payments by" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}><option value="paidAt">Sort by date</option><option value="amount">Amount</option><option value="method">Payment method</option></select>
        <select aria-label="Payment sort order" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<CreditCard className="h-7 w-7" />}
                      title="No payments recorded yet"
                      description="Record a payment against an invoice."
                      action={
                        <Link href="/payments/new">
                          <PrimaryButton variant="success">
                            <Plus className="h-4 w-4" />
                            Record Payment
                          </PrimaryButton>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{formatDate(p.paidAt)}</td>
                    <td className="px-4 py-3">
                      {p.invoice?.invoiceNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">{p.client?.name ?? "—"}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => beginEdit(p)} className="mr-2 rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" aria-label="Edit payment"><Pencil className="h-4 w-4" /></button><button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
