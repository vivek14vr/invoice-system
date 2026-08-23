import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';
type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('method') method?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: 'paidAt' | 'amount' | 'method',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.paymentsService.findAll(
      request.user.companyId,
      search,
      method,
      dateFrom,
      dateTo,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 10)),
      ['paidAt', 'amount', 'method'].includes(sortBy ?? '') ? sortBy : 'paidAt',
      sortOrder === 'asc' ? 'asc' : 'desc',
    );
  }

  @Post()
  create(@Body() dto: CreatePaymentDto, @Req() request: AuthenticatedRequest) {
    return this.paymentsService.create(dto, request.user.companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.paymentsService.remove(id, request.user.companyId);
  }
}
