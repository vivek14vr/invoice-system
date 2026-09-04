import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { GridFsService } from '../files/gridfs.service';
import { buildSearchKey, compactSearch, escapeSearchRegex } from '../common/search';

function money(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class ExpensesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: GridFsService,
  ) {}

  onModuleInit() {
    void this.backfillSearchKeys();
  }

  private async backfillSearchKeys() {
    try {
      const expenses = await this.prisma.expense.findMany({
        where: { searchKey: null },
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          vatGstNumber: true,
          category: true,
          paymentMode: true,
          itemDetails: true,
          notes: true,
        },
      });
      for (let index = 0; index < expenses.length; index += 25) {
        await Promise.all(
          expenses.slice(index, index + 25).map((expense) =>
            this.prisma.expense.update({
              where: { id: expense.id },
              data: {
                searchKey: buildSearchKey(
                  expense.invoiceNumber,
                  expense.vendorName,
                  expense.vatGstNumber,
                  expense.category,
                  expense.paymentMode,
                  expense.itemDetails,
                  expense.notes,
                ),
              },
            }),
          ),
        );
      }
    } catch (error) {
      console.error('Expense search-key backfill failed:', error);
    }
  }

  async findAll(
    companyId?: string | null,
    search?: string,
    category?: string,
    paymentMode?: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    pageSize = 10,
    sortBy:
      | 'expenseDate'
      | 'amount'
      | 'total'
      | 'balanceDue'
      | 'vendorName' = 'expenseDate',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const normalizedSearch = search?.trim();
    const normalizedCategory = category?.trim();
    const normalizedPaymentMode = paymentMode?.trim();
    const escapedSearch = normalizedSearch ? escapeSearchRegex(normalizedSearch) : '';
    const escapedCategory = normalizedCategory ? escapeSearchRegex(normalizedCategory) : '';
    const escapedPaymentMode = normalizedPaymentMode ? escapeSearchRegex(normalizedPaymentMode) : '';
    const escapedCompactSearch = normalizedSearch
      ? escapeSearchRegex(compactSearch(normalizedSearch))
      : '';
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
    const where = {
      AND: [
        companyId ? { companyId } : {},
        normalizedCategory ? { category: { contains: escapedCategory, mode: 'insensitive' as const } } : {},
        normalizedPaymentMode ? { paymentMode: { contains: escapedPaymentMode, mode: 'insensitive' as const } } : {},
        from || to
          ? {
              expenseDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {},
        normalizedSearch
          ? {
              OR: [
                { searchKey: { contains: escapedCompactSearch, mode: 'insensitive' as const } },
                { invoiceNumber: { contains: escapedSearch, mode: 'insensitive' as const } },
                { vendorName: { contains: escapedSearch, mode: 'insensitive' as const } },
                { vatGstNumber: { contains: escapedSearch, mode: 'insensitive' as const } },
                { itemDetails: { contains: escapedSearch, mode: 'insensitive' as const } },
              ],
            }
          : {},
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          vatGstNumber: true,
          category: true,
          paymentMode: true,
          expenseDate: true,
          itemDetails: true,
          quantity: true,
          amount: true,
          gstRate: true,
          gstAmount: true,
          total: true,
          balanceDue: true,
          notes: true,
          attachmentName: true,
          attachmentMimeType: true,
          attachmentSize: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expense.count({ where }),
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

  private values(dto: CreateExpenseDto | UpdateExpenseDto) {
    const amount = money(dto.amount);
    const gstRate = money(dto.gstRate ?? 0);
    const gstAmount = money((amount * gstRate) / 100);
    return {
      invoiceNumber: dto.invoiceNumber.trim(),
      vendorName: dto.vendorName?.trim() || null,
      vatGstNumber: dto.vatGstNumber?.trim() || null,
      category: dto.category.trim(),
      paymentMode: dto.paymentMode.trim(),
      expenseDate: new Date(dto.expenseDate),
      itemDetails: dto.itemDetails.trim(),
      quantity: money(dto.quantity ?? 1),
      amount,
      gstRate,
      gstAmount,
      total: money(amount + gstAmount),
      balanceDue: money(dto.balanceDue ?? 0),
      notes: dto.notes?.trim() || null,
    };
  }

  create(dto: CreateExpenseDto, companyId?: string | null) {
    if (!dto.attachmentData || !dto.attachmentName) {
      throw new BadRequestException('Expense PDF upload is required');
    }
    return this.saveWithAttachment(dto, companyId);
  }

  async update(id: string, dto: UpdateExpenseDto, companyId?: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || (companyId && expense.companyId !== companyId)) {
      throw new NotFoundException('Expense not found');
    }
    return this.saveWithAttachment(dto, companyId, id, expense.attachmentId);
  }

  async attachment(id: string, companyId?: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (
      !expense ||
      (companyId && expense.companyId !== companyId) ||
      !expense.attachmentId
    ) {
      throw new NotFoundException('Expense PDF not found');
    }
    return { expense, stream: this.files.openDownload(expense.attachmentId) };
  }

  private async saveWithAttachment(
    dto: CreateExpenseDto | UpdateExpenseDto,
    companyId?: string | null,
    id?: string,
    previousAttachmentId?: string | null,
  ) {
    const data = this.values(dto);
    const searchKey = buildSearchKey(
      data.invoiceNumber,
      data.vendorName,
      data.vatGstNumber,
      data.category,
      data.paymentMode,
      data.itemDetails,
      data.notes,
    );
    const hasNewAttachment = Boolean(dto.attachmentData && dto.attachmentName);
    const uploaded = hasNewAttachment
      ? await this.files.uploadPdf(dto.attachmentData!, dto.attachmentName!)
      : undefined;
    const attachmentFields = uploaded
      ? {
          attachmentId: uploaded.id,
          attachmentName: dto.attachmentName,
          attachmentMimeType: 'application/pdf',
          attachmentSize: uploaded.size,
        }
      : {};
    const expense = id
      ? await this.prisma.expense.update({
          where: { id },
          data: { ...data, searchKey, ...attachmentFields },
        })
      : await this.prisma.expense.create({
          data: {
            ...data,
            searchKey,
            ...attachmentFields,
            companyId: companyId ?? undefined,
          },
        });
    if (
      uploaded &&
      previousAttachmentId &&
      previousAttachmentId !== uploaded.id
    )
      await this.files.delete(previousAttachmentId);
    return expense;
  }

  async remove(id: string, companyId?: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || (companyId && expense.companyId !== companyId)) {
      throw new NotFoundException('Expense not found');
    }
    await this.prisma.expense.delete({ where: { id } });
    await this.files.delete(expense.attachmentId);
    return { ok: true };
  }
}
