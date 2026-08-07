import {
  Injectable,
  HttpException,
  HttpStatus,
  OnModuleInit,
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

type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'READ_ONLY';
  companyId?: string | null;
};
type FailedLogin = { count: number; resetAt: number };

const failedLogins = new Map<string, FailedLogin>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

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
  constructor(private readonly prisma: PrismaService) {}

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
      await this.prisma.user.updateMany({
        where: { companyId: null },
        data: { companyId: company.id },
      });

      // ADMIN_EMAIL is the configured owner account. Reconcile its role on
      // startup as well as during first-run creation so an existing account
      // cannot remain read-only after an upgrade or database restore.
      const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (configuredAdminEmail) {
        await this.prisma.user.updateMany({
          where: { email: configuredAdminEmail },
          data: { role: 'ADMIN', companyId: company.id },
        });
      }
      return;
    }

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 8) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters) are required to create the first administrator',
      );
    }

    const company = await this.prisma.company.create({
      data: { name: 'Default Company' },
    });
    await this.prisma.user.create({
      data: {
        email,
        name: 'Admin User',
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        companyId: company.id,
      },
    });
  }

  async login(email: string, password: string, clientKey: string) {
    this.assertWithinRateLimit(clientKey);
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      this.recordFailedLogin(clientKey);
      throw new UnauthorizedException('Invalid email or password');
    }

    failedLogins.delete(clientKey);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { userId: user.id }] },
      }),
      this.prisma.session.create({
        data: { tokenHash: tokenHash(token), userId: user.id, expiresAt },
      }),
    ]);

    return { token, expiresAt, user: this.safeUser(user) };
  }

  async validateSession(token?: string): Promise<SafeUser | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }
    return this.safeUser(session.user);
  }

  async logout(token?: string) {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: tokenHash(token) },
    });
  }

  async createUser(dto: {
    email: string;
    name: string;
    password: string;
    role?: 'ADMIN' | 'READ_ONLY';
    companyId?: string;
  }) {
    const company = dto.companyId
      ? await this.prisma.company.findUnique({ where: { id: dto.companyId } })
      : await this.prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!company) throw new Error('Company not found');
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await hashPassword(dto.password),
        role: dto.role ?? 'READ_ONLY',
        companyId: company.id,
      },
    });
    return this.safeUser(user);
  }

  async listUsers() {
    return (
      await this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { company: true },
      })
    ).map((user) => ({ ...this.safeUser(user), company: user.company }));
  }

  async listCompanies() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createCompany(name: string) {
    return this.prisma.company.create({ data: { name: name.trim() } });
  }

  private safeUser(user: SafeUser): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
  }

  private assertWithinRateLimit(key: string) {
    const attempt = failedLogins.get(key);
    if (!attempt) return;
    if (attempt.resetAt <= Date.now()) {
      failedLogins.delete(key);
      return;
    }
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpException(
        'Too many login attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailedLogin(key: string) {
    const existing = failedLogins.get(key);
    if (!existing || existing.resetAt <= Date.now()) {
      failedLogins.set(key, {
        count: 1,
        resetAt: Date.now() + LOGIN_WINDOW_MS,
      });
      return;
    }
    existing.count += 1;
  }
}
