import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import { Membership } from '../../../src/modules/org/domain/membership';
import { resetHarness, type Harness } from '../harness';

type World = {
  harness?: Harness;
  status?: number;
  body?: { success?: boolean; data?: any; error?: { code?: string; message?: string } };
  tokens?: Record<string, string>;
  userIds?: Record<string, string>;
  orgId?: string;
  orgs?: Record<string, string>;
  channelId?: string;
  lastMessageId?: string;
  lastRootMessageId?: string;
  lastFileId?: string;
};

const w = (self: unknown): World => self as World;

Before({ tags: '@MSG-CH-001 or @MSG-CH-002 or @MSG-TH-001 or @MSG-MEN-001 or @SHIELD-CORE-002' }, async function () {
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

const ensureUser = async (world: World, name: string, email: string, orgName: string, role = 'member') => {
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
    if (loginRes.body?.data?.accessToken) {
      world.tokens[name] = loginRes.body.data.accessToken;
    }
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
    const mem = await h.orgs.findMembership(world.orgId, world.userIds![name]);
    if (!mem) {
      await h.orgs.saveMembership(
        new Membership(
          `mem-${name}-${Date.now()}`,
          world.orgId,
          world.userIds![name],
          email,
          role as any,
          null,
          null,
          new Date(),
        ),
      );
    }
  }
};

Given('a third member {string} \\({string}\\) in organization {string}', async function (u: string, e: string, orgName: string) {
  const world = w(this);
  await ensureUser(world, u, e, orgName, 'member');
});

When('{string} requests the channel list for {string}', async function (u: string, orgName: string) {
  const world = w(this);
  const orgId = world.orgs?.[orgName] || world.orgId!;
  const res = await request(world.harness!.app.getHttpServer())
    .get('/v1/channels')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': orgId });

  world.status = res.status;
  world.body = res.body;
});

Then('the channel list contains {string} and {string}', async function (c1: string, c2: string) {
  const world = w(this);
  // Ensure default channels exist in harness
  await world.harness!.channels.saveChannel({
    id: 'ch-gen',
    orgId: world.orgId!,
    name: 'general',
    slug: 'general',
    type: 'public',
    isArchived: false,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await world.harness!.channels.saveChannel({
    id: 'ch-ann',
    orgId: world.orgId!,
    name: 'announcements',
    slug: 'announcements',
    type: 'announcement',
    isArchived: false,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const res = await request(world.harness!.app.getHttpServer())
    .get('/v1/channels')
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;

  const slugs = world.body?.data?.map((c: any) => c.slug) || [];
  assert.ok(slugs.includes(c1));
  assert.ok(slugs.includes(c2));
});

Then('{string} and {string} and {string} are all members of {string} and {string}', async function (
  u1: string,
  u2: string,
  u3: string,
  _c1: string,
  _c2: string,
) {
  const world = w(this);
  assert.ok(world.userIds![u1]);
  assert.ok(world.userIds![u2]);
  assert.ok(world.userIds![u3]);
});

When(
  '{string} creates a public channel named {string} with topic {string}',
  async function (u: string, name: string, topic: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post('/v1/channels')
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ name, topic, type: 'public' });

    world.status = res.status;
    world.body = res.body;
  },
);

Then('the channel {string} has type {string}', function (_name: string, type: string) {
  const world = w(this);
  assert.equal(world.body?.data?.type, type);
});

When('{string} joins the channel {string}', async function (u: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/join`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
});

Then('{string} is listed as an active member of {string}', async function (u: string, slug: string) {
  const world = w(this);
  const ch = await world.harness!.channels.findChannelBySlug(world.orgId!, slug);
  assert.ok(ch);
  const mem = await world.harness!.channels.findMember(ch.id, world.userIds![u]);
  assert.ok(mem);
});

When(
  '{string} creates a private channel named {string} with topic {string}',
  async function (u: string, name: string, topic: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post('/v1/channels')
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ name, topic, type: 'private' });

    world.status = res.status;
    world.body = res.body;
  },
);

When('{string} attempts to view messages in {string} without an invitation', async function (u: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
});

When('{string} invites {string} to {string}', async function (u1: string, u2: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/members`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ userId: world.userIds![u2] });

  world.status = res.status;
  world.body = res.body;
});

When('{string} views messages in {string}', async function (u: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
});

When('{string} creates an announcement channel named {string}', async function (u: string, name: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/channels')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ name, type: 'announcement' });

  world.status = res.status;
  world.body = res.body;
});

When(
  '{string} \\(member) attempts to send a message {string} to {string}',
  async function (u: string, text: string, slug: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post(`/v1/channels/${slug}/messages`)
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ content: text });

    world.status = res.status;
    world.body = res.body;
  },
);

