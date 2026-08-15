"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { api, Client, PaginatedResponse } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import {
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SearchInput,
} from "@/components/ui";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "name">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api
        .get<PaginatedResponse<Client>>(`/clients?${new URLSearchParams({ page: String(page), pageSize: "10", sortBy, sortOrder, ...(search ? { search } : {}) })}`)
        .then((response) => { setClients(response.data); setTotal(response.meta.total); setTotalPages(response.meta.totalPages); })
        .catch((e: Error) => setError(e.message)),
    [search, page, sortBy, sortOrder],
  );

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this client?")) return;
    await api.delete(`/clients/${id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage your client database."
        action={
          <Link href="/clients/new">
            <PrimaryButton>
              <Plus className="h-4 w-4" />
              Add Client
            </PrimaryButton>
          </Link>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search clients..."
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Sort clients by" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}>
          <option value="createdAt">Sort by newest</option>
          <option value="name">Sort by client name</option>
        </select>
        <select aria-label="Client sort order" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={<Users className="h-7 w-7" />}
                      title="No clients found."
                      description="Create your first client to get started."
                      action={
                        <Link href="/clients/new">
                          <PrimaryButton>
                            <Plus className="h-4 w-4" />
                            Add Client
                          </PrimaryButton>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {client.name}
                      </Link>
                      {client.company ? (
                        <p className="text-xs text-slate-400">{client.company}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{client.email || "—"}</div>
                      <div className="text-xs text-slate-400">
                        {client.mobile || client.phone || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[client.city, client.state].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => remove(client.id)}
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
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
