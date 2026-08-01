"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  Field,
  PageHeader,
  PrimaryButton,
  inputClass,
} from "@/components/ui";

const emptyForm = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  mobile: "",
  website: "",
  address: "",
  addressLine2: "",
  city: "",
  state: "",
  stateCode: "",
  postalCode: "",
  country: "IN",
  vatGstNumber: "",
  taxCodePan: "",
};

export default function AddClientPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() ? v.trim() : undefined]),
      );
      payload.firstName = form.firstName.trim();
      payload.country = form.country.trim() || "IN";
      await api.post("/clients", payload);
      router.push("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Add Client"
        subtitle="Add a new client to your database"
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <form onSubmit={onSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Basic Information
            </h2>
            <div className="space-y-4">
              <Field label="First Name *">
                <input
                  required
                  className={inputClass}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last Name">
                <input
                  className={inputClass}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </Field>
              <Field label="Company">
                <input
                  className={inputClass}
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Contact Information
            </h2>
            <div className="space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Mobile">
                <input
                  className={inputClass}
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                />
              </Field>
              <Field label="Website">
                <input
                  className={inputClass}
                  placeholder="https://"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Address
            </h2>
            <div className="space-y-4">
              <Field label="Address Line 1">
                <input
                  className={inputClass}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="Address Line 2">
                <input
                  className={inputClass}
                  value={form.addressLine2}
                  onChange={(e) => set("addressLine2", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City">
                  <input
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </Field>
                <Field label="State">
                  <input
                    className={inputClass}
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                  />
                </Field>
                <Field label="State Code">
                  <input
                    className={inputClass}
                    placeholder="e.g. 10"
                    value={form.stateCode}
                    onChange={(e) => set("stateCode", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ZIP / Postal Code">
                  <input
                    className={inputClass}
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                  />
                </Field>
                <Field label="Country">
                  <input
                    className={inputClass}
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Tax Information
            </h2>
            <div className="space-y-4">
              <Field label="VAT ID / GST Number">
                <input
                  className={inputClass}
                  value={form.vatGstNumber}
                  onChange={(e) => set("vatGstNumber", e.target.value)}
                />
              </Field>
              <Field label="Tax Code / PAN">
                <input
                  className={inputClass}
                  value={form.taxCodePan}
                  onChange={(e) => set("taxCodePan", e.target.value)}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link href="/clients">
            <PrimaryButton variant="secondary">Cancel</PrimaryButton>
          </Link>
          <PrimaryButton type="submit" disabled={saving}>
            <FileText className="h-4 w-4" />
            {saving ? "Creating..." : "Create Client"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
