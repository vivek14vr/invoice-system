"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import { api, Expense, PaginatedResponse } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  inputClass,
  SearchInput,
} from "@/components/ui";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = () => ({
  invoiceNumber: "",
  vendorName: "",
  vatGstNumber: "",
  category: "",
  paymentMode: "",
  expenseDate: today(),
  itemDetails: "",
  quantity: "1",
  amount: "",
  gstRate: "18",
  balanceDue: "0",
  notes: "",
});

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"expenseDate" | "amount" | "total" | "balanceDue" | "vendorName">("expenseDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [withGst, setWithGst] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10", sortBy, sortOrder });
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (paymentMode) params.set("paymentMode", paymentMode);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return api.get<PaginatedResponse<Expense>>(`/expenses?${params}`).then((response) => {
      setExpenses(response.data); setTotal(response.meta.total); setTotalPages(response.meta.totalPages);
    }).catch((err: Error) => setError(err.message));
  }, [search, category, paymentMode, dateFrom, dateTo, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => {
    const amount = Number(form.amount) || 0;
    const gstRate = withGst ? Number(form.gstRate) || 0 : 0;
    const gstAmount = Math.round((amount * gstRate + Number.EPSILON) * 100) / 10000;
    return { amount, gstRate, gstAmount, total: amount + gstAmount };
  }, [form.amount, form.gstRate, withGst]);

  function update(key: keyof ReturnType<typeof initialForm>, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    if (!attachment) {
      setError("Expense PDF upload is required.");
      setSaving(false);
      return;
    }
    if (attachment.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      setSaving(false);
      return;
    }
    if (attachment.size > 5 * 1024 * 1024) {
      setError("PDF must be 5 MB or smaller.");
      setSaving(false);
      return;
    }
    try {
      const attachmentData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read PDF"));
        reader.readAsDataURL(attachment);
      });
      const created = await api.post<Expense>("/expenses", {
        invoiceNumber: form.invoiceNumber.trim(),
        vendorName: form.vendorName.trim() || undefined,
        vatGstNumber: form.vatGstNumber.trim() || undefined,
        category: form.category.trim(),
        paymentMode: form.paymentMode.trim(),
        expenseDate: form.expenseDate,
        itemDetails: form.itemDetails.trim(),
        quantity: Number(form.quantity) || 0,
        amount: totals.amount,
        gstRate: totals.gstRate,
        balanceDue: Number(form.balanceDue) || 0,
        attachmentData,
        attachmentName: attachment.name,
        notes: form.notes.trim() || undefined,
      });
      setExpenses((current) => [created, ...current]);
      setForm(initialForm());
      setWithGst(false);
      setAttachment(null);
      setAttachmentInputKey((key) => key + 1);
      setMessage("Expense saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function remove(expense: Expense) {
    if (!window.confirm(`Delete expense ${expense.invoiceNumber}?`)) return;
    setError("");
    try {
      await api.delete(`/expenses/${expense.id}`);
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete expense");
    }
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Record business expenses with or without GST."
      />

      {error ? <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card> : null}
      {message ? <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card> : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1"><SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search invoice, vendor or item..." /></div>
        <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Filter category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} />
        <input className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Filter payment mode" value={paymentMode} onChange={(e) => { setPaymentMode(e.target.value); setPage(1); }} />
        <label className="text-sm text-slate-600">From <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
        <label className="text-sm text-slate-600">To <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
        <select aria-label="Sort expenses by" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}><option value="expenseDate">Sort by date</option><option value="amount">Amount before GST</option><option value="total">Total</option><option value="balanceDue">Balance due</option><option value="vendorName">Vendor</option></select>
        <select aria-label="Expense sort order" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Add Expense</h2>
          <p className="mt-1 text-sm text-slate-500">Every field is entered manually.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Invoice No. *">
              <input className={inputClass} value={form.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} required />
            </Field>
            <Field label="Vendor Name">
              <input className={inputClass} placeholder="e.g. ABC Suppliers" value={form.vendorName} onChange={(event) => update("vendorName", event.target.value)} />
            </Field>
            <Field label="VAT ID / GST Number">
              <input className={inputClass} placeholder="Optional" value={form.vatGstNumber} onChange={(event) => update("vatGstNumber", event.target.value)} />
            </Field>
            <Field label="Expense Category *">
              <input className={inputClass} placeholder="e.g. Travel, Office supplies" value={form.category} onChange={(event) => update("category", event.target.value)} required />
            </Field>
            <Field label="Payment Mode *">
              <input className={inputClass} list="payment-modes" placeholder="e.g. Cash, UPI, Bank" value={form.paymentMode} onChange={(event) => update("paymentMode", event.target.value)} required />
              <datalist id="payment-modes"><option value="Cash" /><option value="UPI" /><option value="Bank Transfer" /><option value="Card" /></datalist>
            </Field>
            <Field label="Date of Expense *">
              <input type="date" className={inputClass} value={form.expenseDate} onChange={(event) => update("expenseDate", event.target.value)} required />
            </Field>
            <Field label="Amount (before GST) *">
              <input type="number" min="0" step="0.01" className={inputClass} value={form.amount} onChange={(event) => update("amount", event.target.value)} required />
            </Field>
            <Field label="Quantity">
              <input type="number" min="0" step="0.01" className={inputClass} value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
            </Field>
            <Field label="Balance Due">
              <input type="number" min="0" step="0.01" className={inputClass} value={form.balanceDue} onChange={(event) => update("balanceDue", event.target.value)} />
            </Field>
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={withGst} onChange={(event) => setWithGst(event.target.checked)} />
                Apply GST
              </label>
              {withGst ? (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min="0" step="0.01" className={inputClass} value={form.gstRate} onChange={(event) => update("gstRate", event.target.value)} />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              ) : <p className="mt-2 text-xs text-slate-500">No GST will be added.</p>}
            </div>
          </div>

          <Field label="Item Details *">
            <textarea className={inputClass} rows={3} value={form.itemDetails} onChange={(event) => update("itemDetails", event.target.value)} required />
          </Field>
          <Field label="Notes / Remarks">
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </Field>
          <Field label="Expense Invoice PDF *">
            <input key={attachmentInputKey} type="file" accept="application/pdf,.pdf" className={inputClass} onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} required />
            <p className="mt-1 text-xs text-slate-500">PDF only, maximum 5 MB.</p>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-600">
              Amount: <strong>{formatMoney(totals.amount)}</strong>
              {withGst ? <> · GST ({totals.gstRate}%): <strong>{formatMoney(totals.gstAmount)}</strong></> : null}
              <span className="ml-3 text-base text-slate-900">Total: <strong>{formatMoney(totals.total)}</strong></span>
            </div>
            <PrimaryButton type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : "Save Expense"}
            </PrimaryButton>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Expense History</h2>
        </div>
        {expenses.length === 0 ? (
          <EmptyState icon={<ReceiptIndianRupee className="h-6 w-6" />} title="No expenses yet" description="Add your first business expense above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Invoice No.</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Item Details</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Balance Due</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{expense.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600"><p>{expense.vendorName || "—"}</p>{expense.vatGstNumber ? <p className="text-xs text-slate-400">{expense.vatGstNumber}</p> : null}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.category}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.paymentMode}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.quantity ?? 1}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600"><p className="truncate" title={expense.itemDetails}>{expense.itemDetails}</p>{expense.notes ? <p className="mt-1 truncate text-xs text-slate-400" title={expense.notes}>Note: {expense.notes}</p> : null}{expense.attachmentName ? <a className="mt-1 block text-xs text-blue-600 hover:underline" href={api.expenseAttachmentUrl(expense.id)} target="_blank" rel="noreferrer">View PDF</a> : null}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{Number(expense.gstRate) ? `${Number(expense.gstRate)}% · ${formatMoney(expense.gstAmount)}` : "No GST"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatMoney(expense.balanceDue ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(expense.total)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => remove(expense)} className="rounded-md p-2 text-rose-500 hover:bg-rose-50" aria-label={`Delete ${expense.invoiceNumber}`}><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
