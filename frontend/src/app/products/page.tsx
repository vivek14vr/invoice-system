"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Box, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api, Product } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  SearchInput,
  inputClass,
} from "@/components/ui";

const emptyForm = {
  name: "",
  sku: "",
  price: "",
  purchasePrice: "",
  description: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");

  const load = useCallback(
    () =>
      api
        .get<Product[]>(
          `/products${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        )
        .then(setProducts)
        .catch((e: Error) => setError(e.message)),
    [search],
  );

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  function closeForm() {
    setOpen(false);
    setForm(emptyForm);
    setEditingId("");
  }

  function edit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku ?? "",
      price: String(product.price),
      purchasePrice: String(product.purchasePrice ?? ""),
      description: product.description ?? "",
    });
    setOpen(true);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        sku: editingId ? form.sku.trim() || null : form.sku.trim() || undefined,
        price: Number(form.price || 0),
        purchasePrice: Number(form.purchasePrice || 0),
        description: editingId
          ? form.description.trim() || null
          : form.description.trim() || undefined,
      };
      if (editingId) {
        await api.patch(`/products/${editingId}`, payload);
      } else {
        await api.post("/products", payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete product?")) return;
    await api.delete(`/products/${id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog"
        action={
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Product
          </PrimaryButton>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      {open ? (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId ? "Edit Product" : "New Product"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name *">
                <input
                  required
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="SKU">
                <input
                  className={inputClass}
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </Field>
              <Field label="Selling Price *">
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>
              <Field label="Purchase Price">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={form.purchasePrice}
                  onChange={(e) =>
                    setForm({ ...form, purchasePrice: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
            <div className="flex gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
              </PrimaryButton>
              <PrimaryButton variant="secondary" onClick={closeForm}>
                Cancel
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search products..."
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={<Box className="h-7 w-7" />}
                      title="No products found"
                      description="Add your first product to get started"
                      action={
                        <PrimaryButton onClick={() => setOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add Product
                        </PrimaryButton>
                      }
                    />
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-slate-400 line-clamp-1">
                          {p.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.sku || "—"}</td>
                    <td className="px-4 py-3">{formatMoney(p.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => edit(p)}
                          title="Edit product"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(p.id)}
                          title="Delete product"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
