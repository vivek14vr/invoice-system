import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  OnModuleInit,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_DURATION_MS } from './auth.constants';
import { GridFsService } from '../files/gridfs.service';

type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'READ_ONLY';
  companyId?: string | null;
  workspace?: { id: string; name: string } | null;
};
const SYSTEM_ADMIN_EMAIL = 'admin@girjasoft.com';
const LEGACY_ADMIN_EMAILS = new Set([
  'admin@example.com',
  'admin@inventory.com',
]);

function isSystemAdmin(email: string) {
  return email.trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
}

function scrypt(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: GridFsService,
  ) {}

  async onModuleInit() {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      let company = await this.prisma.company.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (!company)
        company = await this.prisma.company.create({
          data: { name: 'Default Company' },
        });
      await Promise.all([
        this.prisma.client.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.product.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.invoice.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.quotation.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.payment.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.expense.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.taxRate.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.paymentMethod.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.invoiceGroup.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
        this.prisma.setting.updateMany({
          where: { companyId: null },
          data: { companyId: company.id },
        }),
      ]);
      await this.prisma.user.updateMany({
        where: { companyId: null },
        data: { companyId: company.id },
      });
      const users = await this.prisma.user.findMany({
        where: { companyId: { not: null } },
        select: { id: true, companyId: true, role: true },
      });
      for (const user of users) {
        if (!user.companyId) continue;
        await this.prisma.workspaceMembership.upsert({
          where: {
            userId_companyId: { userId: user.id, companyId: user.companyId },
          },
          create: {
            userId: user.id,
            companyId: user.companyId,
            role: user.role,
          },
          update: {},
        });
      }

      // Keep the system administrator hard-coded to the default workspace.
      // Rename the old seeded account on startup so existing installations
      // receive the new address without creating a second administrator.
      let admin = await this.prisma.user.findUnique({
        where: { email: SYSTEM_ADMIN_EMAIL },
      });
      if (!admin) {
        admin = await this.prisma.user.findFirst({
          where: { email: { in: [...LEGACY_ADMIN_EMAILS] } },
        });
        if (admin) {
          admin = await this.prisma.user.update({
            where: { id: admin.id },
            data: { email: SYSTEM_ADMIN_EMAIL },
          });
        }
      }
      if (admin) {
        await this.prisma.user.update({
          where: { id: admin.id },
          data: { role: 'ADMIN', companyId: company.id },
        });
        await this.prisma.workspaceMembership.deleteMany({
          where: { userId: admin.id, companyId: { not: company.id } },
        });
        await this.prisma.workspaceMembership.upsert({
          where: {
            userId_companyId: { userId: admin.id, companyId: company.id },
          },
          create: { userId: admin.id, companyId: company.id, role: 'ADMIN' },
          update: { role: 'ADMIN' },
        });
        await this.prisma.session.updateMany({
          where: { userId: admin.id },
          data: { activeCompanyId: company.id },
        });
      }
      return;
    }

    const email = SYSTEM_ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 8) {
      throw new Error(
        'ADMIN_PASSWORD (at least 8 characters) is required to create the first administrator',
      );
    }

    const company = await this.prisma.company.create({
      data: { name: 'Default Company' },
    });
    const user = await this.prisma.user.create({
      data: {
        email,
        name: 'Admin User',
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        companyId: company.id,
      },
    });
    await this.prisma.workspaceMembership.create({
      data: { userId: user.id, companyId: company.id, role: 'ADMIN' },
    });
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomBytes(32).toString('base64url');
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { company: true },
    });
    if (!membership) {
      throw new UnauthorizedException(
        'No workspace has been assigned to this user',
      );
    }
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { userId: user.id }] },
      }),
      this.prisma.session.create({
        data: {
          tokenHash: tokenHash(token),
          userId: user.id,
          activeCompanyId: membership.companyId,
          expiresAt,
        },
      }),
    ]);

    return {
      token,
      expiresAt,
      user: this.safeUser(
        user,
        membership.companyId,
        membership.role,
        membership.company,
      ),
    };
  }

  async validateSession(token?: string): Promise<SafeUser | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true, activeCompany: true },
    });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    const membership = session.activeCompanyId
      ? await this.prisma.workspaceMembership.findUnique({
          where: {
            userId_companyId: {
              userId: session.userId,
              companyId: session.activeCompanyId,
            },
          },
        })
      : null;
    if (!membership) return null;
    return this.safeUser(
      session.user,
      session.activeCompanyId,
      membership.role,
      session.activeCompany,
    );
  }

  async logout(token?: string) {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: tokenHash(token) },
    });
  }

  async createUser(
    dto: {
      email: string;
      name: string;
      password: string;
      role?: 'ADMIN' | 'READ_ONLY';
    },
    activeCompanyId?: string | null,
  ) {
    const company = activeCompanyId
      ? await this.prisma.company.findUnique({ where: { id: activeCompanyId } })
      : null;
    if (!company) throw new Error('Company not found');
    const email = dto.email.trim().toLowerCase();
    if (isSystemAdmin(email)) {
      throw new BadRequestException(
        `${SYSTEM_ADMIN_EMAIL} is reserved for the Default Company administrator`,
      );
    }
    const role = dto.role ?? 'READ_ONLY';
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          role,
          companyId: company.id,
        },
      });
      await tx.workspaceMembership.create({
        data: { userId: created.id, companyId: company.id, role },
      });
      return created;
    });
    return this.safeUser(user, company.id, dto.role ?? 'READ_ONLY', company);
  }

  async listUsers(companyId?: string | null) {
    if (!companyId) return [];
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { company: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberships.map((membership) => membership.userId) } },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    return memberships.flatMap((membership) => {
      const user = usersById.get(membership.userId);
      if (!user) return [];
      return [
        {
          ...this.safeUser(
            user,
            membership.companyId,
            membership.role,
            membership.company,
          ),
          company: membership.company,
        },
      ];
    });
  }

  async removeUser(id: string, requesterId: string, companyId?: string | null) {
    if (!companyId) throw new NotFoundException('Workspace not found');
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete your own user account');
    }
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { userId_companyId: { userId: id, companyId } },
    });
    if (!membership)
      throw new NotFoundException('User not found in this workspace');
    if (membership.role === 'ADMIN') {
      const adminCount = await this.prisma.workspaceMembership.count({
        where: { companyId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'A workspace must keep at least one administrator',
        );
      }
    }
    await this.prisma.workspaceMembership.delete({
      where: { id: membership.id },
    });
    const remainingMemberships = await this.prisma.workspaceMembership.count({
      where: { userId: id },
    });
    if (remainingMemberships === 0) {
      await this.prisma.user.delete({ where: { id } });
    }
    return { ok: true };
  }

  async listWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ company, role }) => ({ ...company, role }));
  }

  async createWorkspace(userId: string, name: string) {
    const workspaceName = name.trim();
    if (!workspaceName)
      throw new HttpException(
        'Workspace name is required',
        HttpStatus.BAD_REQUEST,
      );
    const company = await this.prisma.company.create({
      data: { name: workspaceName },
    });
    await this.prisma.workspaceMembership.create({
      data: { userId, companyId: company.id, role: 'ADMIN' },
    });
    await this.prisma.invoiceGroup.createMany({
      data: [
        {
          name: 'Invoice Series',
          template: 'INV-{{{year}}}-{{{id}}}',
          nextId: 1,
          isDefault: true,
          companyId: company.id,
        },
        {
          name: 'Quotation Series',
          template: 'QUO-{{{year}}}-{{{id}}}',
          nextId: 1,
          isDefault: true,
          companyId: company.id,
        },
      ],
    });
    return { ...company, role: 'ADMIN' as const };
  }

  async deleteWorkspace(companyId: string, requesterId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Workspace not found');
    if (company.name === 'Default Company') {
      throw new BadRequestException('Default Company cannot be deleted');
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { email: true },
    });
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { userId_companyId: { userId: requesterId, companyId } },
    });
    if (
      !isSystemAdmin(requester?.email ?? '') &&
      membership?.role !== 'ADMIN'
    ) {
      throw new UnauthorizedException('You do not administer this workspace');
    }

    const expenses = await this.prisma.expense.findMany({
      where: { companyId },
      select: { attachmentId: true },
    });
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map((item) => item.userId))];

    for (const expense of expenses) {
      await this.files.delete(expense.attachmentId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { activeCompanyId: companyId },
        data: { activeCompanyId: null },
      });
      await tx.workspaceMembership.deleteMany({ where: { companyId } });
      await tx.payment.deleteMany({ where: { companyId } });
      await tx.invoice.deleteMany({ where: { companyId } });
      await tx.quotation.deleteMany({ where: { companyId } });
      await tx.expense.deleteMany({ where: { companyId } });
      await tx.client.deleteMany({ where: { companyId } });
      await tx.product.deleteMany({ where: { companyId } });
      await tx.taxRate.deleteMany({ where: { companyId } });
      await tx.paymentMethod.deleteMany({ where: { companyId } });
      await tx.invoiceGroup.deleteMany({ where: { companyId } });
      await tx.setting.deleteMany({ where: { companyId } });

      for (const userId of userIds) {
        const remaining = await tx.workspaceMembership.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (remaining) {
          await tx.user.update({
            where: { id: userId },
            data: { companyId: remaining.companyId },
          });
          await tx.session.updateMany({
            where: { userId, activeCompanyId: null },
            data: { activeCompanyId: remaining.companyId },
          });
        } else {
          await tx.user.delete({ where: { id: userId } });
        }
      }
      await tx.company.delete({ where: { id: companyId } });
    });

    return { ok: true, deletedWorkspaceId: companyId };
  }

  async switchWorkspace(userId: string, token?: string, companyId?: string) {
    if (!token || !companyId)
      throw new UnauthorizedException('Workspace selection failed');
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { company: true, user: true },
    });
    if (!membership)
      throw new UnauthorizedException(
        'You do not have access to this workspace',
      );
    await this.prisma.session.updateMany({
      where: { tokenHash: tokenHash(token), userId },
      data: { activeCompanyId: companyId },
    });
    return this.safeUser(
      membership.user,
      companyId,
      membership.role,
      membership.company,
    );
  }

  private safeUser(
    user: Pick<SafeUser, 'id' | 'email' | 'name'> & {
      role?: 'ADMIN' | 'READ_ONLY';
      companyId?: string | null;
    },
    companyId = user.companyId,
    role = user.role ?? 'READ_ONLY',
    workspace?: { id: string; name: string } | null,
  ): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      companyId,
      workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
    };
  }
}
