import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string, companyId?: string | null) {
    return this.prisma.product.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId?: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || (companyId && product.companyId !== companyId))
      throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto, companyId?: string | null) {
    const sku = dto.sku?.trim() || null;
    await this.assertSkuAvailable(sku, undefined, companyId);
    return this.prisma.product.create({
      data: { ...dto, sku, companyId: companyId ?? undefined },
    });
  }

  async update(id: string, dto: UpdateProductDto, companyId?: string | null) {
    await this.findOne(id, companyId);
    const sku = dto.sku === undefined ? undefined : dto.sku?.trim() || null;
    await this.assertSkuAvailable(sku, id, companyId);
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, sku },
    });
  }

  private async assertSkuAvailable(
    sku?: string | null,
    excludeId?: string,
    companyId?: string | null,
  ) {
    if (!sku) return;
    const duplicate = await this.prisma.product.findFirst({
      where: {
        sku,
        companyId: companyId ?? undefined,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('SKU already exists');
  }

  async remove(id: string, companyId?: string | null) {
    await this.findOne(id, companyId);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
