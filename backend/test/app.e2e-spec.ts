import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return new Promise<string>((resolve, reject) => {
    nodeScrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt:${salt}:${key.toString('hex')}`);
    });
  });
}

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@example.test`;
  const password = 'E2ePassword@123';
  let userId: string;
  let workspaceId: string | undefined;
  let clientId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    const company = await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!company) throw new Error('Test workspace was not initialized');
    const user = await prisma.user.create({
      data: {
        email,
        name: 'E2E User',
        passwordHash: await hashPassword(password),
        companyId: company.id,
      },
    });
    userId = user.id;
    await prisma.workspaceMembership.create({
      data: { userId, companyId: company.id, role: 'ADMIN' },
    });
  });

  afterAll(async () => {
    if (userId) await prisma.session.deleteMany({ where: { userId } });
    if (workspaceId) {
      if (clientId) await prisma.client.delete({ where: { id: clientId } });
      await prisma.setting.deleteMany({ where: { companyId: workspaceId } });
      await prisma.taxRate.deleteMany({ where: { companyId: workspaceId } });
      await prisma.paymentMethod.deleteMany({
        where: { companyId: workspaceId },
      });
      await prisma.invoiceGroup.deleteMany({
        where: { companyId: workspaceId },
      });
      await prisma.workspaceMembership.deleteMany({
        where: { companyId: workspaceId },
      });
      await prisma.company.delete({ where: { id: workspaceId } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('protects routes, creates a session, and revokes it on logout', async () => {
    await request(app.getHttpServer()).get('/dashboard').expect(401);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const setCookie = login.headers['set-cookie'] as unknown as
      string[] | undefined;
    expect(setCookie?.[0]).toContain('girijasoft_session=');
    expect(setCookie?.[0]).toContain('HttpOnly');
    expect(setCookie?.[0]).toContain('SameSite=Strict');
    const cookie = setCookie?.[0].split(';')[0];
    expect(cookie).toBeDefined();

    await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', cookie!)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie!)
      .expect(204);

    await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', cookie!)
      .expect(401);
  });

  it('creates an isolated workspace and switches the active session', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const cookie = (login.headers['set-cookie'] as string[])[0].split(';')[0];
    const loginBody = login.body as unknown as {
      user: { companyId: string };
    };
    const originalWorkspaceId = loginBody.user.companyId;
    const created = await request(app.getHttpServer())
      .post('/auth/workspaces')
      .set('Cookie', cookie)
      .send({ name: 'E2E Workspace' })
      .expect(201);
    workspaceId = (created.body as unknown as { id: string }).id;

    await request(app.getHttpServer())
      .post('/auth/switch-workspace')
      .set('Cookie', cookie)
      .send({ companyId: workspaceId })
      .expect(201)
      .expect((response) => {
        const body = response.body as unknown as {
          user: { companyId: string };
        };
        expect(body.user.companyId).toBe(workspaceId);
      });

    await request(app.getHttpServer())
      .get('/clients')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/products')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/invoices')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/quotations')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/payments')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/expenses')
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/settings')
      .set('Cookie', cookie)
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as {
          settings: Record<string, string>;
          invoiceGroups: unknown[];
        };
        expect(body.settings).toBeDefined();
        expect(body.invoiceGroups).toHaveLength(2);
      });

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookie)
      .send({ firstName: 'Workspace-only client' })
      .expect(201);
    clientId = (client.body as unknown as { id: string }).id;

    await request(app.getHttpServer())
      .post('/auth/switch-workspace')
      .set('Cookie', cookie)
      .send({ companyId: originalWorkspaceId })
      .expect(201);
    await request(app.getHttpServer())
      .get('/clients')
      .set('Cookie', cookie)
      .expect(200)
      .expect((response) => {
        const clients = response.body as unknown as { id: string }[];
        expect(clients.some((row) => row.id === clientId)).toBe(false);
      });
  });
});