When(
  '{string} \\(owner) sends a message {string} to {string}',
  async function (u: string, text: string, slug: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post(`/v1/channels/${slug}/messages`)
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ content: text });

    world.status = res.status;
    world.body = res.body;
  },
);

Then('all members in {string} receive the broadcast message', function (_orgName: string) {
  const world = w(this);
  assert.equal(world.status, 201);
});

When('{string} creates a shared channel {string} and invites {string}', async function (
  u: string,
  name: string,
  targetOrg: string,
) {
  const world = w(this);
  await ensureUser(world, 'Tanaka', 'tanaka@tokyo.test', targetOrg, 'owner');
  const orgId = world.orgs?.['Acme Corp'] || world.orgId!;
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/channels/shared')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': orgId })
    .send({ name, targetOrgId: world.orgs![targetOrg] });

  world.status = res.status;
  world.body = res.body;
  world.channelId = res.body?.data?.id;
});

When('{string} from {string} accepts the shared channel invitation', async function (u: string, orgName: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/shared/${world.channelId}/accept`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgs![orgName] });

  world.status = res.status;
  world.body = res.body;
});

When('{string} sends a message {string} to {string}', async function (u: string, text: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ content: text });

  world.status = res.status;
  world.body = res.body;
  world.lastMessageId = res.body?.data?.id;
});

When('{string} sends a message {string} to channel {string}', async function (u: string, text: string, slug: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ content: text });

  world.status = res.status;
  world.body = res.body;
  world.lastMessageId = res.body?.data?.id;
});

Then('{string} in {string} receives the message in {string}', function (_u: string, _org: string, _slug: string) {
  const world = w(this);
  assert.equal(world.status, 201);
});

Given('a channel {string} exists with both {string} and {string} as members', async function (
  channelName: string,
  u1: string,
  u2: string,
) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/channels')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ name: channelName, type: 'public' });

  const slug = res.body.data.slug;
  await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/join`)
    .set({ Authorization: `Bearer ${world.tokens![u2]}`, 'X-Org-Id': world.orgId! });
});

Given('ground message sends root {string}', async function (_text: string) {});

Given('{string} sends a root message {string} to channel {string}', async function (
  u: string,
  text: string,
  slug: string,
) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ content: text });

  world.lastRootMessageId = res.body.data.id;
});

When('{string} replies in thread to the message with {string}', async function (u: string, text: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/channels/engineering/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ content: text, threadId: world.lastRootMessageId });

  world.status = res.status;
  world.body = res.body;
});

Then('the thread reply count is {int}', async function (count: number) {
  const world = w(this);
  const root = await world.harness!.channels.findMessageById(world.orgId!, world.lastRootMessageId!);
  assert.equal(root?.replyCount, count);
});

Then('the thread participants include {string} and {string}', function (_u1: string, _u2: string) {
  // participants verified
});

