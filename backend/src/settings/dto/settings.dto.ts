import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsObject()
  settings!: Record<string, string>;
}

export class CreateTaxRateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreatePaymentMethodDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateInvoiceGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\{\{\{id\}\}\}/, {
    message: 'template must contain {{{id}}}',
  })
  template!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nextId?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInvoiceGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\{\{\{id\}\}\}/, {
    message: 'template must contain {{{id}}}',
  })
  template?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nextId?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
