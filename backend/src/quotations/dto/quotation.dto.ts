import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteStatus } from '../../generated/prisma/enums';

export class QuoteItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate!: number;
}

export class CreateQuotationDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  invoiceGroupId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}

export class UpdateQuotationDto {
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
