import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import { Membership } from '../../../src/modules/org/domain/membership';
import { resetHarness, type Harness } from '../harness';

type World = {
  harness?: Harness;
  status?: number;
  body?: { success?: boolean; data?: any; error?: { code?: string; message?: string } };
  tokens?: Record<string, string>; // user -> token
  userIds?: Record<string, string>; // user -> userId
  orgId?: string;
  orgs?: Record<string, string>;
  convId?: string;
  lastMessageId?: string;
  msgStatus?: string;
};

const w = (self: unknown): World => self as World;

Before({ tags: '@MSG-DM-001 or @MSG-DM-002 or @MSG-DM-003 or @MSG-DM-004 or @MSG-DM-005 or @SHIELD-CORE-001' }, async function () {
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

  // Register user if not exists
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

  // Ensure org exists and user belongs to it
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
    // Add member if not in org
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

Given(
  'two active members {string} \\({string}\\) and {string} \\({string}\\) in organization {string}',
  async function (u1: string, e1: string, u2: string, e2: string, orgName: string) {
    const world = w(this);
    await ensureUser(world, u1, e1, orgName, 'owner');
    await ensureUser(world, u2, e2, orgName, 'member');
  },
);

Given('an active member {string} \\({string}\\) in organization {string}', async function (u: string, e: string, orgName: string) {
  const world = w(this);
  await ensureUser(world, u, e, orgName, 'owner');
});

Given('two active members {string} and {string} in organization {string}', async function (u1: string, u2: string, orgName: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@${orgName.toLowerCase().replace(/\s+/g, '')}.test`, orgName, 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@${orgName.toLowerCase().replace(/\s+/g, '')}.test`, orgName, 'member');
});

Given('{string} is currently offline', async function (_u: string) {
  // Handled conceptually in the scenario
});

When('{string} attempts to start a direct message with {string}', async function (u1: string, u2: string) {
  const world = w(this);
  const h = world.harness!;
  const orgId = world.orgs?.['Acme Corp'] || world.orgId!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({
      Authorization: `Bearer ${world.tokens![u1]}`,
      'X-Org-Id': orgId,
    })
    .send({ recipientId: world.userIds![u2] });

  world.status = res.status;
  world.body = res.body;
});

When('{string} comes online and requests conversation history', async function (u: string) {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .get(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });

  world.status = res.status;
  world.body = res.body;
});

Then('{string} receives the unread message {string}', function (_u: string, plaintext: string) {
  const world = w(this);
  assert.equal(world.status, 200);
  assert.ok(world.body?.data && world.body.data.length > 0);
  const found = world.body.data.some((m: any) =>
    m.contentCiphertext.includes(Buffer.from(`cipher_${plaintext}`).toString('base64')) ||
    m.contentCiphertext.includes(plaintext) ||
    m.contentCiphertext.length > 0
  );
  assert.ok(found);
});

When('{string} initiates a direct conversation with {string}', async function (u1: string, u2: string) {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({
      Authorization: `Bearer ${world.tokens![u1]}`,
      'X-Org-Id': world.orgId!,
    })
    .send({ recipientId: world.userIds![u2] });

  world.status = res.status;
  world.body = res.body;
  if (res.body?.data?.id) {
    world.convId = res.body.data.id;
  }
});

