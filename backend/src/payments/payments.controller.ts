import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
  findAll(@Req() request: AuthenticatedRequest) {
    return this.paymentsService.findAll(request.user.companyId);
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
