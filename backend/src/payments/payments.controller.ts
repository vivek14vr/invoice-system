import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