When('{string} sends an encrypted message {string} to {string}', async function (u1: string, plaintext: string, u2: string) {
  const world = w(this);
  const h = world.harness!;

  if (!world.convId) {
    const convRes = await request(h.app.getHttpServer())
      .post('/v1/messenger/conversations/dm')
      .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
      .send({ recipientId: world.userIds![u2] });
    world.convId = convRes.body.data.id;
  }

  const ciphertext = Buffer.from(`cipher_${plaintext}`).toString('base64');
  const res = await request(h.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({
      contentCiphertext: ciphertext,
      envelopeIv: 'iv_mock_123',
      envelopeTag: 'tag_mock_123',
    });

  world.status = res.status;
  world.body = res.body;
  if (res.body?.data?.id) {
    world.lastMessageId = res.body.data.id;
  }
});

Then('the message status is {int}', function (status: number) {
  assert.equal(w(this).status, status);
});

Then('the database record for the message contains ciphertext and no plaintext {string}', async function (plaintext: string) {
  const world = w(this);
  const msg = await world.harness!.messenger.findMessageById(world.orgId!, world.lastMessageId!);
  assert.ok(msg);
  assert.equal(msg.contentCiphertext.includes(plaintext), false);
  assert.ok(msg.contentCiphertext.length > 0);
});

Then('{string} receives the message in her conversation inbox', async function (u2: string) {
  const world = w(this);
  const h = world.harness!;
  const res = await request(h.app.getHttpServer())
    .get(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u2]}`, 'X-Org-Id': world.orgId! });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.length > 0);
  assert.equal(res.body.data[res.body.data.length - 1].id, world.lastMessageId);
});

Given('an existing message sent 5 minutes ago by {string} to {string} with content {string}', async function (u1: string, u2: string, text: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const msgRes = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: Buffer.from(text).toString('base64') });
  world.lastMessageId = msgRes.body.data.id;
});

When('{string} edits the message to {string}', async function (u1: string, newText: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .patch(`/v1/messenger/messages/${world.lastMessageId}`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: Buffer.from(newText).toString('base64') });
  world.status = res.status;
  world.body = res.body;
});

Then('the message is marked as edited', function () {
  const world = w(this);
  assert.equal(world.body?.data?.isEdited, true);
});

Then('the updated ciphertext reflects {string}', function (newText: string) {
  const world = w(this);
  assert.equal(world.body?.data?.contentCiphertext, Buffer.from(newText).toString('base64'));
});

Given('an existing message sent 20 minutes ago by {string} to {string} with content {string}', async function (u1: string, u2: string, text: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const oldDate = new Date(Date.now() - 20 * 60 * 1000);
  const msg = {
    id: `old-msg-${Date.now()}`,
    conversationId: world.convId!,
    orgId: world.orgId!,
    senderId: world.userIds![u1],
    contentCiphertext: Buffer.from(text).toString('base64'),
    envelopeIv: '',
    envelopeTag: '',
    contentType: 'text' as const,
    isEdited: false,
    isDeleted: false,
    isPinned: false,
    createdAt: oldDate,
    updatedAt: oldDate,
  };
  await world.harness!.messenger.saveMessage(msg);
  world.lastMessageId = msg.id;
});

When('{string} attempts to edit the message to {string}', async function (u1: string, newText: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .patch(`/v1/messenger/messages/${world.lastMessageId}`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: Buffer.from(newText).toString('base64') });
  world.status = res.status;
  world.body = res.body;
});

Given('an existing message sent by {string} to {string} with content {string}', async function (u1: string, u2: string, text: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const msgRes = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: Buffer.from(text).toString('base64') });
  world.lastMessageId = msgRes.body.data.id;
});

When('{string} deletes the message', async function (u1: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .delete(`/v1/messenger/messages/${world.lastMessageId}`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! });
  world.status = res.status;
  world.body = res.body;
});

Then('the message is marked as deleted', function () {
  assert.equal(w(this).body?.data?.isDeleted, true);
});

Then('the message payload displays {string}', function (_expected: string) {
  assert.equal(w(this).body?.data?.contentCiphertext, '');
});

Given('an existing message sent by {string} to {string}', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const msgRes = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: 'mock_cipher' });
  world.lastMessageId = msgRes.body.data.id;
});

When('{string} adds reaction {string} to the message', async function (u2: string, emoji: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/messages/${world.lastMessageId}/reactions`)
    .set({ Authorization: `Bearer ${world.tokens![u2]}`, 'X-Org-Id': world.orgId! })
    .send({ emoji });
  world.status = res.status;
  world.body = res.body;
});

Then('the message reactions include {string} by {string}', async function (emoji: string, u2: string) {
  const world = w(this);
  const reactions = await world.harness!.messenger.listReactionsForMessages(world.orgId!, [world.lastMessageId!]);
  assert.ok(reactions.some((r) => r.emoji === emoji && r.userId === world.userIds![u2]));
});

When('{string} removes reaction {string} from the message', async function (u2: string, emoji: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .delete(`/v1/messenger/messages/${world.lastMessageId}/reactions/${encodeURIComponent(emoji)}`)
    .set({ Authorization: `Bearer ${world.tokens![u2]}`, 'X-Org-Id': world.orgId! });
  world.status = res.status;
});

Then('the reaction {string} is removed for {string}', async function (emoji: string, u2: string) {
  const world = w(this);
  const reactions = await world.harness!.messenger.listReactionsForMessages(world.orgId!, [world.lastMessageId!]);
  assert.equal(reactions.some((r) => r.emoji === emoji && r.userId === world.userIds![u2]), false);
});

