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
} from '@nestjs/common';
import type { Request } from 'express';
import { QuoteStatus } from '../generated/prisma/enums';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';
type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: QuoteStatus,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.quotationsService.findAll(
      search,
      status,
      request?.user.companyId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.quotationsService.findOne(id, request.user.companyId);
  }

  @Post()
  create(
    @Body() dto: CreateQuotationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotationsService.create(dto, request.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotationsService.update(id, dto, request.user.companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.quotationsService.remove(id, request.user.companyId);
  }
}
