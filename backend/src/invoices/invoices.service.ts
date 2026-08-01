import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvoiceDto,
  InvoiceItemDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
import { buildTaxInvoicePdf } from './tax-invoice-pdf';

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function renderNumber(template: string, year: number, id: number) {
  return template
    .replace(/\{\{\{year\}\}\}/g, String(year))
    .replace(/\{\{\{id\}\}\}/g, String(id).padStart(4, '0'));
}

function computeTotals(items: InvoiceItemDto[], discountPercent = 0) {
  const lineItems = items.map((item) => {
    const lineSubtotal = money(item.quantity * item.unitPrice);
    const lineTax = money((lineSubtotal * item.taxRate) / 100);
    return {
      name: item.name,
      description: item.description,
      hsnSac: item.hsnSac,
      unit: item.unit || 'Nos',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      lineSubtotal,
      lineTax,
      amount: money(lineSubtotal + lineTax),
    };
  });

  const itemsSubtotal = money(
    lineItems.reduce((sum, i) => sum + i.lineSubtotal, 0),
  );
  const taxAmount = money(lineItems.reduce((sum, i) => sum + i.lineTax, 0));
  const discountAmount = money((itemsSubtotal * discountPercent) / 100);
  const subtotal = money(itemsSubtotal - discountAmount);
  const total = money(subtotal + taxAmount);
  const avgTax =
    itemsSubtotal > 0 ? money((taxAmount / itemsSubtotal) * 100) : 0;

  return {
    lineItems,
    subtotal: itemsSubtotal,
    discountAmount,
    taxAmount,
    total,
    avgTax,
  };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextInvoiceNumber(invoiceGroupId?: string) {
    const year = new Date().getFullYear();
    const group = invoiceGroupId
      ? await this.prisma.invoiceGroup.findUnique({
          where: { id: invoiceGroupId },
        })
      : await this.prisma.invoiceGroup.findFirst({
          where: { name: 'Invoice Series' },
        });

    let next = 1;
    if (group) {
      const updated = await this.prisma.invoiceGroup.update({
        where: { id: group.id },
        data: { nextId: { increment: 1 } },
      });
      next = updated.nextId - 1;
    }
    const invoiceNumber = renderNumber(
      group?.template ?? 'INV-{{{year}}}-{{{id}}}',
      year,
      next,
    );
    return { invoiceNumber, invoiceGroupId: group?.id ?? null };
  }

  async findAll(search?: string, status?: InvoiceStatus) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        AND: [
          status ? { status } : {},
          search
            ? {
                OR: [
                  { invoiceNumber: { contains: search } },
                  { client: { name: { contains: search } } },
                ],
              }
            : {},
        ],
      },
      include: {
        client: true,
        items: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map((invoice) => {
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      return {
        ...invoice,
        paidAmount,
        balanceDue: Math.max(0, Number(invoice.total) - paidAmount),
      };
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(dto: CreateInvoiceDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const discountPercent = dto.discountPercent ?? 0;
    const { lineItems, subtotal, discountAmount, taxAmount, total, avgTax } =
      computeTotals(dto.items, discountPercent);
    const { invoiceNumber, invoiceGroupId } = await this.nextInvoiceNumber(
      dto.invoiceGroupId,
    );

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: dto.clientId,
        invoiceGroupId,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? InvoiceStatus.DRAFT,
        taxRate: avgTax,
        discountPercent,
        discountAmount,
        subtotal,
        taxAmount,
        total,
        notes: dto.notes,
        terms: dto.terms,
        deliveryNote: dto.deliveryNote,
        referenceNo: dto.referenceNo,
        otherReferences: dto.otherReferences,
        buyerOrderNo: dto.buyerOrderNo,
        buyerOrderDate: dto.buyerOrderDate
          ? new Date(dto.buyerOrderDate)
          : null,
        dispatchDocNo: dto.dispatchDocNo,
        deliveryNoteDate: dto.deliveryNoteDate
          ? new Date(dto.deliveryNoteDate)
          : null,
        dispatchedThrough: dto.dispatchedThrough,
        destination: dto.destination,
        termsOfDelivery: dto.termsOfDelivery,
        consigneeName: dto.consigneeName,
        consigneeAddress: dto.consigneeAddress,
        consigneeGstin: dto.consigneeGstin,
        consigneeState: dto.consigneeState,
        consigneeStateCode: dto.consigneeStateCode,
        items: {
          create: lineItems.map((item) => ({
            name: item.name,
            description: item.description,
            hsnSac: item.hsnSac,
            unit: item.unit,
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

  async update(id: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.issueDate) data.issueDate = new Date(dto.issueDate);
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.status) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.terms !== undefined) data.terms = dto.terms;
    if (dto.deliveryNote !== undefined) data.deliveryNote = dto.deliveryNote;
    if (dto.referenceNo !== undefined) data.referenceNo = dto.referenceNo;
    if (dto.otherReferences !== undefined) {
      data.otherReferences = dto.otherReferences;
    }
    if (dto.buyerOrderNo !== undefined) data.buyerOrderNo = dto.buyerOrderNo;
    if (dto.buyerOrderDate !== undefined) {
      data.buyerOrderDate = dto.buyerOrderDate
        ? new Date(dto.buyerOrderDate)
        : null;
    }
    if (dto.dispatchDocNo !== undefined) data.dispatchDocNo = dto.dispatchDocNo;
    if (dto.deliveryNoteDate !== undefined) {
      data.deliveryNoteDate = dto.deliveryNoteDate
        ? new Date(dto.deliveryNoteDate)
        : null;
    }
    if (dto.dispatchedThrough !== undefined) {
      data.dispatchedThrough = dto.dispatchedThrough;
    }
    if (dto.destination !== undefined) data.destination = dto.destination;
    if (dto.termsOfDelivery !== undefined) {
      data.termsOfDelivery = dto.termsOfDelivery;
    }
    if (dto.consigneeName !== undefined) data.consigneeName = dto.consigneeName;
    if (dto.consigneeAddress !== undefined) {
      data.consigneeAddress = dto.consigneeAddress;
    }
    if (dto.consigneeGstin !== undefined) {
      data.consigneeGstin = dto.consigneeGstin;
    }
    if (dto.consigneeState !== undefined) {
      data.consigneeState = dto.consigneeState;
    }
    if (dto.consigneeStateCode !== undefined) {
      data.consigneeStateCode = dto.consigneeStateCode;
    }

    if (dto.items || dto.discountPercent !== undefined) {
      const items =
        dto.items ??
        existing.items.map((item) => ({
          name: item.name,
          description: item.description ?? undefined,
          hsnSac: item.hsnSac ?? undefined,
          unit: item.unit,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        }));
      const discountPercent =
        dto.discountPercent ?? Number(existing.discountPercent);
      const { lineItems, subtotal, discountAmount, taxAmount, total, avgTax } =
        computeTotals(items, discountPercent);
      data.discountPercent = discountPercent;
      data.discountAmount = discountAmount;
      data.taxRate = avgTax;
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;
      if (dto.items) {
        await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
        data.items = {
          create: lineItems.map((item) => ({
            name: item.name,
            description: item.description,
            hsnSac: item.hsnSac,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            amount: item.amount,
          })),
        };
      }
    }

    return this.prisma.invoice.update({
      where: { id },
      data,
      include: { client: true, items: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.invoice.delete({ where: { id } });
    return { ok: true };
  }

  async generatePdf(id: string): Promise<Buffer> {
    const invoice = await this.findOne(id);
    const settingsRows = await this.prisma.setting.findMany();
    const settings = Object.fromEntries(
      settingsRows.map((s) => [s.key, s.value]),
    );

    return buildTaxInvoicePdf(
      {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        terms: invoice.terms,
        notes: invoice.notes,
        deliveryNote: invoice.deliveryNote,
        referenceNo: invoice.referenceNo,
        otherReferences: invoice.otherReferences,
        buyerOrderNo: invoice.buyerOrderNo,
        buyerOrderDate: invoice.buyerOrderDate,
        dispatchDocNo: invoice.dispatchDocNo,
        deliveryNoteDate: invoice.deliveryNoteDate,
        dispatchedThrough: invoice.dispatchedThrough,
        destination: invoice.destination,
        termsOfDelivery: invoice.termsOfDelivery,
        consigneeName: invoice.consigneeName,
        consigneeAddress: invoice.consigneeAddress,
        consigneeGstin: invoice.consigneeGstin,
        consigneeState: invoice.consigneeState,
        consigneeStateCode: invoice.consigneeStateCode,
        subtotal: Number(invoice.subtotal),
        discountPercent: Number(invoice.discountPercent),
        discountAmount: Number(invoice.discountAmount),
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        client: invoice.client,
        items: invoice.items.map((item) => ({
          name: item.name,
          description: item.description,
          hsnSac: item.hsnSac,
          unit: item.unit,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          amount: Number(item.amount),
        })),
      },
      settings,
    );
  }
}
