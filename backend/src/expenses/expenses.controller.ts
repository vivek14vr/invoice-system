import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

type AuthenticatedRequest = Request & {
  user: { companyId?: string | null };
};

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy')
    sortBy?: 'expenseDate' | 'amount' | 'total' | 'balanceDue' | 'vendorName',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.expensesService.findAll(
      request.user.companyId,
      search,
      category,
      paymentMode,
      dateFrom,
      dateTo,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 10)),
      ['expenseDate', 'amount', 'total', 'balanceDue', 'vendorName'].includes(
        sortBy ?? '',
      )
        ? sortBy
        : 'expenseDate',
      sortOrder === 'asc' ? 'asc' : 'desc',
    );
  }

  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() request: AuthenticatedRequest) {
    return this.expensesService.create(dto, request.user.companyId);
  }

  @Get(':id/attachment')
  async attachment(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const result = await this.expensesService.attachment(
      id,
      request.user.companyId,
    );
    response.set({
      'Content-Type': result.expense.attachmentMimeType || 'application/pdf',
      'Content-Disposition': `inline; filename="${result.expense.attachmentName || 'expense.pdf'}"`,
    });
    result.stream.on('error', () => response.status(404).end());
    result.stream.pipe(response);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.expensesService.update(id, dto, request.user.companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.expensesService.remove(id, request.user.companyId);
  }
}
