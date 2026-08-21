import { Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import type { Harness } from '../harness';

type World = {
  harness?: Harness;
  status?: number;
  body?: { success?: boolean; data?: Record<string, unknown> | unknown[]; error?: { code?: string; message?: string } };
  accessToken?: string;
  userId?: string;
  orgId?: string;
  orgs?: Record<string, string>;
  deptIds?: Record<string, string>;
  nestedDeptId?: string;
};

const w = (self: unknown): World => self as World;

const capture = (world: World, res: { status: number; body: World['body'] }) => {
  world.status = res.status;
  world.body = res.body;
  const data = res.body && typeof res.body === 'object' && 'data' in res.body ? res.body.data : undefined;
  const org = (data as { organization?: { id?: string; name?: string; slug?: string } } | undefined)?.organization;
  if (org?.id) {
    world.orgId = org.id;
    world.orgs = { ...world.orgs, [org.name ?? org.slug ?? org.id]: org.id };
  }
  const dept = data as { id?: string; name?: string } | undefined;
  if (dept?.id && dept.name) {
    world.deptIds = { ...world.deptIds, [dept.name]: dept.id };
    world.nestedDeptId = dept.id;
  }
};

const auth = (world: World) => ({ Authorization: `Bearer ${world.accessToken ?? ''}` });
const orgHeaders = (world: World, orgId?: string) => ({
  ...auth(world),
  'X-Org-Id': orgId ?? world.orgId ?? '',
});

const createOrg = async (
  world: World,
  name: string,
  industry: string,
  size: string,
  country: string,
  timezone: string,
  token: boolean,
) => {
  const h = world.harness!;
  const req = request(h.app.getHttpServer()).post('/v1/orgs').send({ name, industry, size, country, timezone });
  if (token) req.set(auth(world));
  const res = await req;
  capture(world, res);
};

When(
  'I create an organization named {string} in industry {string} size {string} country {string} timezone {string}',
  async function (name: string, industry: string, size: string, country: string, timezone: string) {
    await createOrg(w(this), name, industry, size, country, timezone, true);
  },
);

When(
  'I create an organization named {string} in industry {string} size {string} country {string} timezone {string} without a token',
  async function (name: string, industry: string, size: string, country: string, timezone: string) {
    await createOrg(w(this), name, industry, size, country, timezone, false);
  },
);

When('I invite emails {string} as role {string}', async function (emails: string, role: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/orgs/${world.orgId}/invite`)
    .set(orgHeaders(world))
    .send({ emails: emails.split(',').map((e) => e.trim()), role });
  capture(world, res);
});

When('I invite CSV:', async function (csv: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/orgs/${world.orgId}/invite`)
    .set(orgHeaders(world))
    .send({ csv });
  capture(world, res);
});

When('I accept the invitation for {string}', async function (email: string) {
  const world = w(this);
  const mail = [...world.harness!.mailer.sent].reverse().find((m) => m.to === email && /token=/.test(m.text));
  const token = mail?.text.match(/token=([a-f0-9]+)/)?.[1] ?? mail?.text.match(/invite=([a-f0-9]+)/)?.[1];
  const res = await request(world.harness!.app.getHttpServer())
    .post('/v1/orgs/invitations/accept')
    .set(auth(world))
    .send({ token });
  capture(world, res);
});

When('the invitation for {string} is marked expired', async function (email: string) {
  const world = w(this);
  const invite = world.harness!.orgs.invitations.find((i) => i.orgId === world.orgId && i.email === email);
  if (!invite) throw new Error(`no invitation found for ${email}`);
  invite.status = 'expired';
  await world.harness!.orgs.saveInvitation(invite);
});

When('I list members of the Acme organization as {string}', async function (_email: string) {
  const world = w(this);
  const acmeId = world.orgs?.Acme;
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/orgs/${acmeId}/members`)
    .set(auth(world));
  capture(world, res);
});

When('I list members with the Nodi organization header', async function () {
  const world = w(this);
  const nodiId = world.orgs?.['Nodi Traders'];
  const res = await request(world.harness!.app.getHttpServer()).get('/v1/orgs/members').set(orgHeaders(world, nodiId));
  capture(world, res);
});

When('I create a department named {string} under {string}', async function (name: string, parent: string) {
  const world = w(this);
  const parentId =
    world.deptIds?.[parent] ??
    world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === parent)?.id;
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/orgs/${world.orgId}/departments`)
    .set(orgHeaders(world))
    .send({ name, parentId });
  capture(world, res);
});

