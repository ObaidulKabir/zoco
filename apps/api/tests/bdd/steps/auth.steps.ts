import { AfterAll, Given, Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import { sha256 } from '../../../src/modules/identity/domain/crypto';
import { closeHarness, resetHarness, type Harness } from '../harness';

type World = {
  harness?: Harness;
  status?: number;
  body?: { success?: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } };
  headers?: Record<string, string | string[] | undefined>;
  accessToken?: string;
  refreshToken?: string;
  previousRefreshToken?: string;
  sessionId?: string;
  userId?: string;
};

function w(self: unknown): World {
  return self as World;
}

function capture(world: World, res: { status: number; body: World['body']; headers?: World['headers'] }) {
  world.status = res.status;
  world.body = res.body;
  world.headers = res.headers;
  const data = res.body?.data as
    | { accessToken?: string; refreshToken?: string; sessionId?: string; user?: { id?: string } }
    | undefined;
  if (data?.accessToken) world.accessToken = data.accessToken;
  if (data?.refreshToken) {
    world.previousRefreshToken = world.refreshToken;
    world.refreshToken = data.refreshToken;
  }
  if (data?.sessionId) world.sessionId = data.sessionId;
  if (data?.user?.id) world.userId = data.user.id;
}

Given('a clean identity store', async function () {
  w(this).harness = await resetHarness();
});

Given('a registered user {string} with password {string}', async function (email: string, password: string) {
  const world = w(this);
  const h = world.harness ?? (await resetHarness());
  world.harness = h;
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/register')
    .send({ name: 'Sarah Chen', email, password });
  capture(world, res);
});

Given('a verified user {string} with password {string}', async function (email: string, password: string) {
  const world = w(this);
  const h = world.harness ?? (await resetHarness());
  world.harness = h;
  await request(h.app.getHttpServer())
    .post('/v1/auth/register')
    .send({ name: 'Sarah Chen', email, password });
  const otp = otpFrom(h, email);
  const res = await request(h.app.getHttpServer()).post('/v1/auth/verify-email').send({ email, otp });
  capture(world, res);
});

Given('the auth rate limit is {int} attempts per IP', async function (limit: number) {
  const world = w(this);
  const h = world.harness ?? (await resetHarness());
  world.harness = h;
  process.env.AUTH_RATE_LIMIT = String(limit);
  h.rateLimiter.clear();
});

Given('an invitation for {string} with token {string}', async function (email: string, token: string) {
  const world = w(this);
  const h = world.harness ?? (await resetHarness());
  world.harness = h;
  await h.invitations.record(sha256(token), {
    email,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
});

When(
  'I register {string} with email {string} using invite token {string}',
  async function (name: string, email: string, inviteToken: string) {
    const world = w(this);
    const h = world.harness!;
    const res = await request(h.app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email, password: 'CorrectH0rse!', inviteToken });
    capture(world, res);
  },
);

When(
  'I register with name {string} email {string} and password {string}',
  async function (name: string, email: string, password: string) {
    const world = w(this);
    const h = world.harness ?? (await resetHarness());
    world.harness = h;
    const res = await request(h.app.getHttpServer()).post('/v1/auth/register').send({ name, email, password });
    capture(world, res);
  },
);

When('I login with email {string} and password {string}', async function (email: string, password: string) {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer()).post('/v1/auth/login').send({ email, password });
  capture(world, res);
});

When('I verify email {string} with the OTP from mail', async function (email: string) {
  const world = w(this);
  const h = world.harness!;
  const otp = otpFrom(h, email);
  const res = await request(h.app.getHttpServer()).post('/v1/auth/verify-email').send({ email, otp });
  capture(world, res);
});

When('I fail login {int} times for {string}', async function (times: number, email: string) {
  const world = w(this);
  const h = world.harness!;
  for (let i = 0; i < times; i += 1) {
    const res = await request(h.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'WrongPass1!' });
    capture(world, res);
  }
});

When('I refresh the session', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/refresh')
    .send({ refreshToken: world.refreshToken });
  capture(world, res);
});

When('I refresh using the previous refresh token', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/refresh')
    .send({ refreshToken: world.previousRefreshToken });
  capture(world, res);
});

When('I request a password reset for {string}', async function (email: string) {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer()).post('/v1/auth/forgot-password').send({ email });
  capture(world, res);
});

When('I reset the password for {string} to {string}', async function (email: string, password: string) {
  const world = w(this);
  const h = world.harness!;
  const token = resetTokenFrom(h, email);
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/reset-password')
    .send({ email, token, password });
  capture(world, res);
});

