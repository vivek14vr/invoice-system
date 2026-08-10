import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

function money(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string | null) {
    return this.prisma.expense.findMany({
      where: companyId ? { companyId } : {},
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private values(dto: CreateExpenseDto | UpdateExpenseDto) {
    const amount = money(dto.amount);
    const gstRate = money(dto.gstRate ?? 0);
    const gstAmount = money((amount * gstRate) / 100);
    return {
      invoiceNumber: dto.invoiceNumber.trim(),
      category: dto.category.trim(),
      paymentMode: dto.paymentMode.trim(),
      expenseDate: new Date(dto.expenseDate),
      itemDetails: dto.itemDetails.trim(),
      amount,
      gstRate,
      gstAmount,
      total: money(amount + gstAmount),
      notes: dto.notes?.trim() || null,
    };
  }

  create(dto: CreateExpenseDto, companyId?: string | null) {
    return this.prisma.expense.create({
      data: { ...this.values(dto), companyId: companyId ?? undefined },
    });
  }

  async update(id: string, dto: UpdateExpenseDto, companyId?: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || (companyId && expense.companyId !== companyId)) {
      throw new NotFoundException('Expense not found');
    }
    return this.prisma.expense.update({
      where: { id },
      data: this.values(dto),
    });
  }

  async remove(id: string, companyId?: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || (companyId && expense.companyId !== companyId)) {
      throw new NotFoundException('Expense not found');
    }
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }
}
