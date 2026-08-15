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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy')
    sortBy?: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Req() request?: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.findAll(
      search,
      status,
      request?.user.companyId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 10)),
      ['invoiceNumber', 'issueDate', 'dueDate', 'createdAt'].includes(
        sortBy ?? '',
      )
        ? sortBy
        : 'createdAt',
      sortOrder === 'asc' ? 'asc' : 'desc',
      dateFrom,
      dateTo,
    );
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    const buffer = await this.invoicesService.generatePdf(
      id,
      request.user.companyId,
    );
    const invoice = await this.invoicesService.findOne(
      id,
      request.user.companyId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.findOne(id, request.user.companyId);
  }

  @Post()
  create(
    @Body() dto: CreateInvoiceDto,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.create(dto, request.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.update(id, dto, request.user.companyId);
  }

  @Post(':id/credit-note')
  creditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.createCreditNote(
      id,
      dto.reason,
      request.user.companyId,
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.invoicesService.remove(id, request.user.companyId);
  }
}
