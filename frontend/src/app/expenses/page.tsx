"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, ReceiptIndianRupee, Trash2 } from "lucide-react";
import { api, Expense } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  inputClass,
} from "@/components/ui";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = () => ({
  invoiceNumber: "",
  category: "",
  paymentMode: "",
  expenseDate: today(),
  itemDetails: "",
  amount: "",
  gstRate: "18",
  notes: "",
});

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState(initialForm);
  const [withGst, setWithGst] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () =>
    api
      .get<Expense[]>("/expenses")
      .then(setExpenses)
      .catch((err: Error) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

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
    try {
      const created = await api.post<Expense>("/expenses", {
        invoiceNumber: form.invoiceNumber.trim(),
        category: form.category.trim(),
        paymentMode: form.paymentMode.trim(),
        expenseDate: form.expenseDate,
        itemDetails: form.itemDetails.trim(),
        amount: totals.amount,
        gstRate: totals.gstRate,
        notes: form.notes.trim() || undefined,
      });
      setExpenses((current) => [created, ...current]);
      setForm(initialForm());
      setWithGst(false);
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
                <tr><th className="px-4 py-3">Invoice No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Item Details</th><th className="px-4 py-3 text-right">GST</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{expense.invoiceNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.category}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.paymentMode}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600"><p className="truncate" title={expense.itemDetails}>{expense.itemDetails}</p>{expense.notes ? <p className="mt-1 truncate text-xs text-slate-400" title={expense.notes}>Note: {expense.notes}</p> : null}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{Number(expense.gstRate) ? `${Number(expense.gstRate)}% · ${formatMoney(expense.gstAmount)}` : "No GST"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(expense.total)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => remove(expense)} className="rounded-md p-2 text-rose-500 hover:bg-rose-50" aria-label={`Delete ${expense.invoiceNumber}`}><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
