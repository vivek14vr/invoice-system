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
import { InvoiceStatus } from '../../generated/prisma/enums';

export class InvoiceItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hsnSac?: string;

  @IsOptional()
  @IsString()
  unit?: string;

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

export class CreateInvoiceDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  invoiceGroupId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  deliveryNote?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  otherReferences?: string;

  @IsOptional()
  @IsString()
  buyerOrderNo?: string;

  @IsOptional()
  @IsDateString()
  buyerOrderDate?: string;

  @IsOptional()
  @IsString()
  dispatchDocNo?: string;

  @IsOptional()
  @IsDateString()
  deliveryNoteDate?: string;

  @IsOptional()
  @IsString()
  dispatchedThrough?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  termsOfDelivery?: string;

  @IsOptional()
  @IsString()
  consigneeName?: string;

  @IsOptional()
  @IsString()
  consigneeAddress?: string;

  @IsOptional()
  @IsString()
  consigneeGstin?: string;

  @IsOptional()
  @IsString()
  consigneeState?: string;

  @IsOptional()
  @IsString()
  consigneeStateCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  deliveryNote?: string;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  otherReferences?: string;

  @IsOptional()
  @IsString()
  buyerOrderNo?: string;

  @IsOptional()
  @IsDateString()
  buyerOrderDate?: string;

  @IsOptional()
  @IsString()
  dispatchDocNo?: string;

  @IsOptional()
  @IsDateString()
  deliveryNoteDate?: string;

  @IsOptional()
  @IsString()
  dispatchedThrough?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  termsOfDelivery?: string;

  @IsOptional()
  @IsString()
  consigneeName?: string;

  @IsOptional()
  @IsString()
  consigneeAddress?: string;

  @IsOptional()
  @IsString()
  consigneeGstin?: string;

  @IsOptional()
  @IsString()
  consigneeState?: string;

  @IsOptional()
  @IsString()
  consigneeStateCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}
