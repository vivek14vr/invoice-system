"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus, Plus, Trash2 } from "lucide-react";
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
  hsnSac: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  taxRate: number;
};

function toAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Keep qty/price editable without blowing the layout with huge totals. */
function sanitizeAmountInput(value: string, maxIntDigits = 10) {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [rawInt = "", ...rest] = cleaned.split(".");
  const intPart = rawInt.slice(0, maxIntDigits);
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join("").slice(0, 2)}`;
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeState(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "";
  const codes: Record<string, string> = {
    ap: "37", "andhra pradesh": "37", andhra: "37",
    arunachal: "12", "arunachal pradesh": "12", assam: "18",
    bihar: "10", chhattisgarh: "22", goa: "30", gujarat: "24",
    haryana: "06", "himachal pradesh": "02", jharkhand: "20",
    karnataka: "29", kerala: "32", "madhya pradesh": "23",
    mp: "23", maharashtra: "27", mh: "27", manipur: "14",
    meghalaya: "17", mizoram: "15", nagaland: "13", odisha: "21",
    orissa: "21", punjab: "03", rajasthan: "08", rj: "08",
    sikkim: "11", "tamil nadu": "33", tn: "33", telangana: "36",
    tg: "36", tripura: "16", uttarakhand: "05", uk: "05",
    "west bengal": "19", wb: "19", delhi: "07", dl: "07",
    "jammu and kashmir": "01", ladakh: "38", puducherry: "34",
    chandigarh: "04", "uttar pradesh": "09", up: "09",
  };
  return codes[normalized] ?? normalized;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceGroups, setInvoiceGroups] = useState<
    SettingsPayload["invoiceGroups"]
  >([]);
  const [sellerState, setSellerState] = useState("09");
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [invoiceGroupId, setInvoiceGroupId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [issueDate, setIssueDate] = useState(today());
  const [discountPercent, setDiscountPercent] = useState("0");
  const [terms, setTerms] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [otherReferences, setOtherReferences] = useState("");
  const [buyerOrderNo, setBuyerOrderNo] = useState("");
  const [buyerOrderDate, setBuyerOrderDate] = useState("");
  const [dispatchDocNo, setDispatchDocNo] = useState("");
  const [deliveryNoteDate, setDeliveryNoteDate] = useState("");
  const [dispatchedThrough, setDispatchedThrough] = useState("");
  const [destination, setDestination] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneeGstin, setConsigneeGstin] = useState("");
  const [consigneeState, setConsigneeState] = useState("");
  const [consigneeStateCode, setConsigneeStateCode] = useState("");
  const [productSearchIndex, setProductSearchIndex] = useState<number | null>(
    null,
  );
  const [items, setItems] = useState<LineItem[]>([
    {
      name: "",
      description: "",
      hsnSac: "",
      unit: "Nos",
      quantity: "1",
      unitPrice: "",
      taxRate: 18,
    },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getAll<Product>("/products"),
      api.get<SettingsPayload>("/settings"),
    ])
      .then(([p, s]) => {
        setProducts(p);
        setInvoiceGroups(s.invoiceGroups);
        setSellerState(
          normalizeState(s.settings.company_state_code) ||
            normalizeState(s.settings.company_state) ||
            "09",
        );
        const invGroups = s.invoiceGroups.filter((g) =>
          g.name.toLowerCase().includes("invoice"),
        );
        const series = invGroups.length ? invGroups : s.invoiceGroups;
        const defaultSeries = series.find((group) => group.isDefault) ?? series[0];
        if (defaultSeries) setInvoiceGroupId(defaultSeries.id);
        if (s.settings.default_invoice_terms) {
          setTerms(s.settings.default_invoice_terms);
        }
        const dueAfter = Number(s.settings.invoices_due_after || 30);
        if (!Number.isNaN(dueAfter)) {
          const d = new Date();
          d.setDate(d.getDate() + dueAfter);
          setDueDate(d.toISOString().slice(0, 10));
        }
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
  const nextInvoiceNumber = useMemo(() => {
    const group = invoiceGroups.find((item) => item.id === invoiceGroupId);
    if (!group) return "Generating from the default series...";
    const idToken = "{{{id}}}";
    const tokenPosition = group.template.indexOf(idToken);
    const beforeNumber =
      tokenPosition >= 0 ? group.template.slice(0, tokenPosition) : "";
    const sequence = /0+$/.test(beforeNumber)
      ? String(group.nextId)
      : String(group.nextId).padStart(4, "0");

    return group.template
      .replace(/\{\{\{year\}\}\}/g, String(new Date().getFullYear()))
      .replace(/\{\{\{id\}\}\}/g, sequence);
  }, [invoiceGroupId, invoiceGroups]);
  const invoiceTaxLines = useMemo(() => {
    if (!selectedClient) return [];
    const gstState = selectedClient.vatGstNumber?.trim().slice(0, 2);
    const buyerState =
      normalizeState(selectedClient.stateCode) ||
      normalizeState(selectedClient.state) ||
      (/^\d{2}$/.test(gstState ?? '') ? gstState : '') ||
      sellerState;
    return buyerState === sellerState
      ? [{ name: "CGST", rate: 9 }, { name: "SGST", rate: 9 }]
      : [{ name: "IGST", rate: 18 }];
  }, [selectedClient, sellerState]);
  const invoiceTaxRate = invoiceTaxLines.reduce((sum, tax) => sum + tax.rate, 0);

  const totals = useMemo(() => {
    const discount = toAmount(discountPercent);
    const lines = items.map((item) => {
      const subtotal = toAmount(item.quantity) * toAmount(item.unitPrice);
      const tax = (subtotal * invoiceTaxRate) / 100;
      return { subtotal, tax, total: subtotal + tax };
    });
    const lineTotals = lines.map((line) => line.total);
    const itemsSubtotal = lines.reduce(
      (sum, line) => sum + line.subtotal,
      0,
    );
    const taxAmount = lines.reduce((sum, line) => sum + line.tax, 0);
    const discountAmount = (itemsSubtotal * discount) / 100;
    const grandTotal = itemsSubtotal - discountAmount + taxAmount;
    return {
      lineTotals,
      subtotal: itemsSubtotal,
      discountAmount,
      taxAmount,
      grandTotal,
    };
  }, [items, discountPercent, invoiceTaxRate]);

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
        (p) =>
          compactSearch(p.name).includes(q) ||
          compactSearch(p.sku ?? '').includes(q),
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
      const opt = (v: string) => (v.trim() ? v.trim() : undefined);
      const invoice = await api.post<{ id: string }>("/invoices", {
        clientId,
        invoiceGroupId: invoiceGroupId || undefined,
        dueDate,
        issueDate,
        discountPercent: toAmount(discountPercent),
        taxLines: invoiceTaxLines,
        terms: opt(terms),
        deliveryNote: opt(deliveryNote),
        referenceNo: opt(referenceNo),
        otherReferences: opt(otherReferences),
        buyerOrderNo: opt(buyerOrderNo),
        buyerOrderDate: buyerOrderDate || undefined,
        dispatchDocNo: opt(dispatchDocNo),
        deliveryNoteDate: deliveryNoteDate || undefined,
        dispatchedThrough: opt(dispatchedThrough),
        destination: opt(destination),
        termsOfDelivery: opt(termsOfDelivery),
        consigneeName: opt(consigneeName),
        consigneeAddress: opt(consigneeAddress),
        consigneeGstin: opt(consigneeGstin),
        consigneeState: opt(consigneeState),
        consigneeStateCode: opt(consigneeStateCode),
        items: validItems.map((i) => ({
          name: i.name.trim(),
          description: i.description.trim() || undefined,
          hsnSac: i.hsnSac.trim() || undefined,
          unit: i.unit.trim() || "Nos",
          quantity: toAmount(i.quantity),
          unitPrice: toAmount(i.unitPrice),
          taxRate: invoiceTaxRate,
        })),
      });
      void invoice;
      router.push("/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/invoices"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <PageHeader
          title="New Invoice"
          subtitle="Create a new invoice for your client."
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
            <div className="flex gap-2">
              <div className="relative flex-1">
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
                            <span className="ml-2 text-slate-400">
                              {c.email}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <Link
                href="/clients/new"
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                title="Add client"
              >
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Invoice Settings
            </h2>
            <div className="space-y-4">
              <Field label="Invoice Number">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {nextInvoiceNumber}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  The next number from your default invoice series. It is
                  assigned when you save the invoice.
                </p>
              </Field>
              <Field label="Due Date *">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Payment due by this date.
                </p>
              </Field>
              <Field label="Invoice Date *">
                <input type="date" required className={inputClass} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">Defaults to today; you can change it before saving.</p>
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
                    hsnSac: "",
                    unit: "Nos",
                    quantity: "1",
                    unitPrice: "",
                    taxRate: invoiceTaxRate,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add Item
            </PrimaryButton>
          </div>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">Invoice GST</p>
            {selectedClient ? <p className="text-sm text-slate-700">Client GSTIN: <strong>{selectedClient.vatGstNumber || "Not provided"}</strong> · {invoiceTaxLines.map((tax) => `${tax.name} ${tax.rate}%`).join(" + ")}</p> : <p className="text-sm text-slate-500">Select a client to apply GST automatically.</p>}
            <p className="mt-2 text-xs text-slate-500">Same-state invoices apply CGST 9% + SGST 9%. IGST 18% applies only when the client state differs from the company state.</p>
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
                        {filteredProducts(item.name).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              updateItem(index, {
                                name: p.name,
                                unitPrice: String(Number(p.price)),
                              });
                              setProductSearchIndex(null);
                            }}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-slate-400">
                              {formatMoney(p.price)}
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
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inputClass}
                        placeholder="HSN/SAC"
                        value={item.hsnSac}
                        onChange={(e) =>
                          updateItem(index, { hsnSac: e.target.value })
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Unit (Nos/Day)"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(index, { unit: e.target.value })
                        }
                      />
                    </div>
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
                      className="min-w-0 truncate text-right text-sm font-semibold tabular-nums text-blue-600"
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
            <div className="flex items-center justify-between gap-4 text-slate-600">
              <span className="shrink-0">Discount (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="w-20 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(sanitizeAmountInput(e.target.value, 3))
                }
              />
            </div>
            {invoiceTaxLines
              .map((tax) => (
                <div key={tax.name} className="flex items-center justify-between gap-4 text-slate-600">
                  <span className="shrink-0">{tax.name} ({tax.rate}%)</span>
                  <span>{formatMoney(invoiceTaxRate ? (totals.taxAmount * tax.rate) / invoiceTaxRate : 0)}</span>
                </div>
              ))}
            <div className="flex items-center justify-between gap-4 text-base font-semibold text-blue-600">
              <span className="shrink-0">Grand Total</span>
              <span className="min-w-0 truncate text-right tabular-nums">
                {formatMoney(totals.grandTotal)}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-slate-900">
              Invoice Meta (PDF)
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Optional fields printed in the right-hand grid of the Tax Invoice.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Delivery Note">
                <input
                  className={inputClass}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                />
              </Field>
              <Field label="Mode / Terms of Payment">
                <input
                  className={inputClass}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </Field>
              <Field label="Reference No. & Date">
                <input
                  className={inputClass}
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </Field>
              <Field label="Other References">
                <input
                  className={inputClass}
                  value={otherReferences}
                  onChange={(e) => setOtherReferences(e.target.value)}
                />
              </Field>
              <Field label="Buyer's Order No.">
                <input
                  className={inputClass}
                  value={buyerOrderNo}
                  onChange={(e) => setBuyerOrderNo(e.target.value)}
                />
              </Field>
              <Field label="Buyer's Order Date">
                <input
                  type="date"
                  className={inputClass}
                  value={buyerOrderDate}
                  onChange={(e) => setBuyerOrderDate(e.target.value)}
                />
              </Field>
              <Field label="Dispatch Doc No.">
                <input
                  className={inputClass}
                  value={dispatchDocNo}
                  onChange={(e) => setDispatchDocNo(e.target.value)}
                />
              </Field>
              <Field label="Delivery Note Date">
                <input
                  type="date"
                  className={inputClass}
                  value={deliveryNoteDate}
                  onChange={(e) => setDeliveryNoteDate(e.target.value)}
                />
              </Field>
              <Field label="Dispatched through">
                <input
                  className={inputClass}
                  value={dispatchedThrough}
                  onChange={(e) => setDispatchedThrough(e.target.value)}
                />
              </Field>
              <Field label="Destination">
                <input
                  className={inputClass}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Terms of Delivery">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={termsOfDelivery}
                  onChange={(e) => setTermsOfDelivery(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-base font-semibold text-slate-900">
              Consignee (Ship to)
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Leave blank to use the default from Settings (usually &quot;Not
              Applicable&quot;).
            </p>
            <div className="space-y-3">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={consigneeName}
                  onChange={(e) => setConsigneeName(e.target.value)}
                />
              </Field>
              <Field label="Address">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={consigneeAddress}
                  onChange={(e) => setConsigneeAddress(e.target.value)}
                />
              </Field>
              <Field label="GSTIN">
                <input
                  className={inputClass}
                  value={consigneeGstin}
                  onChange={(e) => setConsigneeGstin(e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="State">
                  <input
                    className={inputClass}
                    value={consigneeState}
                    onChange={(e) => setConsigneeState(e.target.value)}
                  />
                </Field>
                <Field label="State Code">
                  <input
                    className={inputClass}
                    value={consigneeStateCode}
                    onChange={(e) => setConsigneeStateCode(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/invoices">
            <PrimaryButton variant="secondary">Cancel</PrimaryButton>
          </Link>
          <PrimaryButton type="submit" disabled={saving}>
            <FilePlus className="h-4 w-4" />
            {saving ? "Creating..." : "Create Invoice"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