When('I list sessions', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .get('/v1/auth/sessions')
    .set('Authorization', `Bearer ${world.accessToken ?? ''}`);
  capture(world, res);
});

When('I revoke the current session', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .delete(`/v1/auth/sessions/${world.sessionId}`)
    .set('Authorization', `Bearer ${world.accessToken ?? ''}`);
  capture(world, res);
});

When('I logout all devices', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/logout-all')
    .set('Authorization', `Bearer ${world.accessToken ?? ''}`);
  capture(world, res);
});

When('I enable MFA', async function () {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/auth/mfa/enable')
    .set('Authorization', `Bearer ${world.accessToken ?? ''}`);
  capture(world, res);
});

Then('the response status is {int}', function (status: number) {
  if (w(this).status !== status) {
    throw new Error(`expected ${status} got ${w(this).status} body=${JSON.stringify(w(this).body)}`);
  }
});

Then('the user status is {string}', function (status: string) {
  const user = w(this).body?.data?.user as { status?: string } | undefined;
  const nested = (w(this).body?.data as { status?: string } | undefined)?.status;
  const actual = user?.status ?? nested;
  if (actual !== status) throw new Error(`expected status ${status} got ${actual}`);
});

Then('the error code is {string}', function (code: string) {
  if (w(this).body?.error?.code !== code) {
    throw new Error(`expected code ${code} got ${JSON.stringify(w(this).body)}`);
  }
});

Then('the error message is {string}', function (message: string) {
  if (w(this).body?.error?.message !== message) {
    throw new Error(`expected message ${message} got ${JSON.stringify(w(this).body)}`);
  }
});

Then('a verification email with a 6-digit OTP was sent to {string}', function (email: string) {
  const otp = otpFrom(w(this).harness!, email);
  if (!otp || !/^\d{6}$/.test(otp)) throw new Error('OTP email missing');
});

Then('a rate limit header is returned', function () {
  const headers = w(this).headers ?? {};
  if (!headers['x-ratelimit-limit'] || !headers['retry-after']) {
    throw new Error(`rate limit headers missing: ${JSON.stringify(headers)}`);
  }
});

Then('the verification code is returned in the response', function () {
  const code = (w(this).body?.data as { verificationCode?: string } | undefined)?.verificationCode;
  if (!code || !/^\d{6}$/.test(code)) throw new Error(`expected a 6-digit code, got ${code}`);
});

Then('no verification code is returned in the response', function () {
  const code = (w(this).body?.data as { verificationCode?: string } | undefined)?.verificationCode;
  if (code) throw new Error('verification code leaked to an unverified invite');
});

Then('access and refresh tokens are returned', function () {
  const world = w(this);
  if (!world.accessToken || !world.refreshToken) {
    throw new Error(`tokens missing: ${JSON.stringify(world.body)}`);
  }
});

Then('organizations list is empty', function () {
  const orgs = (w(this).body?.data as { organizations?: unknown[] })?.organizations;
  if (!Array.isArray(orgs) || orgs.length !== 0) throw new Error('expected empty organizations');
});

Then('a login audit event was recorded', function () {
  const found = w(this).harness!.audit.events.some((e) => e.type === 'login_success');
  if (!found) throw new Error('login_success audit missing');
});

Then('the reset message does not enumerate emails', function () {
  const message = (w(this).body?.data as { message?: string })?.message ?? '';
  if (!/if an account exists/i.test(message)) throw new Error(message);
});

Then('a password reset email was not sent', function () {
  const sent = w(this).harness!.mailer.sent.some((m) => /reset/i.test(m.subject));
  if (sent) throw new Error('reset email should not be sent');
});

Then('at least {int} session is listed', function (n: number) {
  const data = w(this).body?.data;
  if (!Array.isArray(data) || data.length < n) throw new Error(`expected >= ${n} sessions`);
});

AfterAll(async () => {
  await closeHarness().catch(() => {});
});

function otpFrom(h: Harness, email: string): string {
  const mail = [...h.mailer.sent].reverse().find((m) => m.to === email && /code is (\d{6})/.test(m.text));
  const match = mail?.text.match(/code is (\d{6})/);
  if (!match?.[1]) throw new Error(`no OTP for ${email}`);
  return match[1];
}

function resetTokenFrom(h: Harness, email: string): string {
  const mail = [...h.mailer.sent].reverse().find((m) => m.to === email && /token=/.test(m.text));
  const match = mail?.text.match(/token=([a-f0-9]+)/);
  if (!match?.[1]) throw new Error(`no reset token for ${email}`);
  return match[1];
}