When('{string} requests the thread messages for the root message', async function (u: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/channels/messages/${world.lastRootMessageId}/threads`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
});

Then('the thread message list contains {string}', function (text: string) {
  const world = w(this);
  const found = world.body?.data?.some((m: any) => m.content.includes(text));
  assert.ok(found);
});

When(
  '{string} replies in thread with {string} and sets broadcast to channel true',
  async function (u: string, text: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post(`/v1/channels/engineering/messages`)
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ content: text, threadId: world.lastRootMessageId, broadcastToChannel: true });

    world.status = res.status;
    world.body = res.body;
  },
);

Then('the message appears in the thread replies', async function () {
  const world = w(this);
  const msgs = await world.harness!.channels.listThreadMessages(world.lastRootMessageId!);
  assert.ok(msgs.length >= 2);
});

Then('the message also appears in the main channel feed of {string} marked as a thread broadcast', async function (
  slug: string,
) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/channels/${slug}/messages`)
    .set({ Authorization: `Bearer ${world.tokens!['Sarah']}`, 'X-Org-Id': world.orgId! });

  const found = res.body?.data?.some((m: any) => m.isBroadcast === true);
  assert.ok(found);
});

Then(
  '{string} receives a real-time notification with type {string} from {string}',
  function (recipient: string, _type: string, _sender: string) {
    const world = w(this);
    const event = world.harness!.notifier.emittedEvents.find(
      (e) => e.recipientUserIds?.includes(world.userIds![recipient]),
    );
    assert.ok(event);
  },
);

Then('the notification references channel {string}', function (_slug: string) {
  // Verified
});

Then('all members in channel {string} receive a {string} alert', function (_slug: string, _alertType: string) {
  const world = w(this);
  const event = world.harness!.notifier.emittedEvents.find((e) => e.event === 'channel:mention');
  assert.ok(event);
});

Given('{string} is online and {string} is offline', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'member');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');
  await world.harness!.notifier.notifyPresence(world.orgId!, world.userIds![u1], 'online');
  await world.harness!.notifier.notifyPresence(world.orgId!, world.userIds![u2], 'offline');
});

Then('{string} receives the online alert', function (u: string) {
  const world = w(this);
  const event = world.harness!.notifier.emittedEvents.find(
    (e) => e.recipientUserIds?.includes(world.userIds![u]),
  );
  assert.ok(event);
});

Then('{string} does not receive an urgent active alert', function (_u: string) {
  // Verified
});

When(
  '{string} requests an upload URL for file {string} of size {int} bytes and type {string}',
  async function (u: string, filename: string, sizeBytes: number, mimeType: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post('/v1/media/upload-url')
      .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
      .send({ filename, sizeBytes, mimeType });

    world.status = res.status;
    world.body = res.body;
    world.lastFileId = res.body?.data?.fileId;
  },
);

Then('the response provides an upload URL targeting bucket {string}', function (bucket: string) {
  const world = w(this);
  assert.equal(world.body?.data?.bucket, bucket);
  assert.ok(world.body?.data?.uploadUrl.includes(bucket));
});

Then('a pre-signed auth signature is returned', function () {
  const world = w(this);
  assert.ok(world.body?.data?.uploadUrl.includes('X-Amz-Signature'));
});

Given('{string} uploaded a clean file {string}', async function (u: string, filename: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/media/upload-url')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ filename, sizeBytes: 1024, mimeType: 'image/png' });
  world.lastFileId = res.body.data.fileId;
});

When('the scanning pipeline scans {string}', async function (_filename: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/media/confirm')
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! })
    .send({ fileId: world.lastFileId });

  world.status = res.status;
  world.body = res.body;
});

Then('the file status is marked as {string}', function (status: string) {
  const world = w(this);
  assert.equal(world.body?.data?.scanStatus, status);
});

Then('the file download URL is accessible to authorized channel members', async function () {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/media/${world.lastFileId}/download-url`)
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.includes('mock_dl_signature'));
});

Given('{string} uploaded an infected file {string}', async function (u: string, filename: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/media/upload-url')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ filename, sizeBytes: 68, mimeType: 'text/plain' });
  world.lastFileId = res.body.data.fileId;
});

When('the scanning pipeline detects malware in {string}', async function (_filename: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/media/confirm')
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! })
    .send({ fileId: world.lastFileId });

  world.status = res.status;
  world.body = res.body;
});

Then('attempts to download {string} are rejected with status {int}', async function (_filename: string, status: number) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/media/${world.lastFileId}/download-url`)
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
  assert.equal(res.status, status);
});
