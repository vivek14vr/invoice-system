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
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { InvoiceStatus } from '../generated/prisma/enums';
import {
  CreateCreditNoteDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
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
  create(
    @Body() dto: CreateInvoiceDto,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.create(dto, request.user.companyId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Post(':id/credit-note')
  creditNote(@Param('id') id: string, @Body() dto: CreateCreditNoteDto) {
    return this.invoicesService.createCreditNote(id, dto.reason);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
