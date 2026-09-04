import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { compactSearch, escapeSearchRegex } from '../common/search';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId?: string | null,
    search?: string,
    method?: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    pageSize = 10,
    sortBy: 'paidAt' | 'amount' | 'method' = 'paidAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const normalizedSearch = search?.trim();
    const normalizedMethod = method?.trim();
    const escapedSearch = normalizedSearch ? escapeSearchRegex(normalizedSearch) : '';
    const escapedMethod = normalizedMethod ? escapeSearchRegex(normalizedMethod) : '';
    const escapedCompactSearch = normalizedSearch ? escapeSearchRegex(compactSearch(normalizedSearch)) : '';
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
    const where = {
      AND: [
        companyId ? { companyId } : {},
        normalizedMethod ? { method: { contains: escapedMethod, mode: 'insensitive' as const } } : {},
        from || to
          ? {
              paidAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {},
        normalizedSearch
          ? {
              OR: [
                { method: { contains: escapedSearch, mode: 'insensitive' as const } },
                { invoice: { invoiceNumber: { contains: escapedSearch, mode: 'insensitive' as const } } },
                { client: { name: { contains: escapedSearch, mode: 'insensitive' as const } } },
                { client: { searchKey: { contains: escapedCompactSearch, mode: 'insensitive' as const } } },
              ],
            }
          : {},
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { invoice: true, client: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async create(dto: CreatePaymentDto, companyId?: string | null) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (!invoice || (companyId && invoice.companyId !== companyId))
      throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot record a payment for a cancelled invoice',
      );
    }

    const alreadyPaid = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const balanceDue = Math.max(0, Number(invoice.total) - alreadyPaid);
    if (balanceDue <= 0) {
      throw new BadRequestException('This invoice is already fully paid');
    }
    if (dto.amount > balanceDue + 0.005) {
      throw new BadRequestException(
        `Payment exceeds the remaining balance of ${balanceDue.toFixed(2)}`,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: dto.invoiceId,
          clientId: invoice.clientId,
          method: dto.method,
          amount: dto.amount,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          notes: dto.notes,
          companyId: companyId ?? undefined,
        },
      });
      const paid = alreadyPaid + dto.amount;
      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status:
            paid + 0.005 >= Number(invoice.total)
              ? InvoiceStatus.PAID
              : InvoiceStatus.SENT,
        },
      });
      return created;
    });

    return this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: { invoice: true, client: true },
    });
  }

  async remove(id: string, companyId?: string | null) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment || (companyId && payment.companyId !== companyId))
      throw new NotFoundException('Payment not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });
      const [invoice, paidSum] = await Promise.all([
        tx.invoice.findUnique({ where: { id: payment.invoiceId } }),
        tx.payment.aggregate({
          where: { invoiceId: payment.invoiceId },
          _sum: { amount: true },
        }),
      ]);
      if (invoice && invoice.status !== InvoiceStatus.CANCELLED) {
        const paid = Number(paidSum._sum.amount ?? 0);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status:
              paid + 0.005 >= Number(invoice.total)
                ? InvoiceStatus.PAID
                : InvoiceStatus.SENT,
          },
        });
      }
    });
    return { ok: true };
  }

  async update(id: string, dto: UpdatePaymentDto, companyId?: string | null) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: { include: { payments: { select: { id: true, amount: true } } } } },
    });
    if (!payment || (companyId && payment.companyId !== companyId)) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a payment for a cancelled invoice');
    }

    const currentAmount = Number(payment.amount);
    const otherPaid = payment.invoice.payments
      .filter((item) => item.id !== id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const nextAmount = dto.amount ?? currentAmount;
    const balanceBeforePayment = Math.max(0, Number(payment.invoice.total) - otherPaid);
    if (nextAmount > balanceBeforePayment + 0.005) {
      throw new BadRequestException(
        `Payment exceeds the remaining balance of ${balanceBeforePayment.toFixed(2)}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id },
        data: {
          ...(dto.method !== undefined ? { method: dto.method.trim() } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.paidAt !== undefined ? { paidAt: new Date(dto.paidAt) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
      });
      const paid = otherPaid + nextAmount;
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: paid + 0.005 >= Number(payment.invoice.total)
            ? InvoiceStatus.PAID
            : InvoiceStatus.SENT,
        },
      });
      return result;
    });
    return this.prisma.payment.findUnique({
      where: { id: updated.id },
      include: { invoice: true, client: true },
    });
  }
}
