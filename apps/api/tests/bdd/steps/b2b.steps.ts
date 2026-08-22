import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import { B2bConnection } from '../../../src/modules/b2b/domain/b2b-connection';
import { resetHarness, type Harness } from '../harness';

type World = {
  harness?: Harness;
  status?: number;
  body?: { success?: boolean; data?: any; error?: { code?: string; message?: string } };
  tokens?: Record<string, string>;
  userIds?: Record<string, string>;
  orgId?: string;
  orgs?: Record<string, string>;
  lastConnectionId?: string;
  lastConversationId?: string;
};

const w = (self: unknown): World => self as World;

Before({ tags: '@MSG-B2B-001 or @MSG-B2B-002' }, async function () {
  const world = w(this);
  world.harness = await resetHarness();
  world.tokens = {};
  world.userIds = {};
  world.orgs = {};
});

function otpFrom(h: Harness, email: string): string {
  const mail = [...h.mailer.sent].reverse().find((m) => m.to === email && /code is (\d{6})/.test(m.text));
  const match = mail?.text.match(/code is (\d{6})/);
  if (!match?.[1]) throw new Error(`no OTP for ${email}`);
  return match[1];
}

const ensureUser = async (world: World, name: string, email: string, orgName: string) => {
  if (!world.harness) {
    world.harness = await resetHarness();
  }
  const h = world.harness;
  if (!world.tokens) world.tokens = {};
  if (!world.userIds) world.userIds = {};
  if (!world.orgs) world.orgs = {};

  let user = await h.users.findByEmail(email);
  if (!user) {
    await request(h.app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email, password: 'CorrectH0rse!' });
    const otp = otpFrom(h, email);
    const verRes = await request(h.app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email, otp });
    world.tokens[name] = verRes.body.data.accessToken;
    world.userIds[name] = verRes.body.data.user.id;
  } else {
    world.userIds[name] = user.id;
    const loginRes = await request(h.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'CorrectH0rse!' });
    world.tokens[name] = loginRes.body.data.accessToken;
  }

  if (!world.orgs[orgName]) {
    const orgRes = await request(h.app.getHttpServer())
      .post('/v1/orgs')
      .set({ Authorization: `Bearer ${world.tokens[name]}` })
      .send({
        name: orgName,
        industry: 'Software',
        size: '11-50',
        country: 'BD',
        timezone: 'Asia/Dhaka',
      });
    world.orgId = orgRes.body.data.organization.id;
    world.orgs[orgName] = orgRes.body.data.organization.id;
  } else {
    world.orgId = world.orgs[orgName];
  }

  world.orgId = world.orgs[orgName];
};

Given('two connected organizations {string} and {string}', async function (org1: string, org2: string) {
  const world = w(this);
  if (!world.harness) world.harness = await resetHarness();
  const h = world.harness;

  await ensureUser(world, 'Rahim', 'rahim@acme.test', org1);
  await ensureUser(world, 'Tanaka', 'tanaka@tokyo.test', org2);

  const org1Id = world.orgs![org1];
  const org2Id = world.orgs![org2];

  const now = new Date();
  const conn = new B2bConnection({
    id: randomUUID(),
    senderOrgId: org1Id,
    senderUserId: world.userIds!['Rahim'],
    receiverOrgId: org2Id,
    introMessage: 'Connected for collaboration',
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
    acceptedAt: now,
  });

  await h.b2b.saveConnection(conn);
  world.lastConnectionId = conn.id;
});

Given('{string} and {string} have no active B2B connection', async function (org1: string, org2: string) {
  const world = w(this);
  const org1Id = world.orgs?.[org1];
  const org2Id = world.orgs?.[org2];
  if (org1Id && org2Id && world.harness) {
    const existing = await world.harness.b2b.findConnectionBetweenOrgs(org1Id, org2Id);
    if (existing) {
      await world.harness.b2b.deleteConnection(existing.id);
    }
  }
});

When('{string} sends a B2B connection request to {string} with message {string}', async function (
  userName: string,
  targetOrgName: string,
  introMessage: string,
) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const userOrgId = Object.entries(world.orgs || {}).find(([name]) =>
    userName === 'Rahim' ? name.includes('Acme') : name.includes('Tokyo'),
  )?.[1] || world.orgId!;

  let targetOrgId = world.orgs?.[targetOrgName];
  if (!targetOrgId) {
    const targetOrg = await h.orgs.findOrgBySlug(targetOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    if (targetOrg) {
      targetOrgId = targetOrg.id;
      world.orgs![targetOrgName] = targetOrg.id;
    }
  }

  const res = await request(h.app.getHttpServer())
    .post('/v1/b2b/connections')
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', userOrgId)
    .send({
      receiverOrgId: targetOrgId,
      introMessage,
    });

  world.status = res.status;
  world.body = res.body;
  if (res.body?.data?.id) {
    world.lastConnectionId = res.body.data.id;
  }
});

