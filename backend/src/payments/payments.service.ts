import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.payment.findMany({
      include: { invoice: true, client: true },
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
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

  async remove(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
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
}
