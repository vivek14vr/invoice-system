import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('protects routes, creates a session, and revokes it on logout', async () => {
    await request(app.getHttpServer()).get('/dashboard').expect(401);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
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
});
