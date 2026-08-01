import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoiceStatus } from '../generated/prisma/enums';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoicesService.findAll(search, status);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.invoicesService.generatePdf(id);
    const invoice = await this.invoicesService.findOne(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