Then('{string} has a pending connection request from {string}', async function (targetOrgName: string, senderOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const targetOrgId = world.orgs![targetOrgName];
  const senderOrgId = world.orgs![senderOrgName];

  const conn = await h.b2b.findConnectionBetweenOrgs(senderOrgId, targetOrgId);
  assert.ok(conn, 'Connection should exist');
  assert.equal(conn.status, 'pending');
  assert.equal(conn.receiverOrgId, targetOrgId);
  world.lastConnectionId = conn.id;
});

When('{string} accepts the connection request from {string}', async function (userName: string, senderOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const receiverOrgId = world.orgs!['Tokyo Corp'] || world.orgId!;
  const connId = world.lastConnectionId!;

  const res = await request(h.app.getHttpServer())
    .post(`/v1/b2b/connections/${connId}/accept`)
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', receiverOrgId)
    .send({});

  world.status = res.status;
  world.body = res.body;
});

When('{string} rejects the connection request from {string}', async function (userName: string, senderOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const receiverOrgId = world.orgs!['Tokyo Corp'] || world.orgId!;
  const connId = world.lastConnectionId!;

  const res = await request(h.app.getHttpServer())
    .post(`/v1/b2b/connections/${connId}/reject`)
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', receiverOrgId)
    .send({});

  world.status = res.status;
  world.body = res.body;
});

When('{string} blocks {string}', async function (userName: string, targetOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const blockerOrgId = world.orgs!['Tokyo Corp'] || world.orgId!;
  const targetOrgId = world.orgs![targetOrgName];

  const res = await request(h.app.getHttpServer())
    .post('/v1/b2b/connections/block')
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', blockerOrgId)
    .send({ targetOrgId });

  world.status = res.status;
  world.body = res.body;
});

When('{string} disconnects the B2B connection with {string}', async function (userName: string, partnerOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const orgId = world.orgs!['Acme Corp'] || world.orgId!;
  const connId = world.lastConnectionId!;

  const res = await request(h.app.getHttpServer())
    .delete(`/v1/b2b/connections/${connId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', orgId);

  world.status = res.status;
  world.body = res.body;
});

Then('{string} receives the message in his conversation inbox', async function (userName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const userOrgId = Object.entries(world.orgs || {}).find(([name]) =>
    userName === 'Rahim' ? name.includes('Acme') : name.includes('Tokyo'),
  )?.[1] || world.orgId!;

  const res = await request(h.app.getHttpServer())
    .get('/v1/messenger/conversations')
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', userOrgId);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data), 'Conversations should be an array');
  assert.ok(res.body.data.length > 0, 'Should have at least 1 conversation');
});

Then('{string} and {string} have an active B2B connection', async function (org1: string, org2: string) {
  const world = w(this);
  const h = world.harness!;
  const org1Id = world.orgs![org1];
  const org2Id = world.orgs![org2];

  const conn = await h.b2b.findConnectionBetweenOrgs(org1Id, org2Id);
  assert.ok(conn, 'Connection must exist');
  assert.equal(conn.status, 'accepted');
});

Then('{string} and {string} are not connected', async function (org1: string, org2: string) {
  const world = w(this);
  const h = world.harness!;
  const org1Id = world.orgs![org1];
  const org2Id = world.orgs![org2];

  const conn = await h.b2b.findConnectionBetweenOrgs(org1Id, org2Id);
  const isConn = conn ? conn.isConnected() : false;
  assert.equal(isConn, false, 'Organizations should not have an active connection');
});

When('{string} sends {int} B2B connection requests to different target organizations', async function (
  userName: string,
  count: number,
) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const orgId = world.orgs!['Acme Corp'] || world.orgId!;

  for (let i = 0; i < count; i++) {
    const targetOrgId = `mock-target-org-${i}`;
    await request(h.app.getHttpServer())
      .post('/v1/b2b/connections')
      .set('Authorization', `Bearer ${token}`)
      .set('x-org-id', orgId)
      .send({
        receiverOrgId: targetOrgId,
        introMessage: `Daily limit test request ${i}`,
      });
  }
});

When('{string} attempts to send an 11th B2B connection request', async function (userName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const orgId = world.orgs!['Acme Corp'] || world.orgId!;

  const res = await request(h.app.getHttpServer())
    .post('/v1/b2b/connections')
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', orgId)
    .send({
      receiverOrgId: 'mock-target-org-11',
      introMessage: '11th request exceeding daily limit',
    });

  world.status = res.status;
  world.body = res.body;
});

When('{string} attempts to list channels of {string}', async function (userName: string, targetOrgName: string) {
  const world = w(this);
  const h = world.harness!;
  const token = world.tokens![userName];
  const targetOrgId = world.orgs![targetOrgName];

  const res = await request(h.app.getHttpServer())
    .get('/v1/channels')
    .set('Authorization', `Bearer ${token}`)
    .set('x-org-id', targetOrgId);

  world.status = res.status;
  world.body = res.body;
});
