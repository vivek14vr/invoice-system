"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Eye, FilePlus2, Plus, Trash2 } from "lucide-react";
import { api, PaginatedResponse, Quotation } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Card,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SearchInput,
  StatusBadge,
} from "@/components/ui";

const filters = [
  "ALL",
  "DRAFT",
  "SENT",
  "VIEWED",
  "APPROVED",
  "REJECTED",
] as const;
const quoteStatuses = filters.filter((filter) => filter !== "ALL");

export default function QuotationsPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "quoteNumber" | "issueDate" | "validUntil">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", "10");
    const qs = params.toString();
    api
      .get<PaginatedResponse<Quotation>>(`/quotations${qs ? `?${qs}` : ""}`)
      .then((response) => { setQuotes(response.data); setTotal(response.meta.total); setTotalPages(response.meta.totalPages); })
      .catch((e: Error) => setError(e.message));
  }, [search, status, dateFrom, dateTo, sortBy, sortOrder, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete quotation?")) return;
    try {
      await api.delete(`/quotations/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete quotation");
    }
  }

  async function updateStatus(id: string, nextStatus: string) {
    setUpdatingId(id);
    setError("");
    try {
      const updated = await api.patch<Quotation>(`/quotations/${id}`, {
        status: nextStatus,
      });
      setQuotes((current) =>
        current.map((quote) => (quote.id === id ? updated : quote)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update quotation");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Create and manage your quotations"
        action={
          <Link href="/quotations/new">
            <PrimaryButton variant="success">
              <Plus className="h-4 w-4" />
              New Quotation
            </PrimaryButton>
          </Link>
        }
      />

      {error ? (
        <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search by quotation number..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatus(f); setPage(1); }}
              className={`rounded-lg px-3 py-2 text-sm ${
                status === f
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {f === "ALL"
                ? "All Quotations"
                : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">From <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} /></label>
        <label className="text-sm text-slate-600">To <input type="date" className="ml-1 rounded-lg border border-slate-200 px-2 py-1.5" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} /></label>
        <select aria-label="Sort quotations by" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}><option value="createdAt">Sort by created date</option><option value="quoteNumber">Quotation number</option><option value="issueDate">Quotation date</option><option value="validUntil">Valid until</option></select>
        <select aria-label="Quotation sort order" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<FilePlus2 className="h-7 w-7" />}
                      title="No quotations found"
                      description="Create your first quotation to get started"
                      action={
                        <Link href="/quotations/new">
                          <PrimaryButton variant="success">
                            <Plus className="h-4 w-4" />
                            New Quotation
                          </PrimaryButton>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                quotes.map((q) => (
                  <tr
                    key={q.id}
                    className="group cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open quotation ${q.quoteNumber}`}
                    onClick={() => router.push(`/quotations/${q.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/quotations/${q.id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="text-slate-900 group-hover:text-blue-600">
                        {q.quoteNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">{q.client?.name ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(q.issueDate)}</td>
                    <td className="px-4 py-3">{formatDate(q.validUntil)}</td>
                    <td className="px-4 py-3">{formatMoney(q.total)}</td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <StatusBadge status={q.status} />
                        <select
                          aria-label={`Change status for ${q.quoteNumber}`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                          value={q.status}
                          disabled={updatingId === q.id}
                          onChange={(event) =>
                            updateStatus(q.id, event.target.value)
                          }
                        >
                          {quoteStatuses.map((quoteStatus) => (
                            <option key={quoteStatus} value={quoteStatus}>
                              {quoteStatus.charAt(0) +
                                quoteStatus.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/quotations/${q.id}`}
                          title="View quotation"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void remove(q.id);
                          }}
                          title="Delete quotation"
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
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
