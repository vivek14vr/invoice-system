"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { api, Client, Invoice } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { PageLoader } from "@/components/Loader";
import { Card, PageHeader, PrimaryButton, StatusBadge } from "@/components/ui";

type ClientDetail = Client & { invoices?: Invoice[] };

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ClientDetail>(`/clients/${params.id}`)
      .then(setClient)
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  if (error) {
    return <Card className="p-4 text-rose-600">{error}</Card>;
  }

  if (!client) {
    return <PageLoader label="Loading client..." />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={client.name} subtitle="Client details and invoices" />
        <Link href={`/clients/${client.id}/edit`}>
          <PrimaryButton variant="secondary">
            <Pencil className="h-4 w-4" />
            Edit Client
          </PrimaryButton>
        </Link>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-5 text-sm">
          <h3 className="mb-2 font-semibold text-slate-900">Basic / Contact</h3>
          <p>
            <span className="text-slate-500">Name:</span> {client.firstName}{" "}
            {client.lastName || ""}
          </p>
          <p>
            <span className="text-slate-500">Company:</span>{" "}
            {client.company || "—"}
          </p>
          <p>
            <span className="text-slate-500">Email:</span> {client.email || "—"}
          </p>
          <p>
            <span className="text-slate-500">Phone:</span> {client.phone || "—"}
          </p>
          <p>
            <span className="text-slate-500">Mobile:</span>{" "}
            {client.mobile || "—"}
          </p>
          <p>
            <span className="text-slate-500">Website:</span>{" "}
            {client.website || "—"}
          </p>
        </Card>
        <Card className="space-y-2 p-5 text-sm">
          <h3 className="mb-2 font-semibold text-slate-900">Address / Tax</h3>
          <p>
            <span className="text-slate-500">Address:</span>{" "}
            {[client.address, client.addressLine2].filter(Boolean).join(", ") ||
              "—"}
          </p>
          <p>
            <span className="text-slate-500">City / State:</span>{" "}
            {[client.city, client.state].filter(Boolean).join(", ") || "—"}
            {client.stateCode ? ` (Code: ${client.stateCode})` : ""}
          </p>
          <p>
            <span className="text-slate-500">ZIP / Country:</span>{" "}
            {[client.postalCode, client.country].filter(Boolean).join(", ") ||
              "—"}
          </p>
          <p>
            <span className="text-slate-500">GST:</span>{" "}
            {client.vatGstNumber || "—"}
          </p>
          <p>
            <span className="text-slate-500">PAN:</span> {client.taxCodePan || "—"}
          </p>
        </Card>
      </div>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3 font-medium">
          Invoices
        </div>
        <div className="divide-y divide-slate-100">
          {(client.invoices ?? []).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No invoices yet.</p>
          ) : (
            (client.invoices ?? []).map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(inv.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-sm font-medium">
                    {formatMoney(inv.total)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
