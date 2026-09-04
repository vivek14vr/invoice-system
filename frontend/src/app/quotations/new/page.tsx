"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  api,
  Client,
  PaginatedResponse,
  Product,
  SettingsPayload,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { compactSearch } from "@/lib/search";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  inputClass,
} from "@/components/ui";

type LineItem = {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: number;
};

function toAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeAmountInput(value: string, maxIntDigits = 10) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [rawInt = "", ...rest] = cleaned.split(".");
  const intPart = rawInt.slice(0, maxIntDigits);
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join("").slice(0, 2)}`;
}

function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

export default function NewQuotationPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<SettingsPayload["taxRates"]>([]);
  const [selectedTaxRateIds, setSelectedTaxRateIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<SettingsPayload["invoiceGroups"]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [invoiceGroupId, setInvoiceGroupId] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { name: "", description: "", quantity: "1", unitPrice: "", taxRate: 18 },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [productSearchIndex, setProductSearchIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.getAll<Product>("/products"),
      api.get<SettingsPayload>("/settings"),
    ])
      .then(([p, s]) => {
        setProducts(p);
        setTaxRates(s.taxRates);
        const quoteGroups = s.invoiceGroups.filter((g) =>
          g.name.toLowerCase().includes("quot"),
        );
        const series = quoteGroups.length ? quoteGroups : s.invoiceGroups;
        setGroups(series);
        const defaultSeries = series.find((group) => group.isDefault) ?? series[0];
        if (defaultSeries) setInvoiceGroupId(defaultSeries.id);
        const expiresAfter = Number(s.settings.quotes_expire_after || 15);
        if (Number.isFinite(expiresAfter) && expiresAfter >= 0) {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + expiresAfter);
          setValidUntil(expiry.toISOString().slice(0, 10));
        }
        const defaultTaxRate = Number(s.taxRates.find((rate) => rate.isDefault)?.rate ?? 18);
        setItems((prev) => prev.map((item) => ({ ...item, taxRate: defaultTaxRate })));
        const defaultTax = s.taxRates.find((rate) => rate.isDefault) ?? s.taxRates.find((rate) => Number(rate.rate) === 18);
        if (defaultTax) setSelectedTaxRateIds([defaultTax.id]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    const query = clientSearch.trim();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (query) params.set("search", query);
      api
        .get<Client[] | PaginatedResponse<Client>>(`/clients?${params.toString()}`)
        .then((response) => setClients(Array.isArray(response) ? response : response.data))
        .catch((e: Error) => setError(e.message));
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [clientSearch]);

  const filteredClients = useMemo(() => {
    const q = compactSearch(clientSearch);
    if (!q) return clients;
    return clients.filter(
      (c) =>
        compactSearch(c.name).includes(q) ||
        compactSearch(c.email ?? '').includes(q) ||
        compactSearch(c.company ?? '').includes(q),
    );
  }, [clients, clientSearch]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const quotationTaxRate = taxRates.filter((rate) => selectedTaxRateIds.includes(rate.id)).reduce((sum, rate) => sum + Number(rate.rate), 0);

  const totals = useMemo(() => {
    const lines = items.map((item) => {
      const subtotal = toAmount(item.quantity) * toAmount(item.unitPrice);
      const tax = (subtotal * quotationTaxRate) / 100;
      return { subtotal, tax, total: subtotal + tax };
    });
    const lineTotals = lines.map((line) => line.total);
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const taxAmount = lines.reduce((sum, line) => sum + line.tax, 0);
    return {
      lineTotals,
      subtotal,
      taxAmount,
      grandTotal: subtotal + taxAmount,
    };
  }, [items, quotationTaxRate]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function filteredProducts(query: string) {
    const q = compactSearch(query);
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (product) =>
          compactSearch(product.name).includes(q) ||
          compactSearch(product.sku ?? '').includes(q),
      )
      .slice(0, 8);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (!validItems.length) {
      setError("Add at least one line item with a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const quote = await api.post<{ id: string }>("/quotations", {
        clientId,
        invoiceGroupId: invoiceGroupId || undefined,
        validUntil,
        notes: notes.trim() || undefined,
        items: validItems.map((i) => ({
          name: i.name.trim(),
          description: i.description.trim() || undefined,
          quantity: toAmount(i.quantity),
          unitPrice: toAmount(i.unitPrice),
          taxRate: quotationTaxRate,
        })),
      });
      router.push("/quotations");
      void quote;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quotation");
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/quotations"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <PageHeader
          title="New Quotation"
          subtitle="Create a new quotation for your client."
        />
      </div>

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Client Details
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
                placeholder="Search clients..."
                value={
                  selectedClient && !showClientList
                    ? selectedClient.name
                    : clientSearch
                }
                onFocus={() => {
                  setShowClientList(true);
                  setClientSearch("");
                }}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientList(true);
                  setClientId("");
                }}
              />
              {showClientList ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredClients.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      No clients found
                    </p>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setClientId(c.id);
                          setClientSearch(c.name);
                          setShowClientList(false);
                        }}
                      >
                        <span className="font-medium text-slate-900">
                          {c.name}
                        </span>
                        {c.email ? (
                          <span className="ml-2 text-slate-400">{c.email}</span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Quotation Settings
            </h2>
            <div className="space-y-4">
              <Field label="Number Series *">
                <select
                  required
                  className={inputClass}
                  value={invoiceGroupId}
                  onChange={(e) => setInvoiceGroupId(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Determines the quotation number format.
                </p>
              </Field>
              <Field label="Valid Until *">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Quotation will expire after this date.
                </p>
              </Field>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Line Items
            </h2>
            <PrimaryButton
              variant="secondary"
              onClick={() =>
                setItems([
                  ...items,
                  {
                    name: "",
                    description: "",
                    quantity: "1",
                    unitPrice: "",
                    taxRate: Number(taxRates.find((rate) => rate.isDefault)?.rate ?? 18),
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Item
            </PrimaryButton>
          </div>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Quotation Tax Rates</p>
            <div className="flex flex-wrap gap-3">
              {taxRates.map((rate) => (
                <label key={rate.id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selectedTaxRateIds.includes(rate.id)} onChange={() => setSelectedTaxRateIds((current) => current.includes(rate.id) ? current.filter((id) => id !== rate.id) : [...current, rate.id])} />
                  {rate.name} ({Number(rate.rate)}%)
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Selected taxes apply to the entire quotation. Combined rate: {quotationTaxRate}%.</p>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_5.5rem_7rem_auto]">
                  <div className="relative min-w-0 space-y-2">
                    <label className="text-xs font-medium text-slate-500">
                      Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      className={inputClass}
                      placeholder="Item name or search product..."
                      value={item.name}
                      onFocus={() => setProductSearchIndex(index)}
                      onChange={(e) => {
                        updateItem(index, { name: e.target.value });
                        setProductSearchIndex(index);
                      }}
                    />
                    {productSearchIndex === index &&
                    filteredProducts(item.name).length > 0 ? (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredProducts(item.name).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              updateItem(index, {
                                name: product.name,
                                description: product.description ?? "",
                                unitPrice: String(Number(product.price)),
                              });
                              setProductSearchIndex(null);
                            }}
                          >
                            <span className="font-medium">{product.name}</span>
                            <span className="ml-2 text-slate-400">
                              {formatMoney(product.price)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      className={inputClass}
                      placeholder="Description (optional)"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      className={`${inputClass} mt-2`}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, {
                          quantity: sanitizeAmountInput(e.target.value, 8),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">
                      Price <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      className={`${inputClass} mt-2`}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, {
                          unitPrice: sanitizeAmountInput(e.target.value, 10),
                        })
                      }
                    />
                  </div>
                  <div className="flex min-w-0 items-start justify-end gap-2 pt-6">
                    <span
                      className="min-w-0 truncate text-right text-sm font-semibold tabular-nums text-emerald-600"
                      title={formatMoney(totals.lineTotals[index] ?? 0)}
                    >
                      {formatMoney(totals.lineTotals[index] ?? 0)}
                    </span>
                    <button
                      type="button"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems(items.filter((_, i) => i !== index))
                      }
                      className="shrink-0 rounded-md p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4 text-slate-600">
              <span className="shrink-0">Subtotal</span>
              <span className="min-w-0 truncate text-right tabular-nums">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            {taxRates.filter((rate) => selectedTaxRateIds.includes(rate.id)).map((rate) => (
              <div key={rate.id} className="flex items-center justify-between gap-4 text-slate-600"><span>{rate.name} ({Number(rate.rate)}%)</span><span>{formatMoney(quotationTaxRate ? (totals.taxAmount * Number(rate.rate)) / quotationTaxRate : 0)}</span></div>
            ))}
            <div className="flex items-center justify-between gap-4 text-base font-semibold text-emerald-600">
              <span className="shrink-0">Grand Total</span>
              <span className="min-w-0 truncate text-right tabular-nums">
                {formatMoney(totals.grandTotal)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Additional Notes
          </h2>
          <textarea
            className={inputClass}
            rows={4}
            placeholder="Notes for this quotation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/quotations">
            <PrimaryButton variant="secondary">Cancel</PrimaryButton>
          </Link>
          <PrimaryButton type="submit" variant="success" disabled={saving}>
            {saving ? "Creating..." : "Create Quotation"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