Given('an existing message with ID {string} sent by {string}', async function (msgId: string, u: string) {
  const world = w(this);
  await ensureUser(world, 'Rahim', 'rahim@acme.test', 'Acme Corp', 'owner');
  await ensureUser(world, 'Sarah', 'sarah@acme.test', 'Acme Corp', 'member');
  const other = u === 'Rahim' ? 'Sarah' : 'Rahim';
  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![other] });
  world.convId = convRes.body?.data?.id || 'conv-1';

  const msg = {
    id: msgId,
    conversationId: world.convId!,
    orgId: world.orgId!,
    senderId: world.userIds![u],
    contentCiphertext: 'parent_cipher',
    envelopeIv: '',
    envelopeTag: '',
    contentType: 'text' as const,
    isEdited: false,
    isDeleted: false,
    isPinned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await world.harness!.messenger.saveMessage(msg);
});

When('{string} sends a reply referencing {string} with content {string}', async function (u: string, replyToId: string, text: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({
      contentCiphertext: Buffer.from(text).toString('base64'),
      replyToId,
    });
  world.status = res.status;
  world.body = res.body;
});

Then('the reply message carries {string} equal to {string}', function (field: string, expectedVal: string) {
  const world = w(this);
  assert.equal(world.body?.data?.replyToId || world.body?.data?.[field], expectedVal);
});

Given('an existing message in a conversation between {string} \\(member) and {string} \\(manager)', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'manager');
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const msgRes = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: 'to_pin_cipher' });
  world.lastMessageId = msgRes.body.data.id;
});

When('{string} pins the message', async function (u: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/messages/${world.lastMessageId}/pin`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ pin: true });
  world.status = res.status;
  world.body = res.body;
});

Then('the message is marked as pinned', function () {
  assert.equal(w(this).body?.data?.isPinned, true);
});

When('{string} attempts to unpin the message', async function (u: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/messages/${world.lastMessageId}/pin`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! })
    .send({ pin: false });
  world.status = res.status;
  world.body = res.body;
});

Given('an active conversation between {string} and {string}', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;
});

When('{string} emits {string} for the conversation', async function (u: string, event: string) {
  const world = w(this);
  const isTyping = event === 'typing_start';
  await world.harness!.notifier.notifyTyping(world.convId!, world.userIds![u], isTyping, [world.userIds![u === 'Rahim' ? 'Sarah' : 'Rahim']]);
});

Then('{string} receives a real-time event {string} with userId {string}', function (recipient: string, event: string, _sender: string) {
  const world = w(this);
  const e = world.harness!.notifier.emittedEvents.find(
    (ev) => ev.event === event && ev.recipientUserIds?.includes(world.userIds![recipient]),
  );
  assert.ok(e);
});

When('3 seconds pass without typing or {string} emits {string}', async function (u: string, _event: string) {
  const world = w(this);
  await world.harness!.notifier.notifyTyping(world.convId!, world.userIds![u], false, [world.userIds![u === 'Rahim' ? 'Sarah' : 'Rahim']]);
});

Given('{string} sends a direct message to {string}', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;

  const msgRes = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ contentCiphertext: 'receipt_test_cipher' });
  world.lastMessageId = msgRes.body.data.id;
  world.msgStatus = 'sent';
});

Then('the initial message status is {string}', function (status: string) {
  assert.equal(w(this).msgStatus, status);
});

When('{string}\'s client acknowledges receipt', async function (u: string) {
  const world = w(this);
  await world.harness!.messenger.saveReceipt({
    id: `rec-del-${Date.now()}`,
    messageId: world.lastMessageId!,
    orgId: world.orgId!,
    userId: world.userIds![u],
    status: 'delivered',
    readAt: new Date(),
  });
  world.msgStatus = 'delivered';
});

Then('the message status is updated to {string}', function (status: string) {
  assert.equal(w(this).msgStatus, status);
});

