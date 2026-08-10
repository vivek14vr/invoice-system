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
import {
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
  CreatePaymentMethodDto,
  CreateTaxRateDto,
  UpdateSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll(@Req() request: AuthenticatedRequest) {
    return this.settingsService.getAll(request.user.companyId);
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.settingsService.updateSettings(
      dto.settings,
      request.user.companyId,
    );
  }

  @Post('tax-rates')
  createTaxRate(
    @Body() dto: CreateTaxRateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.createTaxRate(dto, request.user.companyId);
  }

  @Delete('tax-rates/:id')
  removeTaxRate(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.settingsService.removeTaxRate(id, request.user.companyId);
  }

  @Post('payment-methods')
  createPaymentMethod(
    @Body() dto: CreatePaymentMethodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.createPaymentMethod(
      dto,
      request.user.companyId,
    );
  }

  @Delete('payment-methods/:id')
  removePaymentMethod(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.removePaymentMethod(id, request.user.companyId);
  }

  @Post('invoice-groups')
  createInvoiceGroup(
    @Body() dto: CreateInvoiceGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.createInvoiceGroup(dto, request.user.companyId);
  }

  @Patch('invoice-groups/:id')
  updateInvoiceGroup(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.updateInvoiceGroup(
      id,
      dto,
      request.user.companyId,
    );
  }

  @Delete('invoice-groups/:id')
  removeInvoiceGroup(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settingsService.removeInvoiceGroup(id, request.user.companyId);
  }
}
