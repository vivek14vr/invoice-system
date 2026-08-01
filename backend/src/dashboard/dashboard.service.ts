import { Injectable } from '@nestjs/common';
import { InvoiceStatus, QuoteStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      clientCount,
      invoices,
      quotes,
      payments,
      recentInvoices,
      recentQuotes,
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.invoice.findMany({
        select: {
          status: true,
          total: true,
          dueDate: true,
          payments: { select: { amount: true } },
        },
      }),
      this.prisma.quotation.findMany({ select: { status: true, total: true } }),
      this.prisma.payment.findMany({ select: { amount: true } }),
      this.prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
      this.prisma.quotation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
    ]);

    const sumByStatus = (
      rows: { status: string; total: unknown }[],
      statuses: string[],
    ) =>
      statuses.map((status) => {
        const matched = rows.filter((r) => r.status === status);
        return {
          status,
          count: matched.length,
          amount: matched.reduce((s, r) => s + Number(r.total), 0),
        };
      });

    const invoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const now = new Date();
    const overdue = invoices
      .filter(
        (invoice) =>
          invoice.status === InvoiceStatus.SENT &&
          invoice.dueDate !== null &&
          invoice.dueDate < now,
      )
      .reduce((sum, invoice) => {
        const paidForInvoice = invoice.payments.reduce(
          (paidSum, payment) => paidSum + Number(payment.amount),
          0,
        );
        return sum + Math.max(0, Number(invoice.total) - paidForInvoice);
      }, 0);

    return {
      totals: {
        clients: clientCount,
        invoiced,
        paid,
        overdue,
      },
      invoiceOverview: sumByStatus(invoices, [
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        InvoiceStatus.PAID,
        InvoiceStatus.CANCELLED,
      ]),
      quoteOverview: sumByStatus(quotes, [
        QuoteStatus.DRAFT,
        QuoteStatus.SENT,
        QuoteStatus.VIEWED,
        QuoteStatus.APPROVED,
        QuoteStatus.REJECTED,
      ]),
      recentInvoices,
      recentQuotes,
    };
  }
}
