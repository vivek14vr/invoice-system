import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QuoteStatus } from '../generated/prisma/enums';
import { CreateQuotationDto, UpdateQuotationDto } from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';

@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: QuoteStatus,
  ) {
    return this.quotationsService.findAll(search, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQuotationDto) {
    return this.quotationsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.quotationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quotationsService.remove(id);
  }
}
