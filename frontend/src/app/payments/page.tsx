"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { api, Payment } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
} from "@/components/ui";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get<Payment[]>("/payments")
      .then(setPayments)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

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
                      <button
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
      </Card>
    </div>
  );
}
