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
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';
type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(search, request.user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.findOne(id, request.user.companyId);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(dto, request.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.update(id, dto, request.user.companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.remove(id, request.user.companyId);
  }
}
