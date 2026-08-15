import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

function buildDisplayName(parts: {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
}) {
  const person = [parts.firstName, parts.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (parts.company?.trim()) {
    return person
      ? `${person} (${parts.company.trim()})`
      : parts.company.trim();
  }
  return person || 'Unnamed Client';
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    search?: string,
    companyId?: string | null,
    page = 1,
    pageSize = 10,
    sortBy: 'name' | 'createdAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const where = {
      ...(companyId ? { companyId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { company: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { mobile: { contains: search } },
              { city: { contains: search } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { invoices: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);
    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string, companyId?: string | null) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
        quotes: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!client || (companyId && client.companyId !== companyId))
      throw new NotFoundException('Client not found');
    return client;
  }

  create(dto: CreateClientDto, companyId?: string | null) {
    const name = buildDisplayName(dto);
    return this.prisma.client.create({
      data: {
        ...dto,
        name,
        country: dto.country ?? 'IN',
        companyId: companyId ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateClientDto, companyId?: string | null) {
    const existing = await this.findOne(id, companyId);
    const name = buildDisplayName({
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      company: dto.company ?? existing.company,
    });
    return this.prisma.client.update({
      where: { id },
      data: { ...dto, name },
    });
  }

  async remove(id: string, companyId?: string | null) {
    await this.findOne(id, companyId);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
