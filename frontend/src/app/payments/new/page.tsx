"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { api, Invoice, SettingsPayload } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  StatusBadge,
  inputClass,
} from "@/components/ui";

export default function RecordPaymentPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [methods, setMethods] = useState<SettingsPayload["paymentMethods"]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const [amount, setAmount] = useState("0.00");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Invoice[]>("/invoices"),
      api.get<SettingsPayload>("/settings"),
    ])
      .then(([inv, settings]) => {
        setInvoices(
          inv.filter(
            (invoice) =>
              invoice.status !== "CANCELLED" &&
              Number(invoice.balanceDue ?? invoice.total) > 0,
          ),
        );
        setMethods(settings.paymentMethods);
        const def = settings.paymentMethods.find((m) => m.isDefault);
        if (def) setMethod(def.name);
        else if (settings.paymentMethods[0]) {
          setMethod(settings.paymentMethods[0].name);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.client?.name.toLowerCase().includes(q),
    );
  }, [invoices, invoiceSearch]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  function selectInvoice(inv: Invoice) {
    setInvoiceId(inv.id);
    setInvoiceSearch(inv.invoiceNumber);
    setShowInvoiceList(false);
    setAmount(Number(inv.balanceDue ?? inv.total).toFixed(2));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invoiceId) {
      setError("Please select an invoice.");
      return;
    }
    if (!method) {
      setError("Please select a payment method.");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    const balanceDue = Number(selectedInvoice?.balanceDue ?? selectedInvoice?.total);
    if (selectedInvoice && value > balanceDue + 0.005) {
      setError(`Amount cannot exceed the balance due of ${formatMoney(balanceDue)}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/payments", {
        invoiceId,
        method,
        amount: value,
        paidAt,
        notes: notes.trim() || undefined,
      });
      router.push("/payments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/payments"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <PageHeader
          title="Record Payment"
          subtitle="Record a new payment for an invoice"
        />
      </div>

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Invoice
            </h2>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                />
              </svg>
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search invoices..."
                value={
                  selectedInvoice && !showInvoiceList
                    ? selectedInvoice.invoiceNumber
                    : invoiceSearch
                }
                onFocus={() => {
                  setShowInvoiceList(true);
                  setInvoiceSearch("");
                }}
                onChange={(e) => {
                  setInvoiceSearch(e.target.value);
                  setShowInvoiceList(true);
                  setInvoiceId("");
                }}
              />
              {showInvoiceList ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredInvoices.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      No invoices found
                    </p>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => selectInvoice(inv)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-slate-600">
                            {formatMoney(inv.total)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {inv.client?.name ?? "—"} · {formatDate(inv.issueDate)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {selectedInvoice ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {selectedInvoice.invoiceNumber}
                  </span>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
                <p className="text-slate-600">
                  Client: {selectedInvoice.client?.name ?? "—"}
                </p>
                <p className="text-slate-600">
                  Due: {formatDate(selectedInvoice.dueDate)}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  Balance due: {formatMoney(
                    selectedInvoice.balanceDue ?? selectedInvoice.total,
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Invoice total {formatMoney(selectedInvoice.total)} · Paid {formatMoney(
                    selectedInvoice.paidAmount ?? 0,
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                Search and select an invoice to record a payment against.
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Payment Details
            </h2>
            <div className="space-y-4">
              <Field label="Amount *">
                <input
                  required
                  type="number"
                  min={0.01}
                  max={
                    selectedInvoice
                      ? Number(
                          selectedInvoice.balanceDue ?? selectedInvoice.total,
                        )
                      : undefined
                  }
                  step="0.01"
                  className={inputClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Payment Date *">
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </Field>
              <Field label="Payment Method">
                <select
                  className={inputClass}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="">Select method...</option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note">
                <textarea
                  className={inputClass}
                  rows={4}
                  placeholder="Optional payment note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/payments">
            <PrimaryButton variant="secondary">Cancel</PrimaryButton>
          </Link>
          <PrimaryButton type="submit" variant="success" disabled={saving}>
            <FileText className="h-4 w-4" />
            {saving ? "Saving..." : "Record Payment"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
