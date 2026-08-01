import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  invoiceId!: string;

  @IsString()
  @MinLength(1)
  method!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
