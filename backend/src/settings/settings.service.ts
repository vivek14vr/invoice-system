import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
  CreatePaymentMethodDto,
  CreateTaxRateDto,
} from './dto/settings.dto';

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: 'girjasoft Invoices',
  default_language: 'english',
  currency_symbol: '₹',
  currency_code: 'INR',
  date_format: 'DD-MM-YYYY',
  default_country: 'IN',
  invoices_due_after: '30',
  quotes_expire_after: '15',
  default_invoice_terms: '',
  pdf_footer_text: 'Thank you for your business!',
  company_name: 'girjasoft pvt ltd',
  company_address: '',
  company_gstin: '',
  company_state: '',
  company_state_code: '',
  company_email: '',
  company_phone: '',
  company_pan: '',
  company_bank_name: '',
  company_bank_account: '',
  company_bank_ifsc: '',
  company_bank_branch: '',
  company_bank_holder: '',
  company_signatory: 'Authorised Signatory',
  company_logo: '',
  company_stamp: '',
  default_consignee: 'Not Applicable',
  tax_cgst_name: 'CGST',
  tax_sgst_name: 'SGST',
  tax_igst_name: 'IGST',
  tax_rate_name: 'GST',
};

const BRANDING_KEYS = new Set(['company_logo', 'company_stamp']);
const MAX_BRANDING_BYTES = 1.5 * 1024 * 1024;

function validateBrandingImage(key: string, value: string) {
  if (!BRANDING_KEYS.has(key) || value === '') return;
  const match = value.match(
    /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    throw new BadRequestException(`${key} must be a PNG or JPEG image`);
  }
  const bytes = Buffer.byteLength(match[2], 'base64');
  if (bytes > MAX_BRANDING_BYTES) {
    throw new BadRequestException(`${key} must be 1.5 MB or smaller`);
  }
  const image = Buffer.from(match[2], 'base64');
  const isPng =
    image.length >= 8 &&
    image
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg =
    image.length >= 3 &&
    image[0] === 0xff &&
    image[1] === 0xd8 &&
    image[2] === 0xff;
  if (!isPng && !isJpeg) {
    throw new BadRequestException(`${key} is not a valid PNG or JPEG image`);
  }
}

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const companies = await this.prisma.company.findMany({
      select: { id: true },
    });
    await Promise.all(
      companies.map((company) => this.ensureDefaults(company.id)),
    );
  }

  async ensureDefaults(companyId: string) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await this.prisma.setting.upsert({
        where: { companyId_key: { companyId, key } },
        create: { companyId, key, value },
        update: {},
      });
    }

    const taxCount = await this.prisma.taxRate.count({ where: { companyId } });
    if (taxCount === 0) {
      await this.prisma.taxRate.createMany({
        data: [
          { name: 'GST 5%', rate: 5, isDefault: false, companyId },
          { name: 'GST 12%', rate: 12, isDefault: false, companyId },
          { name: 'GST 18%', rate: 18, isDefault: true, companyId },
          { name: 'No Tax', rate: 0, isDefault: false, companyId },
        ],
      });
    }

    // Use upserts instead of count-then-create. Multiple pages request
    // settings at the same time during navigation, and the old pattern let
    // both requests observe zero methods before either inserted them. The
    // compound unique key makes these writes safe under that race.
    const defaultPaymentMethods = [
      { name: 'Bank Transfer', isDefault: false },
      { name: 'Cash', isDefault: true },
      { name: 'Cheque', isDefault: false },
      { name: 'Credit Card', isDefault: false },
      { name: 'UPI', isDefault: false },
    ];
    await Promise.all(
      defaultPaymentMethods.map((method) =>
        this.prisma.paymentMethod.upsert({
          where: { companyId_name: { companyId, name: method.name } },
          create: { ...method, companyId },
          update: {},
        }),
      ),
    );

    const groupCount = await this.prisma.invoiceGroup.count({
      where: { companyId },
    });
    if (groupCount === 0) {
      await this.prisma.invoiceGroup.createMany({
        data: [
          {
            name: 'Invoice Series',
            template: 'INV-{{{year}}}-{{{id}}}',
            nextId: 1,
            isDefault: true,
            companyId,
          },
          {
            name: 'Quotation Series',
            template: 'QUO-{{{year}}}-{{{id}}}',
            nextId: 1,
            isDefault: true,
            companyId,
          },
        ],
      });
    }
  }

  async getAll(companyId?: string | null) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    await this.ensureDefaults(companyId);
    const [settings, taxRates, paymentMethods, invoiceGroups] =
      await Promise.all([
        this.prisma.setting.findMany({ where: { companyId } }),
        this.prisma.taxRate.findMany({
          where: { companyId },
          orderBy: { rate: 'asc' },
        }),
        this.prisma.paymentMethod.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.invoiceGroup.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
        }),
      ]);

    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return { settings: map, taxRates, paymentMethods, invoiceGroups };
  }

  async updateSettings(
    data: Record<string, string>,
    companyId?: string | null,
  ) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
      if (typeof value !== 'string') {
        throw new BadRequestException(`${key} must be a string`);
      }
      validateBrandingImage(key, value);
    }
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { companyId_key: { companyId, key } },
          create: { companyId, key, value },
          update: { value },
        }),
      ),
    );
    return this.getAll(companyId);
  }

  createTaxRate(dto: CreateTaxRateDto, companyId?: string | null) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.taxRate.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }
      return tx.taxRate.create({ data: { ...dto, companyId } });
    });
  }

  async removeTaxRate(id: string, companyId?: string | null) {
    const row = await this.prisma.taxRate.findFirst({
      where: { id, companyId: companyId ?? undefined },
    });
    if (!row) throw new NotFoundException('Tax rate not found');
    await this.prisma.taxRate.delete({ where: { id } });
    return { ok: true };
  }

  createPaymentMethod(dto: CreatePaymentMethodDto, companyId?: string | null) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.paymentMethod.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }
      return tx.paymentMethod.create({ data: { ...dto, companyId } });
    });
  }

  async removePaymentMethod(id: string, companyId?: string | null) {
    const row = await this.prisma.paymentMethod.findFirst({
      where: { id, companyId: companyId ?? undefined },
    });
    if (!row) throw new NotFoundException('Payment method not found');
    await this.prisma.paymentMethod.delete({ where: { id } });
    return { ok: true };
  }

  createInvoiceGroup(dto: CreateInvoiceGroupDto, companyId?: string | null) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    return this.prisma.invoiceGroup.create({
      data: {
        name: dto.name,
        template: dto.template,
        nextId: dto.nextId ?? 1,
        isDefault: dto.isDefault ?? false,
        companyId,
      },
    });
  }

  async updateInvoiceGroup(
    id: string,
    dto: UpdateInvoiceGroupDto,
    companyId?: string | null,
  ) {
    const group = await this.prisma.invoiceGroup.findFirst({
      where: { id, companyId: companyId ?? undefined },
    });
    if (!group) throw new NotFoundException('Invoice group not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.invoiceGroup.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }
      return tx.invoiceGroup.update({ where: { id }, data: dto });
    });
  }

  async removeInvoiceGroup(id: string, companyId?: string | null) {
    const row = await this.prisma.invoiceGroup.findFirst({
      where: { id, companyId: companyId ?? undefined },
    });
    if (!row) throw new NotFoundException('Invoice group not found');
    await this.prisma.invoiceGroup.delete({ where: { id } });
    return { ok: true };
  }
}
