"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { PageLoader } from "@/components/Loader";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { api, Quotation } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

const statuses = ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED"];

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [status, setStatus] = useState("DRAFT");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .get<Quotation>(`/quotations/${params.id}`)
      .then((quote) => {
        setQuotation(quote);
        setStatus(quote.status);
        setValidUntil(quote.validUntil?.slice(0, 10) ?? "");
        setNotes(quote.notes ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!quotation) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.patch<Quotation>(
        `/quotations/${quotation.id}`,
        {
          status,
          validUntil,
          notes: notes.trim(),
        },
      );
      setQuotation(updated);
      setMessage("Quotation updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update quotation");
    } finally {
      setSaving(false);
    }
  }

  if (error && !quotation) {
    return <Card className="p-4 text-rose-600">{error}</Card>;
  }
  if (!quotation) return <PageLoader label="Loading quotation..." />;

  return (
    <div>
      <Link
        href="/quotations"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quotations
      </Link>
      <PageHeader
        title={quotation.quoteNumber}
        subtitle={`Quotation for ${quotation.client?.name ?? "client"}`}
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
          <div className="mt-2">
            <StatusBadge status={quotation.status} />
          </div>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Issue / Valid Until</p>
          <p className="mt-2 font-medium">
            {formatDate(quotation.issueDate)} / {formatDate(quotation.validUntil)}
          </p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="text-slate-500">Total</p>
          <p className="mt-2 text-xl font-semibold">
            {formatMoney(quotation.total)}
          </p>
        </Card>
      </div>

      <form onSubmit={save} className="mb-6">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">
            Quotation status and details
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Status *">
              <select
                required
                className={inputClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valid Until *">
              <input
                required
                type="date"
                className={inputClass}
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notes">
              <textarea
                rows={3}
                className={inputClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </div>
          <PrimaryButton type="submit" className="mt-4" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save quotation"}
          </PrimaryButton>
        </Card>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit price</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(quotation.items ?? []).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-xs text-slate-500">
                        {item.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{Number(item.quantity)}</td>
                  <td className="px-4 py-3">{formatMoney(item.unitPrice)}</td>
                  <td className="px-4 py-3">{Number(item.taxRate)}%</td>
                  <td className="px-4 py-3">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 border-t border-slate-200 px-4 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatMoney(quotation.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax</span>
            <span>{formatMoney(quotation.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(quotation.total)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