When('I create five nested departments under {string}', async function (root: string) {
  const world = w(this);
  let parentId = world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === root)?.id;
  for (const name of ['L2', 'L3', 'L4', 'L5']) {
    const res = await request(world.harness!.app.getHttpServer())
      .post(`/v1/orgs/${world.orgId}/departments`)
      .set(orgHeaders(world))
      .send({ name, parentId });
    capture(world, res);
    parentId = (res.body?.data as { id?: string } | undefined)?.id;
    world.nestedDeptId = parentId;
  }
});

When('I create a sixth nested department', async function () {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/orgs/${world.orgId}/departments`)
    .set(orgHeaders(world))
    .send({ name: 'L6', parentId: world.nestedDeptId });
  capture(world, res);
});

When('I assign myself to department {string}', async function (name: string) {
  const world = w(this);
  const deptId =
    world.deptIds?.[name] ??
    world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === name)?.id;
  const res = await request(world.harness!.app.getHttpServer())
    .patch(`/v1/orgs/${world.orgId}/members/${world.userId}`)
    .set(orgHeaders(world))
    .send({ departmentId: deptId });
  capture(world, res);
});

When('I delete department {string} without reassignment', async function (name: string) {
  const world = w(this);
  const deptId = world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === name)?.id;
  const res = await request(world.harness!.app.getHttpServer())
    .delete(`/v1/orgs/${world.orgId}/departments/${deptId}`)
    .set(orgHeaders(world))
    .send({});
  capture(world, res);
});

When('I delete department {string} reassigning to {string}', async function (name: string, target: string) {
  const world = w(this);
  const deptId = world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === name)?.id;
  const reassignToDepartmentId = world.harness!.orgs.departments.find(
    (d) => d.orgId === world.orgId && d.name === target,
  )?.id;
  const res = await request(world.harness!.app.getHttpServer())
    .delete(`/v1/orgs/${world.orgId}/departments/${deptId}`)
    .set(orgHeaders(world))
    .send({ reassignToDepartmentId });
  capture(world, res);
});

When('I create a team named {string} in department {string}', async function (name: string, dept: string) {
  const world = w(this);
  const departmentId = world.harness!.orgs.departments.find((d) => d.orgId === world.orgId && d.name === dept)?.id;
  const res = await request(world.harness!.app.getHttpServer())
    .post(`/v1/orgs/${world.orgId}/teams`)
    .set(orgHeaders(world))
    .send({ name, departmentId });
  capture(world, res);
});

When('I request the organization chart', async function () {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .get(`/v1/orgs/${world.orgId}/chart`)
    .set(orgHeaders(world));
  capture(world, res);
});

When(
  'I update my profile with title {string} presence {string} and language {string}',
  async function (title: string, presence: string, language: string) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .patch(`/v1/orgs/${world.orgId}/profile`)
      .set(orgHeaders(world))
      .send({ title, presence, language });
    capture(world, res);
  },
);

When(
  'I request an avatar upload URL for type {string} and size {int}',
  async function (contentType: string, size: number) {
    const world = w(this);
    const res = await request(world.harness!.app.getHttpServer())
      .post(`/v1/orgs/${world.orgId}/profile/avatar-url`)
      .set(orgHeaders(world))
      .send({ contentType, size });
    capture(world, res);
  },
);

When('I update organization settings with invitation policy {string}', async function (invitationPolicy: string) {
  const world = w(this);
  const res = await request(world.harness!.app.getHttpServer())
    .patch(`/v1/orgs/${world.orgId}`)
    .set(orgHeaders(world))
    .send({ invitationPolicy });
  capture(world, res);
});

Then('the organization slug is {string}', function (slug: string) {
  const data = w(this).body as { data?: { organization?: { slug?: string } } };
  if (data.data?.organization?.slug !== slug) {
    throw new Error(`expected slug ${slug} got ${JSON.stringify(w(this).body)}`);
  }
});

Then('I am the organization owner', function () {
  const data = w(this).body as { data?: { membership?: { role?: string } } };
  if (data.data?.membership?.role !== 'owner') throw new Error('expected owner role');
});

Then('default departments {string} and {string} exist', function (a: string, b: string) {
  const data = w(this).body as { data?: { departments?: Array<{ name: string }> } };
  const names = (data.data?.departments ?? []).map((d) => d.name);
  if (!names.includes(a) || !names.includes(b)) throw new Error(`departments ${names.join(',')}`);
});

Then('default channels {string} and {string} exist', function (a: string, b: string) {
  const data = w(this).body as { data?: { channels?: Array<{ slug: string }> } };
  const slugs = (data.data?.channels ?? []).map((c) => `#${c.slug}`);
  if (!slugs.includes(a) || !slugs.includes(b)) throw new Error(`channels ${slugs.join(',')}`);
});

