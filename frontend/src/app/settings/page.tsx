"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  CreditCard,
  FileText,
  Hash,
  Percent,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Plus,
} from "lucide-react";
import { api, SettingsPayload } from "@/lib/api";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  inputClass,
} from "@/components/ui";

type Tab = "general" | "invoice" | "tax" | "groups" | "methods";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () =>
    api
      .get<SettingsPayload>("/settings")
      .then((payload) => {
        setData(payload);
        setSettings(payload.settings);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function saveGeneral(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = await api.patch<SettingsPayload>("/settings", {
        settings,
      });
      setData(payload);
      setSettings(payload.settings);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
    { id: "general", label: "General", icon: SettingsIcon },
    { id: "invoice", label: "Invoice", icon: FileText },
    { id: "tax", label: "Tax Rates", icon: Percent },
    { id: "groups", label: "Invoice Groups", icon: Hash },
    { id: "methods", label: "Payment Methods", icon: CreditCard },
  ];

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your Girijasoft Invoices application."
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}
      {message ? (
        <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                  active
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-blue-600" : ""}`} />
                {t.label}
              </button>
            );
          })}
        </Card>

        <Card className="p-5">
          {tab === "general" || tab === "invoice" ? (
            <form onSubmit={saveGeneral} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {tab === "general" ? "General Settings" : "Invoice Settings"}
                </h2>
                <p className="text-sm text-slate-500">
                  {tab === "general"
                    ? "Basic application configuration"
                    : "Configure invoice defaults and behavior"}
                </p>
              </div>

              {tab === "general" ? (
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Application
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(
                        [
                          ["app_name", "Application Name"],
                          ["default_language", "Default Language"],
                          ["currency_symbol", "Currency Symbol"],
                          ["currency_code", "Currency Code"],
                          ["date_format", "Date Format"],
                          ["default_country", "Default Country"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            className={inputClass}
                            value={settings[key] ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-slate-100 pt-6">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Invoice Branding
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Upload a company logo and stamp for generated invoice
                        PDFs. PNG with a transparent background works best.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <BrandingImageField
                        label="Company Logo"
                        value={settings.company_logo ?? ""}
                        onChange={(value) => {
                          setSettings((current) => ({
                            ...current,
                            company_logo: value,
                          }));
                          setMessage("");
                        }}
                        onError={setError}
                      />
                      <BrandingImageField
                        label="Company Stamp"
                        value={settings.company_stamp ?? ""}
                        onChange={(value) => {
                          setSettings((current) => ({
                            ...current,
                            company_stamp: value,
                          }));
                          setMessage("");
                        }}
                        onError={setError}
                      />
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-slate-100 pt-6">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Your Company (Seller)
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Shown on the left of every Tax Invoice PDF.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(
                        [
                          ["company_name", "Company Name"],
                          ["company_email", "Email"],
                          ["company_phone", "Phone"],
                          ["company_gstin", "GSTIN"],
                          ["company_pan", "PAN"],
                          ["company_state", "State Name"],
                          ["company_state_code", "State Code"],
                          ["company_signatory", "Signatory Label"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            className={inputClass}
                            value={settings[key] ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <Field label="Company Address">
                      <textarea
                        className={inputClass}
                        rows={3}
                        value={settings.company_address ?? ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            company_address: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </section>

                  <section className="space-y-4 border-t border-slate-100 pt-6">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Bank Details
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Printed under &quot;Company&apos;s Bank Details&quot; on
                        the invoice.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(
                        [
                          ["company_bank_holder", "A/c Holder Name"],
                          ["company_bank_name", "Bank Name"],
                          ["company_bank_account", "Account Number"],
                          ["company_bank_branch", "Branch"],
                          ["company_bank_ifsc", "IFSC Code"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            className={inputClass}
                            value={settings[key] ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [key]: e.target.value,
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Invoices Due After (days)">
                      <input
                        className={inputClass}
                        value={settings.invoices_due_after ?? ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            invoices_due_after: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Quotes Expire After (days)">
                      <input
                        className={inputClass}
                        value={settings.quotes_expire_after ?? ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            quotes_expire_after: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Default Consignee (Ship to)">
                    <input
                      className={inputClass}
                      placeholder="Not Applicable"
                      value={settings.default_consignee ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          default_consignee: e.target.value,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Used when an invoice has no consignee filled in.
                    </p>
                  </Field>
                  <Field label="Default Invoice Terms (Mode/Terms of Payment)">
                    <textarea
                      className={inputClass}
                      rows={4}
                      placeholder="Enter default invoice terms..."
                      value={settings.default_invoice_terms ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          default_invoice_terms: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="PDF Footer Text">
                    <input
                      className={inputClass}
                      value={settings.pdf_footer_text ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pdf_footer_text: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              )}

              <PrimaryButton type="submit">
                <Save className="h-4 w-4" />
                Save Changes
              </PrimaryButton>
            </form>
          ) : null}

          {tab === "tax" && data ? (
            <TaxRatesPanel data={data} onChange={load} />
          ) : null}
          {tab === "groups" && data ? (
            <GroupsPanel data={data} onChange={load} />
          ) : null}
          {tab === "methods" && data ? (
            <MethodsPanel data={data} onChange={load} />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

const MAX_BRANDING_IMAGE_BYTES = 1.5 * 1024 * 1024;

function BrandingImageField({
  label,
  value,
  onChange,
  onError,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      onError(`${label} must be a PNG or JPEG image.`);
      return;
    }
    if (file.size > MAX_BRANDING_IMAGE_BYTES) {
      onError(`${label} must be 1.5 MB or smaller.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        onError(`Could not read the ${label.toLowerCase()}.`);
        return;
      }
      onError("");
      onChange(reader.result);
    };
    reader.onerror = () =>
      onError(`Could not read the ${label.toLowerCase()}.`);
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-medium text-rose-600 hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
        {value ? (
          <Image
            src={value}
            alt={`${label} preview`}
            width={180}
            height={96}
            unoptimized
            className="max-h-24 w-auto object-contain"
          />
        ) : (
          <p className="text-center text-xs text-slate-400">
            No {label.toLowerCase()} uploaded
          </p>
        )}
      </div>
      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
        {value ? "Replace image" : "Choose image"}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={upload}
        />
      </label>
      <p className="mt-2 text-xs text-slate-400">PNG or JPEG, up to 1.5 MB</p>
    </div>
  );
}

function TaxRatesPanel({
  data,
  onChange,
}: {
  data: SettingsPayload;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState(0);

  async function add() {
    if (!name) return;
    await api.post("/settings/tax-rates", { name, rate, isDefault: false });
    setName("");
    setRate(0);
    onChange();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tax Rates</h2>
          <p className="text-sm text-slate-500">Manage your tax rates</p>
        </div>
        <PrimaryButton onClick={add}>
          <Plus className="h-4 w-4" />
          Add Tax Rate
        </PrimaryButton>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Name e.g. GST 18%"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          className={inputClass}
          placeholder="Rate"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </div>
      <div className="space-y-2">
        {data.taxRates.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                %
              </div>
              <div>
                <p className="font-medium">
                  {t.name}{" "}
                  {t.isDefault ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-500">{Number(t.rate)}%</p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.delete(`/settings/tax-rates/${t.id}`);
                onChange();
              }}
              className="text-slate-400 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsPanel({
  data,
  onChange,
}: {
  data: SettingsPayload;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("INV-{{{year}}}-{{{id}}}");

  async function add() {
    if (!name) return;
    await api.post("/settings/invoice-groups", { name, template });
    setName("");
    onChange();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invoice Groups</h2>
          <p className="text-sm text-slate-500">
            Manage invoice numbering schemes
          </p>
        </div>
        <PrimaryButton onClick={add}>
          <Plus className="h-4 w-4" />
          Add Group
        </PrimaryButton>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {data.invoiceGroups.map((g) => (
          <div
            key={g.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                #
              </div>
              <div>
                <p className="font-medium">
                  {g.name}{" "}
                  {g.isDefault ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-500">{g.template}</p>
                <p className="text-xs text-slate-400">Next: {g.nextId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.delete(`/settings/invoice-groups/${g.id}`);
                onChange();
              }}
              className="text-slate-400 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodsPanel({
  data,
  onChange,
}: {
  data: SettingsPayload;
  onChange: () => void;
}) {
  const [name, setName] = useState("");

  async function add() {
    if (!name) return;
    await api.post("/settings/payment-methods", { name });
    setName("");
    onChange();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payment Methods</h2>
          <p className="text-sm text-slate-500">
            Manage available payment methods.
          </p>
        </div>
        <PrimaryButton onClick={add}>
          <Plus className="h-4 w-4" />
          Add Method
        </PrimaryButton>
      </div>
      <div className="mb-4">
        <input
          className={inputClass}
          placeholder="Method name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {data.paymentMethods.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CreditCard className="h-4 w-4" />
              </div>
              <p className="font-medium">
                {m.name}{" "}
                {m.isDefault ? (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    Default
                  </span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.delete(`/settings/payment-methods/${m.id}`);
                onChange();
              }}
              className="text-slate-400 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
