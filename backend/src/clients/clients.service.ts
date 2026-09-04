import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { escapeSearchRegex } from '../common/search';

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

function buildSearchKey(parts: Record<string, unknown>) {
  return Object.values(parts)
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();
}

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.backfillSearchKeys();
  }

  private async backfillSearchKeys() {
    try {
      const clients = await this.prisma.client.findMany({
        where: { searchKey: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          name: true,
          email: true,
          phone: true,
          mobile: true,
          city: true,
        },
      });

      for (let index = 0; index < clients.length; index += 25) {
        await Promise.all(
          clients.slice(index, index + 25).map((client) =>
            this.prisma.client.update({
              where: { id: client.id },
              data: { searchKey: buildSearchKey(client) },
            }),
          ),
        );
      }
    } catch (error) {
      console.error('Client search-key backfill failed:', error);
    }
  }

  async findAll(
    search?: string,
    companyId?: string | null,
    page = 1,
    pageSize = 10,
    sortBy: 'name' | 'createdAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const normalizedSearch = search?.trim();
    const compactSearch = normalizedSearch?.replace(/\s+/g, '');
    const escapedSearch = normalizedSearch ? escapeSearchRegex(normalizedSearch) : '';
    const escapedCompactSearch = compactSearch ? escapeSearchRegex(compactSearch) : '';
    const where = {
      ...(companyId ? { companyId } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              ...(compactSearch
                ? [{ searchKey: { contains: escapedCompactSearch, mode: 'insensitive' as const } }]
                : []),
              { name: { contains: escapedSearch, mode: 'insensitive' as const } },
              { firstName: { contains: escapedSearch, mode: 'insensitive' as const } },
              { lastName: { contains: escapedSearch, mode: 'insensitive' as const } },
              { company: { contains: escapedSearch, mode: 'insensitive' as const } },
              { email: { contains: escapedSearch, mode: 'insensitive' as const } },
              { phone: { contains: escapedSearch, mode: 'insensitive' as const } },
              { mobile: { contains: escapedSearch, mode: 'insensitive' as const } },
              { city: { contains: escapedSearch, mode: 'insensitive' as const } },
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
    const firstName = dto.firstName?.trim();
    const company = dto.company?.trim();
    if (!firstName && !company) {
      throw new BadRequestException('First name or company is required');
    }
    // Prisma keeps firstName non-null for existing data. For company-only
    // clients, use the company as the stored first name and keep the display
    // name as the company name.
    const name = buildDisplayName({
      firstName,
      lastName: dto.lastName,
      company: firstName ? company : undefined,
    });
    return this.prisma.client.create({
      data: {
        ...dto,
        firstName: firstName || company!,
        company,
        name,
        searchKey: buildSearchKey({
          firstName: firstName || company!,
          lastName: dto.lastName,
          company,
          name,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          city: dto.city,
        }),
        country: dto.country ?? 'IN',
        companyId: companyId ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateClientDto, companyId?: string | null) {
    const existing = await this.findOne(id, companyId);
    const firstName = dto.firstName?.trim() || existing.firstName?.trim();
    const company = dto.company === undefined ? existing.company : dto.company?.trim();
    if (!firstName && !company) {
      throw new BadRequestException('First name or company is required');
    }
    const name = buildDisplayName({
      firstName,
      lastName: dto.lastName ?? existing.lastName,
      company: firstName === company ? undefined : company,
    });
    const nextClient = {
      ...existing,
      ...dto,
      firstName,
      lastName: dto.lastName ?? existing.lastName,
      company,
      name,
    };
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        firstName,
        company,
        name,
        searchKey: buildSearchKey(nextClient),
      },
    });
  }

  async remove(id: string, companyId?: string | null) {
    await this.findOne(id, companyId);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
