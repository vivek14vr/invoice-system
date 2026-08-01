import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateInvoiceGroupDto,
  CreatePaymentMethodDto,
  CreateTaxRateDto,
  UpdateSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto.settings);
  }

  @Post('tax-rates')
  createTaxRate(@Body() dto: CreateTaxRateDto) {
    return this.settingsService.createTaxRate(dto);
  }

  @Delete('tax-rates/:id')
  removeTaxRate(@Param('id') id: string) {
    return this.settingsService.removeTaxRate(id);
  }

  @Post('payment-methods')
  createPaymentMethod(@Body() dto: CreatePaymentMethodDto) {
    return this.settingsService.createPaymentMethod(dto);
  }

  @Delete('payment-methods/:id')
  removePaymentMethod(@Param('id') id: string) {
    return this.settingsService.removePaymentMethod(id);
  }

  @Post('invoice-groups')
  createInvoiceGroup(@Body() dto: CreateInvoiceGroupDto) {
    return this.settingsService.createInvoiceGroup(dto);
  }

  @Delete('invoice-groups/:id')
  removeInvoiceGroup(@Param('id') id: string) {
    return this.settingsService.removeInvoiceGroup(id);
  }
}
