import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('response envelope (int)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'int-secret';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.MAILER_DRIVER = 'memory';
    process.env.PERSISTENCE = 'memory';
    process.env.AUTH_RATE_LIMIT = '3';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
  }, 30000);

  afterAll(async () => {
    delete process.env.AUTH_RATE_LIMIT;
    await app.close();
  });

  it('SRS §18.2: errors carry code, message, and a requestId echoed in the header', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'password' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      requestId: expect.stringMatching(/^req_[0-9a-f]{12}$/),
    });
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });

  it('SYS-SEC-006: auth endpoints answer 429 with rate limit headers once the window is spent', async () => {
    const attempt = () =>
      request(app.getHttpServer()).post('/v1/auth/login').send({ email: 'nobody@acme.test', password: 'Wrong1234!' });

    await attempt();
    await attempt();
    await attempt();
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['x-ratelimit-limit']).toBe('3');
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
