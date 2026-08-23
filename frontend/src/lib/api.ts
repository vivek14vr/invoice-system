import { notifyLoadingStart, notifyLoadingStop } from "@/lib/loading-bus";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  notifyLoadingStart();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      window.location.assign("/login");
    }
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const payload = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(payload.message)) message = payload.message.join(", ");
        else if (payload.message) message = payload.message;
      } catch {
        // Keep non-JSON server responses as-is.
      }
      throw new Error(message || `Request failed: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } finally {
    notifyLoadingStop();
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  pdfUrl: (invoiceId: string) => `${API_URL}/invoices/${invoiceId}/pdf`,
  expenseAttachmentUrl: (expenseId: string) => `${API_URL}/expenses/${expenseId}/attachment`,
  reportsExportUrl: (query: string) => `${API_URL}/reports/export?${query}`,
};

export type ReportResponse = {
  filters: { type: string; dateFrom?: string; dateTo?: string };
  summary: Record<string, number>;
  rows: { type: string; date: string; number: string; party: string; amount: number; status: string; balanceDue: number | string }[];
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: "ADMIN" | "READ_ONLY";
  companyId?: string | null;
  workspace?: { id: string; name: string } | null;
};

export type Company = { id: string; name: string; legalName?: string | null; gstin?: string | null; state?: string | null; stateCode?: string | null };
export type Workspace = Company & { role: "ADMIN" | "READ_ONLY" };
export type ManagedUser = AuthUser & { company?: Company | null };

export type AuthResponse = {
  user: AuthUser;
  expiresAt?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type Client = {
  id: string;
  firstName: string;
  lastName?: string | null;
  company?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  address?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  postalCode?: string | null;
  country?: string | null;
  vatGstNumber?: string | null;
  taxCodePan?: string | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceNumberPrefix?: string | null;
  invoiceNumberSuffix?: string | null;
  clientId: string;
  client?: Client;
  issueDate: string;
  dueDate?: string | null;
  status: string;
  taxRate: number | string;
  discountPercent?: number | string;
  discountAmount?: number | string;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
  paidAmount?: number | string;
  balanceDue?: number | string;
  payments?: Payment[];
  notes?: string | null;
  terms?: string | null;
  deliveryNote?: string | null;
  referenceNo?: string | null;
  otherReferences?: string | null;
  buyerOrderNo?: string | null;
  buyerOrderDate?: string | null;
  dispatchDocNo?: string | null;
  deliveryNoteDate?: string | null;
  dispatchedThrough?: string | null;
  destination?: string | null;
  termsOfDelivery?: string | null;
  consigneeName?: string | null;
  consigneeAddress?: string | null;
  consigneeGstin?: string | null;
  consigneeState?: string | null;
  consigneeStateCode?: string | null;
  items?: {
    id: string;
    name?: string;
    description?: string | null;
    hsnSac?: string | null;
    unit?: string | null;
    quantity: number | string;
    unitPrice: number | string;
    taxRate?: number | string;
    amount: number | string;
  }[];
};

export type Quotation = {
  id: string;
  quoteNumber: string;
  clientId: string;
  client?: Client;
  issueDate: string;
  validUntil?: string | null;
  status: string;
  taxRate?: number | string;
  subtotal?: number | string;
  taxAmount?: number | string;
  total: number | string;
  notes?: string | null;
  items?: {
    id: string;
    name: string;
    description?: string | null;
    quantity: number | string;
    unitPrice: number | string;
    taxRate: number | string;
    amount: number | string;
  }[];
};

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  price: number | string;
  purchasePrice?: number | string;
  description?: string | null;
};

export type Payment = {
  id: string;
  invoiceId: string;
  method: string;
  amount: number | string;
  paidAt: string;
  notes?: string | null;
  invoice?: Invoice;
  client?: Client;
};

export type Expense = {
  id: string;
  invoiceNumber: string;
  vendorName?: string | null;
  vatGstNumber?: string | null;
  category: string;
  paymentMode: string;
  expenseDate: string;
  itemDetails: string;
  quantity: number | string;
  amount: number | string;
  gstRate: number | string;
  gstAmount: number | string;
  total: number | string;
  balanceDue: number | string;
  notes?: string | null;
  attachmentName?: string | null;
};

export type DashboardData = {
  totals: {
    clients: number;
    invoiced: number;
    paid: number;
    overdue: number;
  };
  invoiceOverview: { status: string; count: number; amount: number }[];
  quoteOverview: { status: string; count: number; amount: number }[];
  recentInvoices: Invoice[];
  recentQuotes: Quotation[];
};

export type SettingsPayload = {
  settings: Record<string, string>;
  taxRates: { id: string; name: string; rate: number | string; isDefault: boolean }[];
  paymentMethods: { id: string; name: string; isDefault: boolean }[];
  invoiceGroups: {
    id: string;
    name: string;
    template: string;
    nextId: number;
    isDefault: boolean;
  }[];
};
