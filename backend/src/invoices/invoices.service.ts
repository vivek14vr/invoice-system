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
    andhra: '37',
    'andhra pradesh': '37',
    arunachal: '12',
    'arunachal pradesh': '12',
    assam: '18',
    bihar: '10',
    chhattisgarh: '22',
    goa: '30',
    gujarat: '24',
    haryana: '06',
    'himachal pradesh': '02',
    jharkhand: '20',
    karnataka: '29',
    kerala: '32',
    'madhya pradesh': '23',
    maharashtra: '27',
    manipur: '14',
    meghalaya: '17',
    mizoram: '15',
    nagaland: '13',
    odisha: '21',
    orissa: '21',
    punjab: '03',
    rajasthan: '08',
    sikkim: '11',
    'tamil nadu': '33',
    telangana: '36',
    tripura: '16',
    uttarakhand: '05',
    'west bengal': '19',
    delhi: '07',
    'jammu and kashmir': '01',
    ladakh: '38',
    puducherry: '34',
    chandigarh: '04',
    'dadra and nagar haveli and daman and diu': '26',
    lakshadweep: '31',
    'andaman and nicobar islands': '35',
    up: '09',
    'uttar pradesh': '09',
    ap: '37',
    mp: '23',
    mh: '27',
    rj: '08',
    tn: '33',
    tg: '36',
    wb: '19',
    dl: '07',
    uk: '05',
    br: '10',
    gj: '24',
    ka: '29',
    kl: '32',
    pb: '03',
    hr: '06',
    cg: '22',
    jh: '20',
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

  private async gstTaxLines(
    client: {
      vatGstNumber?: string | null;
      state?: string | null;
      stateCode?: string | null;
    },
    companyId?: string | null,
  ) {
    const settingsRows = await this.prisma.setting.findMany({
      where: {
        companyId: companyId ?? undefined,
        key: {
          in: [
            'tax_cgst_name',
            'tax_sgst_name',
            'tax_igst_name',
            'company_state',
            'company_state_code',
          ],
        },
      },
    });
    const names = Object.fromEntries(
      settingsRows.map((setting) => [setting.key, setting.value]),
    );
    const sellerCode =
      stateCode(names.company_state_code) ||
      stateCode(names.company_state) ||
      '09';
    // State fields are authoritative. GSTIN is only a fallback for legacy
    // clients that do not have state information saved. Missing state means
    // same-state by default, as required for a new client/invoice.
    const gstStateCode = client.vatGstNumber?.trim().slice(0, 2);
    const buyerCode =
      stateCode(client.stateCode) ||
      stateCode(client.state) ||
      (/^\d{2}$/.test(gstStateCode ?? '') ? gstStateCode : '') ||
      sellerCode;
    return buyerCode === sellerCode
      ? [
          { name: names.tax_cgst_name?.trim() || 'CGST', rate: 9 },
          { name: names.tax_sgst_name?.trim() || 'SGST', rate: 9 },
        ]
      : [{ name: names.tax_igst_name?.trim() || 'IGST', rate: 18 }];
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

  private async nextInvoiceNumber(
    invoiceGroupId?: string,
    companyId?: string | null,
  ) {
    const year = new Date().getFullYear();
    const group = invoiceGroupId
      ? await this.prisma.invoiceGroup.findFirst({
          where: { id: invoiceGroupId, companyId: companyId ?? undefined },
        })
      : await this.prisma.invoiceGroup.findFirst({
          where: { name: 'Invoice Series', companyId: companyId ?? undefined },
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

  private async taxContext(
    client: {
      state?: string | null;
      stateCode?: string | null;
      vatGstNumber?: string | null;
    },
    companyId?: string | null,
  ) {
    const rows = await this.prisma.setting.findMany({
      where: {
        companyId: companyId ?? undefined,
        key: { in: ['company_state', 'company_state_code'] },
      },
    });
    const settings = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    );
    const sellerCode =
      stateCode(settings.company_state_code) ||
      stateCode(settings.company_state) ||
      '09';
    const gstStateCode = client.vatGstNumber?.trim().slice(0, 2);
    const buyerCode =
      stateCode(client.stateCode) ||
      stateCode(client.state) ||
      (/^\d{2}$/.test(gstStateCode ?? '') ? gstStateCode : '') ||
      sellerCode;
    return {
      taxType:
        buyerCode === sellerCode
          ? ('INTRA_STATE' as const)
          : ('INTER_STATE' as const),
    };
  }

  async findAll(
    search?: string,
    status?: InvoiceStatus,
    companyId?: string | null,
    page = 1,
    pageSize = 10,
    sortBy:
      'invoiceNumber' | 'issueDate' | 'dueDate' | 'createdAt' = 'createdAt',
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
                { invoiceNumber: { contains: search } },
                { client: { name: { contains: search } } },
              ],
            }
          : {},
      ],
    };
    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          client: true,
          items: true,
          payments: { select: { amount: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const data = invoices.map((invoice) => {
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true, payments: true },
    });
    if (!invoice || (companyId && invoice.companyId !== companyId))
      throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(dto: CreateInvoiceDto, companyId?: string | null) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId, companyId: companyId ?? undefined },
    });
    if (!client) throw new NotFoundException('Client not found');

    const status = dto.status ?? InvoiceStatus.DRAFT;
    this.validateLineItemAmounts(dto.items, status);
    const taxLines = await this.gstTaxLines(client, companyId);
    const taxRate = taxLines.reduce((sum, tax) => sum + tax.rate, 0);
    const items = dto.items.map((item) => ({ ...item, taxRate }));
    const discountPercent = dto.discountPercent ?? 0;
    const { lineItems, subtotal, discountAmount, taxAmount, total, avgTax } =
      computeTotals(items, discountPercent);
    const { invoiceNumber, invoiceGroupId } = await this.nextInvoiceNumber(
      dto.invoiceGroupId,
      companyId,
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

  async update(id: string, dto: UpdateInvoiceDto, companyId?: string | null) {
    const existing = await this.findOne(id, companyId);

    const client = dto.clientId
      ? await this.prisma.client.findFirst({
          where: { id: dto.clientId, companyId: companyId ?? undefined },
        })
      : existing.client;
    if (!client) throw new NotFoundException('Client not found');
    const data: Record<string, unknown> = {};
    if (dto.clientId) data.clientId = dto.clientId;
    if (dto.invoiceNumber !== undefined) {
      const invoiceNumber = dto.invoiceNumber.trim();
      if (!invoiceNumber) {
        throw new BadRequestException('Invoice number is required');
      }
      const duplicate = await this.prisma.invoice.findFirst({
        where: { invoiceNumber, companyId: companyId ?? undefined },
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
      const taxLines = await this.gstTaxLines(client, companyId);
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

  async createCreditNote(
    id: string,
    reason?: string,
    companyId?: string | null,
  ) {
    const original = await this.findOne(id, companyId);
    if (original.status === InvoiceStatus.CREDIT_NOTE) {
      throw new NotFoundException(
        'A credit note cannot be created from another credit note',
      );
    }
    const { invoiceNumber: sequenceNumber, invoiceGroupId } =
      await this.nextInvoiceNumber(
        original.invoiceGroupId ?? undefined,
        companyId,
      );
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

  async remove(id: string, companyId?: string | null) {
    await this.findOne(id, companyId);
    await this.prisma.invoice.delete({ where: { id } });
    return { ok: true };
  }

  async generatePdf(id: string, companyId?: string | null): Promise<Buffer> {
    const invoice = await this.findOne(id, companyId);
    const settingsRows = await this.prisma.setting.findMany({
      where: { companyId: invoice.companyId ?? undefined },
    });
    const settings = Object.fromEntries(
      settingsRows.map((s) => [s.key, s.value]),
    );

    return buildTaxInvoicePdf(
      {
        invoiceNumber: invoice.invoiceNumber,
        isCreditNote: invoice.status === InvoiceStatus.CREDIT_NOTE,
        taxType: (await this.taxContext(invoice.client, invoice.companyId))
          .taxType,
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
