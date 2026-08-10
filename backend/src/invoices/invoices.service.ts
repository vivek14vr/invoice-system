import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  const idToken = '{{{id}}}';
  const idTokenPosition = template.indexOf(idToken);
  const literalBeforeNumber =
    idTokenPosition >= 0 ? template.slice(0, idTokenPosition) : '';
  // A run of zeroes directly before the number is an explicit number format
  // (for example, `000{{{id}}}` becomes `0001`). Legacy templates without
  // those zeroes retain the standard four-digit sequence.
  const hasExplicitLeadingZeroes = /0+$/.test(literalBeforeNumber);
  const sequence = hasExplicitLeadingZeroes
    ? String(id)
    : String(id).padStart(4, '0');

  return template
    .replace(/\{\{\{year\}\}\}/g, String(year))
    .replace(/\{\{\{id\}\}\}/g, sequence);
}

function stateCode(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return '';
  const codes: Record<string, string> = {
    up: '09',
    'uttar pradesh': '09',
  };
  return codes[normalized] ?? normalized;
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

  private gstTaxLines(client: { vatGstNumber?: string | null }) {
    const gstStateCode = client.vatGstNumber?.trim().slice(0, 2);
    return gstStateCode === '09'
      ? [
          { name: 'CGST', rate: 9 },
          { name: 'SGST', rate: 9 },
        ]
      : [{ name: 'IGST', rate: 18 }];
  }

  private validateLineItemAmounts(
    items: InvoiceItemDto[],
    status: InvoiceStatus,
  ) {
    const hasNegativePrice = items.some((item) => item.unitPrice < 0);
    if (hasNegativePrice && status !== InvoiceStatus.CREDIT_NOTE) {
      throw new BadRequestException(
        'Negative line prices are allowed only for credit notes',
      );
    }
  }

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

  private async taxContext(client: {
    state?: string | null;
    stateCode?: string | null;
  }) {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: ['company_state', 'company_state_code'] } },
    });
    const settings = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    );
    const sellerCode =
      stateCode(settings.company_state_code) ||
      stateCode(settings.company_state) ||
      '09';
    const buyerCode =
      stateCode(client.stateCode) || stateCode(client.state) || sellerCode;
    return {
      taxType:
        buyerCode === sellerCode
          ? ('INTRA_STATE' as const)
          : ('INTER_STATE' as const),
    };
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

  async create(dto: CreateInvoiceDto, companyId?: string | null) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const status = dto.status ?? InvoiceStatus.DRAFT;
    this.validateLineItemAmounts(dto.items, status);
    const taxLines = this.gstTaxLines(client);
    const taxRate = taxLines.reduce((sum, tax) => sum + tax.rate, 0);
    const items = dto.items.map((item) => ({ ...item, taxRate }));
    const discountPercent = dto.discountPercent ?? 0;
    const { lineItems, subtotal, discountAmount, taxAmount, total, avgTax } =
      computeTotals(items, discountPercent);
    const { invoiceNumber, invoiceGroupId } = await this.nextInvoiceNumber(
      dto.invoiceGroupId,
    );
    const finalInvoiceNumber = `${dto.invoiceNumberPrefix ?? ''}${invoiceNumber}${dto.invoiceNumberSuffix ?? ''}`;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber: finalInvoiceNumber,
        invoiceNumberPrefix: dto.invoiceNumberPrefix,
        invoiceNumberSuffix: dto.invoiceNumberSuffix,
        clientId: dto.clientId,
        companyId: companyId ?? undefined,
        invoiceGroupId,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate: new Date(dto.dueDate),
        status,
        taxRate: avgTax,
        discountPercent,
        discountAmount,
        subtotal,
        taxAmount,
        taxLines: taxLines,
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

    const client = dto.clientId
      ? await this.prisma.client.findUnique({ where: { id: dto.clientId } })
      : existing.client;
    if (!client) throw new NotFoundException('Client not found');
    const data: Record<string, unknown> = {};
    if (dto.clientId) data.clientId = dto.clientId;
    if (dto.invoiceNumber !== undefined) {
      const invoiceNumber = dto.invoiceNumber.trim();
      if (!invoiceNumber) {
        throw new BadRequestException('Invoice number is required');
      }
      const duplicate = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('Invoice number already exists');
      }
      data.invoiceNumber = invoiceNumber;
      data.invoiceNumberPrefix = null;
      data.invoiceNumberSuffix = null;
      if ((dto.status ?? existing.status) === InvoiceStatus.CREDIT_NOTE) {
        data.creditNoteNumber = invoiceNumber;
      }
    } else if (
      dto.invoiceNumberPrefix !== undefined ||
      dto.invoiceNumberSuffix !== undefined
    ) {
      const prefix =
        dto.invoiceNumberPrefix ?? existing.invoiceNumberPrefix ?? '';
      const suffix =
        dto.invoiceNumberSuffix ?? existing.invoiceNumberSuffix ?? '';
      const baseNumber = existing.invoiceNumber.slice(
        (existing.invoiceNumberPrefix ?? '').length,
        existing.invoiceNumberSuffix
          ? -existing.invoiceNumberSuffix.length
          : undefined,
      );
      data.invoiceNumberPrefix = prefix;
      data.invoiceNumberSuffix = suffix;
      data.invoiceNumber = `${prefix}${baseNumber}${suffix}`;
    }
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

    if (dto.items || dto.discountPercent !== undefined || dto.clientId) {
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
      const taxLines = this.gstTaxLines(client);
      const taxRate = taxLines.reduce((sum, tax) => sum + tax.rate, 0);
      const normalizedItems = items.map((item) => ({ ...item, taxRate }));
      const discountPercent =
        dto.discountPercent ?? Number(existing.discountPercent);
      this.validateLineItemAmounts(items, dto.status ?? existing.status);
      const { lineItems, subtotal, discountAmount, taxAmount, total, avgTax } =
        computeTotals(normalizedItems, discountPercent);
      data.discountPercent = discountPercent;
      data.discountAmount = discountAmount;
      data.taxRate = avgTax;
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;
      data.taxLines = taxLines;
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

  async createCreditNote(id: string, reason?: string) {
    const original = await this.findOne(id);
    if (original.status === InvoiceStatus.CREDIT_NOTE) {
      throw new NotFoundException(
        'A credit note cannot be created from another credit note',
      );
    }
    const { invoiceNumber: sequenceNumber, invoiceGroupId } =
      await this.nextInvoiceNumber(original.invoiceGroupId ?? undefined);
    const creditNoteNumber = `CN-${sequenceNumber}`;
    const subtotal = money(-Number(original.subtotal));
    const taxAmount = money(-Number(original.taxAmount));
    const total = money(-Number(original.total));
    const note = await this.prisma.invoice.create({
      data: {
        invoiceNumber: creditNoteNumber,
        creditNoteNumber,
        creditNoteForId: original.id,
        creditNoteReason: reason,
        companyId: original.companyId,
        clientId: original.clientId,
        invoiceGroupId,
        issueDate: new Date(),
        dueDate: new Date(),
        status: InvoiceStatus.CREDIT_NOTE,
        taxRate: Number(original.taxRate),
        subtotal,
        taxAmount,
        total,
        taxLines: original.taxLines ?? undefined,
        items: {
          create: original.items.map((item) => ({
            name: item.name,
            description: item.description,
            hsnSac: item.hsnSac,
            unit: item.unit,
            quantity: Number(item.quantity),
            unitPrice: -Number(item.unitPrice),
            taxRate: Number(item.taxRate),
            amount: -Number(item.amount),
          })),
        },
      },
      include: { client: true, items: true },
    });
    return note;
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
        isCreditNote: invoice.status === InvoiceStatus.CREDIT_NOTE,
        taxType: (await this.taxContext(invoice.client)).taxType,
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
        taxLines: Array.isArray(invoice.taxLines)
          ? (invoice.taxLines as { name: string; rate: number }[])
          : undefined,
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
