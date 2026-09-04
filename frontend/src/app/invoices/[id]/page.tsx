"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileMinus, Plus, Save, Trash2 } from "lucide-react";
import { api, Client, Invoice, SettingsPayload } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { PageLoader } from "@/components/Loader";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  StatusBadge,
  inputClass,
} from "@/components/ui";

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

type EditableItem = {
  name: string;
  description: string;
  hsnSac: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SettingsPayload["paymentMethods"]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [meta, setMeta] = useState({
    terms: "",
    deliveryNote: "",
    referenceNo: "",
    otherReferences: "",
    buyerOrderNo: "",
    buyerOrderDate: "",
    dispatchDocNo: "",
    deliveryNoteDate: "",
    dispatchedThrough: "",
    destination: "",
    termsOfDelivery: "",
    consigneeName: "",
    consigneeAddress: "",
    consigneeGstin: "",
    consigneeState: "",
    consigneeStateCode: "",
  });

  useEffect(() => {
    Promise.all([
      api.get<Invoice>(`/invoices/${params.id}`),
      api.getAll<Client>("/clients"),
      api.get<SettingsPayload>("/settings"),
    ])
      .then(([inv, allClients, settings]) => {
        setInvoice(inv);
        setClients(allClients);
        setPaymentMethods(settings.paymentMethods);
        const defaultMethod = settings.paymentMethods.find((item) => item.isDefault) ?? settings.paymentMethods[0];
        if (defaultMethod) setPaymentMethod(defaultMethod.name);
        setClientId(inv.clientId);
        setInvoiceNumber(inv.invoiceNumber);
        setIssueDate(toDateInput(inv.issueDate));
        setItems((inv.items ?? []).map((item) => ({
          name: item.name ?? "",
          description: item.description ?? "",
          hsnSac: item.hsnSac ?? "",
          unit: item.unit ?? "Nos",
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })));
        setMeta({
          terms: inv.terms ?? "",
          deliveryNote: inv.deliveryNote ?? "",
          referenceNo: inv.referenceNo ?? "",
          otherReferences: inv.otherReferences ?? "",
          buyerOrderNo: inv.buyerOrderNo ?? "",
          buyerOrderDate: toDateInput(inv.buyerOrderDate),
          dispatchDocNo: inv.dispatchDocNo ?? "",
          deliveryNoteDate: toDateInput(inv.deliveryNoteDate),
          dispatchedThrough: inv.dispatchedThrough ?? "",
          destination: inv.destination ?? "",
          termsOfDelivery: inv.termsOfDelivery ?? "",
          consigneeName: inv.consigneeName ?? "",
          consigneeAddress: inv.consigneeAddress ?? "",
          consigneeGstin: inv.consigneeGstin ?? "",
          consigneeState: inv.consigneeState ?? "",
          consigneeStateCode: inv.consigneeStateCode ?? "",
        });
      })
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  function refreshPaymentAmount(nextInvoice: Invoice) {
    const balance = Number(nextInvoice.balanceDue ?? nextInvoice.total);
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : "");
  }

  async function addPayment(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const value = Number(paymentAmount);
    const balance = Number(invoice.balanceDue ?? invoice.total);
    if (!value || value <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }
    if (value > balance + 0.005) {
      setError(`Payment cannot exceed the balance due of ${formatMoney(balance)}.`);
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }
    setSavingPayment(true);
    setError("");
    setMessage("");
    try {
      await api.post("/payments", { invoiceId: invoice.id, amount: value, method: paymentMethod, paidAt: paymentDate, notes: paymentNotes.trim() || undefined });
      const updated = await api.get<Invoice>(`/invoices/${invoice.id}`);
      setInvoice(updated);
      refreshPaymentAmount(updated);
      setPaymentNotes("");
      setMessage("Payment added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add payment");
    } finally {
      setSavingPayment(false);
    }
  }

  function setField(key: keyof typeof meta, value: string) {
    setMeta((prev) => ({ ...prev, [key]: value }));
  }

  async function updateStatus(status: string) {
    if (!invoice) return;
    setSavingStatus(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.patch<Invoice>(`/invoices/${invoice.id}`, {
        status,
      });
      setInvoice(updated);
      setMessage("Invoice status updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  async function createCreditNote() {
    if (!invoice || !window.confirm("Create a credit note for this invoice?")) return;
    setCreatingCreditNote(true);
    setError("");
    try {
      const note = await api.post<Invoice>(`/invoices/${invoice.id}/credit-note`, { reason: "Customer refund / reimbursement" });
      window.location.assign(`/invoices/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create credit note");
      setCreatingCreditNote(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const opt = (v: string) => (v.trim() ? v.trim() : "");
      const updated = await api.patch<Invoice>(`/invoices/${invoice.id}`, {
        clientId,
        invoiceNumber: invoiceNumber.trim(),
        issueDate,
        items: items
          .filter((item) => item.name.trim())
          .map((item) => ({
            ...item,
            name: item.name.trim(),
            description: item.description.trim() || undefined,
            hsnSac: item.hsnSac.trim() || undefined,
            unit: item.unit.trim() || "Nos",
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            taxRate: Number(invoice.taxRate),
          })),
        terms: opt(meta.terms),
        deliveryNote: opt(meta.deliveryNote),
        referenceNo: opt(meta.referenceNo),
        otherReferences: opt(meta.otherReferences),
        buyerOrderNo: opt(meta.buyerOrderNo),
        buyerOrderDate: meta.buyerOrderDate || null,
        dispatchDocNo: opt(meta.dispatchDocNo),
        deliveryNoteDate: meta.deliveryNoteDate || null,
        dispatchedThrough: opt(meta.dispatchedThrough),
        destination: opt(meta.destination),
        termsOfDelivery: opt(meta.termsOfDelivery),
        consigneeName: opt(meta.consigneeName),
        consigneeAddress: opt(meta.consigneeAddress),
        consigneeGstin: opt(meta.consigneeGstin),
        consigneeState: opt(meta.consigneeState),
        consigneeStateCode: opt(meta.consigneeStateCode),
      });
      setInvoice(updated);
      setItems((updated.items ?? []).map((item) => ({
        name: item.name ?? "",
        description: item.description ?? "",
        hsnSac: item.hsnSac ?? "",
        unit: item.unit ?? "Nos",
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })));
      setClientId(updated.clientId);
      setInvoiceNumber(updated.invoiceNumber);
      setIssueDate(toDateInput(updated.issueDate));
      setMessage("Invoice changes saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (error && !invoice) {
    return <Card className="p-4 text-rose-600">{error}</Card>;
  }
  if (!invoice) return <PageLoader label="Loading invoice..." />;

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={`Invoice for ${invoice.client?.name ?? "client"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={api.pdfUrl(invoice.id)} target="_blank" rel="noreferrer">
              <PrimaryButton>
                <Download className="h-4 w-4" />
                Download PDF
              </PrimaryButton>
            </a>
            {invoice.status !== "CREDIT_NOTE" ? (
              <PrimaryButton variant="secondary" type="button" onClick={createCreditNote} disabled={creatingCreditNote}>
                <FileMinus className="h-4 w-4" />
                {creatingCreditNote ? "Creating..." : "Issue Credit Note"}
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}
      {message ? (
        <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Status</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <select
              aria-label="Change invoice status"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              value={invoice.status}
              disabled={savingStatus}
              onChange={(event) => updateStatus(event.target.value)}
            >
              {['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'CREDIT_NOTE'].map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Issue / Due</p>
          <p className="mt-2 font-medium">
            {formatDate(invoice.issueDate)} / {formatDate(invoice.dueDate)}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Total</p>
          <p className="mt-2 text-xl font-semibold">
            {formatMoney(invoice.total)}
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-500">
            <p>Paid: <strong className="text-emerald-600">{formatMoney(invoice.paidAmount ?? 0)}</strong></p>
            <p>Balance due: <strong className="text-rose-600">{formatMoney(invoice.balanceDue ?? invoice.total)}</strong></p>
          </div>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Payments</h2>
          <span className="text-sm text-slate-500">Balance due: {formatMoney(invoice.balanceDue ?? invoice.total)}</span>
        </div>
        <form onSubmit={addPayment} className="mb-5 grid gap-3 md:grid-cols-4">
          <Field label="Amount *"><input className={inputClass} type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={Number(invoice.balanceDue ?? invoice.total) <= 0} required /></Field>
          <Field label="Payment Date *"><input className={inputClass} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></Field>
          <Field label="Payment Mode *"><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required><option value="">Select mode</option>{paymentMethods.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field>
          <Field label="Notes"><input className={inputClass} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></Field>
          <div className="md:col-span-4"><PrimaryButton type="submit" disabled={savingPayment || Number(invoice.balanceDue ?? invoice.total) <= 0}>{savingPayment ? "Saving..." : "Add Payment"}</PrimaryButton></div>
        </form>
        {invoice.payments?.length ? (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-400"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{invoice.payments.map((payment) => <tr key={payment.id}><td className="px-3 py-2">{formatDate(payment.paidAt)}</td><td className="px-3 py-2">{payment.method}</td><td className="px-3 py-2 text-slate-500">{payment.notes || "—"}</td><td className="px-3 py-2 text-right font-medium">{formatMoney(payment.amount)}</td></tr>)}</tbody></table></div>
        ) : <p className="text-sm text-slate-500">No payments recorded for this invoice.</p>}
      </Card>

      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Bill to (Buyer)</h2>
          <Link
            href={`/clients/${invoice.clientId}/edit`}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit client details
          </Link>
        </div>
        <p className="font-medium">{invoice.client?.name}</p>
        <p className="text-sm text-slate-600">{invoice.client?.company}</p>
        <p className="text-sm text-slate-600">{invoice.client?.email}</p>
        <p className="text-sm text-slate-600">{invoice.client?.phone}</p>
        <p className="text-sm text-slate-600">
          {[invoice.client?.address, invoice.client?.addressLine2]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="text-sm text-slate-600">
          {[invoice.client?.city, invoice.client?.state]
            .filter(Boolean)
            .join(", ")}
          {invoice.client?.stateCode
            ? ` (Code: ${invoice.client.stateCode})`
            : ""}
        </p>
        <p className="text-sm text-slate-600">
          GST: {invoice.client?.vatGstNumber || "—"} · PAN:{" "}
          {invoice.client?.taxCodePan || "—"}
        </p>
      </Card>

      <form onSubmit={saveMeta} className="mb-6 space-y-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Edit Invoice
              </h2>
              <p className="text-xs text-slate-500">
                Update the invoice number, date, client, and goods after generation.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Invoice Number *">
              <input
                className={inputClass}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </Field>
            <Field label="Invoice Date *">
              <input
                type="date"
                className={inputClass}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Client">
              <select
                className={inputClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-5 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1.4fr_1fr_7rem_7rem_5rem_auto]">
                {(["name", "description", "quantity", "unitPrice", "hsnSac"] as const).map((key) => (
                  <input
                    key={key}
                    className={inputClass}
                    placeholder={{ name: "Goods name", description: "Description", quantity: "Qty", unitPrice: "Unit price", hsnSac: "HSN/SAC" }[key]}
                    value={item[key]}
                    required={key === "name"}
                    onChange={(e) => setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: e.target.value } : row))}
                  />
                ))}
                <button
                  type="button"
                  className="rounded-md p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              onClick={() => setItems((prev) => [...prev, { name: "", description: "", hsnSac: "", unit: "Nos", quantity: "1", unitPrice: "0" }])}
            >
              <Plus className="h-4 w-4" /> Add goods
            </button>
          </div>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-slate-900">
              Invoice Meta (PDF)
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Change these anytime — they appear on the Tax Invoice PDF.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["deliveryNote", "Delivery Note"],
                  ["terms", "Mode / Terms of Payment"],
                  ["referenceNo", "Reference No. & Date"],
                  ["otherReferences", "Other References"],
                  ["buyerOrderNo", "Buyer's Order No."],
                  ["dispatchDocNo", "Dispatch Doc No."],
                  ["dispatchedThrough", "Dispatched through"],
                  ["destination", "Destination"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className={inputClass}
                    value={meta[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Buyer's Order Date">
                <input
                  type="date"
                  className={inputClass}
                  value={meta.buyerOrderDate}
                  onChange={(e) => setField("buyerOrderDate", e.target.value)}
                />
              </Field>
              <Field label="Delivery Note Date">
                <input
                  type="date"
                  className={inputClass}
                  value={meta.deliveryNoteDate}
                  onChange={(e) =>
                    setField("deliveryNoteDate", e.target.value)
                  }
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Terms of Delivery">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={meta.termsOfDelivery}
                  onChange={(e) => setField("termsOfDelivery", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Consignee (Ship to)
            </h2>
            <div className="space-y-3">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={meta.consigneeName}
                  onChange={(e) => setField("consigneeName", e.target.value)}
                />
              </Field>
              <Field label="Address">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={meta.consigneeAddress}
                  onChange={(e) => setField("consigneeAddress", e.target.value)}
                />
              </Field>
              <Field label="GSTIN">
                <input
                  className={inputClass}
                  value={meta.consigneeGstin}
                  onChange={(e) => setField("consigneeGstin", e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="State">
                  <input
                    className={inputClass}
                    value={meta.consigneeState}
                    onChange={(e) => setField("consigneeState", e.target.value)}
                  />
                </Field>
                <Field label="State Code">
                  <input
                    className={inputClass}
                    value={meta.consigneeStateCode}
                    onChange={(e) =>
                      setField("consigneeStateCode", e.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-3">
          {message === "Invoice changes saved successfully." ? (
            <span className="text-sm text-emerald-600">Saved successfully.</span>
          ) : null}
          <PrimaryButton type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save PDF Details"}
          </PrimaryButton>
        </div>
      </form>

      <Card>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Unit price</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {"name" in item && item.name
                      ? String(item.name)
                      : item.description}
                  </div>
                  {"name" in item && item.description ? (
                    <div className="text-xs text-slate-500">
                      {item.description}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{Number(item.quantity)}</td>
                <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                <td className="px-4 py-3">{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t border-slate-200 px-4 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              Tax ({Number(invoice.taxRate)}%)
            </span>
            <span>{formatMoney(invoice.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