Then('a Discover profile stub exists', function () {
  const data = w(this).body as { data?: { discoverProfile?: { published?: boolean } } };
  if (!data.data?.discoverProfile || data.data.discoverProfile.published) {
    throw new Error('discover stub missing');
  }
});

Then('an invitation email was sent to {string}', function (email: string) {
  const found = w(this).harness!.mailer.sent.some((m) => m.to === email && /invited/i.test(m.subject));
  if (!found) throw new Error('invite email missing');
});

Then('{string} is a member of the current organization', function (email: string) {
  const member = w(this).harness!.orgs.memberships.find((m) => m.orgId === w(this).orgId && m.email === email);
  if (!member) throw new Error(`${email} not a member`);
});

Then('{string} is in channel {string}', function (email: string, channel: string) {
  const world = w(this);
  const member = world.harness!.orgs.memberships.find((m) => m.email === email && m.orgId === world.orgId);
  const slug = channel.replace('#', '');
  const ch = world.harness!.orgs.channels.find((c) => c.orgId === world.orgId && c.slug === slug);
  if (!member || !ch?.memberIds.includes(member.userId)) throw new Error(`${email} not in ${channel}`);
});

Then('{int} invitations were created', function (n: number) {
  const data = w(this).body as { data?: { invitations?: unknown[] } };
  if ((data.data?.invitations ?? []).length !== n) throw new Error(`expected ${n} invitations`);
});

Then('the department tree contains {string}', function (name: string) {
  const found = w(this).harness!.orgs.departments.some((d) => d.orgId === w(this).orgId && d.name === name);
  if (!found) throw new Error(`department ${name} missing`);
});

Then('the team list contains {string}', function (name: string) {
  const found = w(this).harness!.orgs.teams.some((t) => t.orgId === w(this).orgId && t.name === name);
  if (!found) throw new Error(`team ${name} missing`);
});

Then('my profile title is {string}', function (title: string) {
  const data = w(this).body as { data?: { title?: string } };
  if (data.data?.title !== title) throw new Error(JSON.stringify(w(this).body));
});

Then('my presence is {string}', function (presence: string) {
  const data = w(this).body as { data?: { presence?: string } };
  if (data.data?.presence !== presence) throw new Error(JSON.stringify(w(this).body));
});

Then('an upload URL is returned', function () {
  const data = w(this).body as { data?: { uploadUrl?: string } };
  if (!data.data?.uploadUrl) throw new Error('uploadUrl missing');
});

Then('the invitation policy is {string}', function (policy: string) {
  const data = w(this).body as { data?: { settings?: { invitationPolicy?: string } } };
  if (data.data?.settings?.invitationPolicy !== policy) throw new Error(JSON.stringify(w(this).body));
});

Then('an org settings audit event was recorded', function () {
  const found = w(this).harness!.audit.events.some((e) => e.type === 'org_settings_updated');
  if (!found) throw new Error('settings audit missing');
});

Then('the member list has {int} email {string}', function (n: number, email: string) {
  const data = w(this).body as { data?: Array<{ email?: string }> };
  const list = Array.isArray(data.data) ? data.data : [];
  if (list.length !== n || !list.some((m) => m.email === email)) {
    throw new Error(JSON.stringify(w(this).body));
  }
});
