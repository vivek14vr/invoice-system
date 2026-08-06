import { Injectable, NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function renderNumber(template: string, year: number, id: number) {
  return template
    .replace(/\{\{\{year\}\}\}/g, String(year))
    .replace(/\{\{\{id\}\}\}/g, String(id).padStart(4, '0'));
}

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextQuoteNumber(invoiceGroupId?: string) {
    const year = new Date().getFullYear();
    const group = invoiceGroupId
      ? await this.prisma.invoiceGroup.findUnique({
          where: { id: invoiceGroupId },
        })
      : await this.prisma.invoiceGroup.findFirst({
          where: { name: 'Quotation Series' },
        });

    let next = 1;
    if (group) {
      const updated = await this.prisma.invoiceGroup.update({
        where: { id: group.id },
        data: { nextId: { increment: 1 } },
      });
      next = updated.nextId - 1;
    }
    const quoteNumber = renderNumber(
      group?.template ?? 'QUO-{{{year}}}-{{{id}}}',
      year,
      next,
    );
    return { quoteNumber, invoiceGroupId: group?.id ?? null };
  }

  findAll(search?: string, status?: QuoteStatus) {
    return this.prisma.quotation.findMany({
      where: {
        AND: [
          status ? { status } : {},
          search
            ? {
                OR: [
                  { quoteNumber: { contains: search } },
                  { client: { name: { contains: search } } },
                ],
              }
            : {},
        ],
      },
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
      include: { client: true, items: true },
    });
    if (!quote) throw new NotFoundException('Quotation not found');
    return quote;
  }

  async create(dto: CreateQuotationDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const lineItems = dto.items.map((item) => {
      const taxRate = item.taxRate;
      const lineSubtotal = money(item.quantity * item.unitPrice);
      const lineTax = money((lineSubtotal * taxRate) / 100);
      return {
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate,
        amount: money(lineSubtotal + lineTax),
        lineSubtotal,
        lineTax,
      };
    });

    const subtotal = money(lineItems.reduce((s, i) => s + i.lineSubtotal, 0));
    const taxAmount = money(lineItems.reduce((s, i) => s + i.lineTax, 0));
    const total = money(subtotal + taxAmount);
    const avgTax = subtotal > 0 ? money((taxAmount / subtotal) * 100) : 0;

    const { quoteNumber, invoiceGroupId } = await this.nextQuoteNumber(
      dto.invoiceGroupId,
    );

    return this.prisma.quotation.create({
      data: {
        quoteNumber,
        clientId: dto.clientId,
        invoiceGroupId,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        validUntil: new Date(dto.validUntil),
        status: dto.status ?? QuoteStatus.DRAFT,
        taxRate: avgTax,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        items: {
          create: lineItems.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            amount: item.amount,
          })),
        },
      },
      include: { client: true, items: true },
    });
  }

  async update(id: string, dto: UpdateQuotationDto) {
    await this.findOne(id);
    return this.prisma.quotation.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.validUntil ? { validUntil: new Date(dto.validUntil) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { client: true, items: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.quotation.delete({ where: { id } });
    return { ok: true };
  }
}