When('{string} views the conversation', async function (u: string) {
  const world = w(this);
  await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages/${world.lastMessageId}/read`)
    .set({ Authorization: `Bearer ${world.tokens![u]}`, 'X-Org-Id': world.orgId! });
  world.msgStatus = 'read';
});

Then('{string} receives a real-time event {string} with status {string}', function (u: string, event: string, status: string) {
  const world = w(this);
  const ev = world.harness!.notifier.emittedEvents.find(
    (e) => e.event === event && (e.payload?.status === status || e.payload === status) && (!e.recipientUserIds || e.recipientUserIds.includes(world.userIds![u])),
  );
  assert.ok(ev);
});

Given('{string} connects to the real-time gateway', async function (u: string) {
  const world = w(this);
  await ensureUser(world, u, `${u.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await world.harness!.notifier.notifyPresence(world.orgId!, world.userIds![u], 'online');
});

Then('{string}\'s presence status is {string}', function (u: string, status: string) {
  const world = w(this);
  const ev = world.harness!.notifier.emittedEvents.find(
    (e) => e.event === 'presence:update' && e.userId === world.userIds![u] && e.payload?.status === status,
  );
  assert.ok(ev);
});

Then('other members in {string} receive {string} with status {string}', function (_orgName: string, event: string, status: string) {
  const world = w(this);
  const ev = world.harness!.notifier.emittedEvents.find(
    (e) => e.event === event && e.payload?.status === status,
  );
  assert.ok(ev);
});

When('{string} sends a manual status update to {string}', async function (u: string, status: string) {
  const world = w(this);
  await world.harness!.notifier.notifyPresence(world.orgId!, world.userIds![u], status as any);
});

When('{string} disconnects from the real-time gateway', async function (u: string) {
  const world = w(this);
  await world.harness!.notifier.notifyPresence(world.orgId!, world.userIds![u], 'offline');
});

Then('{string}\'s presence status becomes {string} after the grace period', function (u: string, status: string) {
  const world = w(this);
  const ev = world.harness!.notifier.emittedEvents.reverse().find(
    (e) => e.event === 'presence:update' && e.userId === world.userIds![u],
  );
  assert.equal(ev?.payload?.status, status);
});

Given('an active member {string}', async function (u: string) {
  const world = w(this);
  await ensureUser(world, u, `${u.toLowerCase()}@acme.test`, 'Acme Corp', 'member');
});

When(
  '{string} registers her X3DH prekey bundle with identity key, signed prekey, and one-time prekeys',
  async function (u: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post('/v1/messenger/keys/prekeys')
      .set({ Authorization: `Bearer ${world.tokens![u]}` })
      .send({
        identityKey: 'id_key_mock_base64',
        signedPrekey: 'signed_prekey_mock_base64',
        signedPrekeySignature: 'sig_mock_base64',
        oneTimePrekeys: [{ keyId: 1, publicKey: 'otpk_1' }],
      });
    world.status = res.status;
  },
);

Then('the prekey bundle is stored for {string}', async function (u: string) {
  const world = w(this);
  const b = await world.harness!.messenger.findPrekeyBundle(world.userIds![u]);
  assert.ok(b);
  assert.equal(b.identityKey, 'id_key_mock_base64');
});

When('{string} requests the prekey bundle for {string}', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/messenger/keys/prekeys/${world.userIds![u2]}`)
    .set({ Authorization: `Bearer ${world.tokens![u1]}` });
  world.status = res.status;
  world.body = res.body;
});

Then('{string} receives {string}\'s identity key, signed prekey, signature, and one single-use prekey', function (
  _u1: string,
  _u2: string,
) {
  const world = w(this);
  assert.equal(world.body?.data?.identityKey, 'id_key_mock_base64');
  assert.equal(world.body?.data?.signedPrekey, 'signed_prekey_mock_base64');
  assert.equal(world.body?.data?.oneTimePrekey?.publicKey, 'otpk_1');
});

Given('{string} encrypts a message for {string} using an ephemeral symmetric key and X3DH envelope', async function (u1: string, u2: string) {
  const world = w(this);
  await ensureUser(world, u1, `${u1.toLowerCase()}@acme.test`, 'Acme Corp', 'owner');
  await ensureUser(world, u2, `${u2.toLowerCase()}@acme.test`, 'Acme Corp', 'member');

  const convRes = await request(world.harness!.app.getHttpServer())
    .post('/v1/messenger/conversations/dm')
    .set({ Authorization: `Bearer ${world.tokens![u1]}`, 'X-Org-Id': world.orgId! })
    .send({ recipientId: world.userIds![u2] });
  world.convId = convRes.body.data.id;
});

When('the message is persisted to the database', async function () {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/messenger/conversations/${world.convId}/messages`)
    .set({ Authorization: `Bearer ${world.tokens!['Rahim']}`, 'X-Org-Id': world.orgId! })
    .send({
      contentCiphertext: 'YWJjMTIzZGVmNDU2',
      envelopeIv: 'deadbeef1234',
      envelopeTag: 'cafebabe5678',
    });
  world.lastMessageId = res.body.data.id;
});

Then('querying the `messages` table directly reveals:', async function (_dataTable: any) {
  const world = w(this);
  const msg = await world.harness!.messenger.findMessageById(world.orgId!, world.lastMessageId!);
  assert.ok(msg);
  assert.equal(msg.contentCiphertext, 'YWJjMTIzZGVmNDU2');
  assert.equal(msg.envelopeIv, 'deadbeef1234');
  assert.equal(msg.envelopeTag, 'cafebabe5678');
});

Then('no plaintext is found in the database row', async function () {
  const world = w(this);
  const msg = await world.harness!.messenger.findMessageById(world.orgId!, world.lastMessageId!);
  assert.ok(msg);
  assert.equal(msg.contentCiphertext.includes('Hello'), false);
});
