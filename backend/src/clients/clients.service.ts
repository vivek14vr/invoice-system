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

  findAll(search?: string) {
    return this.prisma.client.findMany({
      where: search
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
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { invoices: true } } },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
        quotes: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  create(dto: CreateClientDto) {
    const name = buildDisplayName(dto);
    return this.prisma.client.create({
      data: {
        ...dto,
        name,
        country: dto.country ?? 'IN',
      },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    const existing = await this.findOne(id);
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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
