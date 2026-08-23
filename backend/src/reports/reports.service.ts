import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ReportType = 'all' | 'invoices' | 'payments' | 'expenses';

function dateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
  return from || to
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : undefined;
}

function csvCell(value: unknown) {
  const text =
    value == null
      ? ''
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ? `${value}`
        : '';
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    companyId?: string | null,
    type: ReportType = 'all',
    dateFrom?: string,
    dateTo?: string,
  ) {
    if (!companyId)
      return { filters: { type, dateFrom, dateTo }, summary: {}, rows: [] };
    const range = dateRange(dateFrom, dateTo);
    const includeInvoices = type === 'all' || type === 'invoices';
    const includePayments = type === 'all' || type === 'payments';
    const includeExpenses = type === 'all' || type === 'expenses';
    const [invoices, payments, expenses] = await Promise.all([
      includeInvoices
        ? this.prisma.invoice.findMany({
            where: { companyId, ...(range ? { issueDate: range } : {}) },
            include: { client: true, payments: { select: { amount: true } } },
            orderBy: { issueDate: 'desc' },
          })
        : null,
      includePayments
        ? this.prisma.payment.findMany({
            where: { companyId, ...(range ? { paidAt: range } : {}) },
            include: { invoice: true, client: true },
            orderBy: { paidAt: 'desc' },
          })
        : null,
      includeExpenses
        ? this.prisma.expense.findMany({
            where: { companyId, ...(range ? { expenseDate: range } : {}) },
            orderBy: { expenseDate: 'desc' },
          })
        : null,
    ]);
    const invoiceRows = invoices ?? [];
    const paymentRows = payments ?? [];
    const expenseRows = expenses ?? [];
    const rows = [
      ...invoiceRows.map((invoice) => {
        const paid = invoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );
        return {
          type: 'Invoice',
          date: invoice.issueDate,
          number: invoice.invoiceNumber,
          party: invoice.client.name,
          amount: Number(invoice.total),
          status: invoice.status,
          balanceDue: Math.max(0, Number(invoice.total) - paid),
        };
      }),
      ...paymentRows.map((payment) => ({
        type: 'Payment',
        date: payment.paidAt,
        number: payment.invoice.invoiceNumber,
        party: payment.client.name,
        amount: Number(payment.amount),
        status: 'RECEIVED',
        balanceDue: '',
      })),
      ...expenseRows.map((expense) => ({
        type: 'Expense',
        date: expense.expenseDate,
        number: expense.invoiceNumber,
        party: expense.vendorName || '',
        amount: Number(expense.total),
        status: 'RECORDED',
        balanceDue: Number(expense.balanceDue),
      })),
    ];
    return {
      filters: { type, dateFrom, dateTo },
      summary: {
        invoiceCount: invoiceRows.length,
        paymentCount: paymentRows.length,
        expenseCount: expenseRows.length,
        invoicedAmount: invoiceRows.reduce(
          (sum, row) => sum + Number(row.total),
          0,
        ),
        receivedAmount: paymentRows.reduce(
          (sum, row) => sum + Number(row.amount),
          0,
        ),
        expenseAmount: expenseRows.reduce(
          (sum, row) => sum + Number(row.total),
          0,
        ),
      },
      rows,
    };
  }

  async csv(
    companyId?: string | null,
    type: ReportType = 'all',
    dateFrom?: string,
    dateTo?: string,
  ) {
    const report = await this.build(companyId, type, dateFrom, dateTo);
    const header = [
      'Type',
      'Date',
      'Number',
      'Party',
      'Amount',
      'Status',
      'Balance Due',
    ];
    const lines = report.rows.map((row) =>
      [
        row.type,
        new Date(row.date).toISOString().slice(0, 10),
        row.number,
        row.party,
        row.amount,
        row.status,
        row.balanceDue,
      ]
        .map(csvCell)
        .join(','),
    );
    return `\uFEFF${header.join(',')}\n${lines.join('\n')}\n`;
  }
}
