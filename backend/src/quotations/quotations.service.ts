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

  private async nextQuoteNumber(
    invoiceGroupId?: string,
    companyId?: string | null,
  ) {
    const year = new Date().getFullYear();
    const group = invoiceGroupId
      ? await this.prisma.invoiceGroup.findFirst({
          where: { id: invoiceGroupId, companyId: companyId ?? undefined },
        })
      : await this.prisma.invoiceGroup.findFirst({
          where: {
            name: 'Quotation Series',
            companyId: companyId ?? undefined,
          },
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

  async findAll(
    search?: string,
    status?: QuoteStatus,
    companyId?: string | null,
    page = 1,
    pageSize = 10,
    sortBy:
      'quoteNumber' | 'issueDate' | 'validUntil' | 'createdAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    dateFrom?: string,
    dateTo?: string,
  ) {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
    const where = {
      AND: [
        companyId ? { companyId } : {},
        status ? { status } : {},
        from || to
          ? {
              issueDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {},
        search
          ? {
              OR: [
                { quoteNumber: { contains: search } },
                { client: { name: { contains: search } } },
              ],
            }
          : {},
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: { client: true, items: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.quotation.count({ where }),
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

  async findOne(id: string, companyId?: string | null) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
      include: { client: true, items: true },
    });
    if (!quote || (companyId && quote.companyId !== companyId))
      throw new NotFoundException('Quotation not found');
    return quote;
  }

  async create(dto: CreateQuotationDto, companyId?: string | null) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId: companyId ?? undefined },
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
      companyId,
    );

    return this.prisma.quotation.create({
      data: {
        quoteNumber,
        clientId: dto.clientId,
        invoiceGroupId,
        companyId: companyId ?? undefined,
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

  async update(id: string, dto: UpdateQuotationDto, companyId?: string | null) {
    await this.findOne(id, companyId);
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

  async remove(id: string, companyId?: string | null) {
    await this.findOne(id, companyId);
    await this.prisma.quotation.delete({ where: { id } });
    return { ok: true };
  }
}
