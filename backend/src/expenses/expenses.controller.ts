import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpensesService } from './expenses.service';

type AuthenticatedRequest = Request & {
  user: { companyId?: string | null };
};

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.expensesService.findAll(request.user.companyId);
  }

  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() request: AuthenticatedRequest) {
    return this.expensesService.create(dto, request.user.companyId);
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
