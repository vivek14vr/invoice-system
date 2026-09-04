"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { api, Client } from "@/lib/api";
import { PageLoader } from "@/components/Loader";
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

export default function EditClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Client>(`/clients/${params.id}`)
      .then((c) => {
        setForm({
          firstName: c.firstName ?? "",
          lastName: c.lastName ?? "",
          company: c.company ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          mobile: c.mobile ?? "",
          website: c.website ?? "",
          address: c.address ?? "",
          addressLine2: c.addressLine2 ?? "",
          city: c.city ?? "",
          state: c.state ?? "",
          stateCode: c.stateCode ?? "",
          postalCode: c.postalCode ?? "",
          country: c.country ?? "IN",
          vatGstNumber: c.vatGstNumber ?? "",
          taxCodePan: c.taxCodePan ?? "",
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [
          k,
          v.trim() ? v.trim() : undefined,
        ]),
      );
      payload.firstName = form.firstName.trim() || undefined;
      payload.company = form.company.trim() || undefined;
      if (!payload.firstName && !payload.company) {
        setError("Enter a first name or company name");
        setSaving(false);
        return;
      }
      payload.country = form.country.trim() || "IN";
      await api.patch(`/clients/${params.id}`, payload);
      router.push(`/clients/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
      setSaving(false);
    }
  }

  if (loading) {
    return <PageLoader label="Loading client..." />;
  }

  return (
    <div>
      <PageHeader
        title="Edit Client"
        subtitle="Update buyer details used on Tax Invoices"
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
              <Field label="First Name or Company *">
                <input
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
          <Link href={`/clients/${params.id}`}>
            <PrimaryButton variant="secondary">Cancel</PrimaryButton>
          </Link>
          <PrimaryButton type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
