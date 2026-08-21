import { expect, test } from '@playwright/test';

type Json = Record<string, unknown>;
const apiBase = process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = async (
  request: import('@playwright/test').APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  accessToken: string,
  orgId?: string,
  body?: Json,
) => {
  const res = await request.fetch(`${apiBase}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(orgId ? { 'x-org-id': orgId } : {}),
      'content-type': 'application/json',
    },
    data: body,
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { res, json };
};

test('journey 10: manage departments, teams and roles @journey-10 @P0', async ({ page, request }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const ownerEmail = `owner${stamp}@acme.test`;
  const memberEmail = `member${stamp}@acme.test`;
  const password = 'CorrectH0rse!';

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Owner User');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Verify email' })).toBeVisible();
  const otp = page.url().includes('otp=')
    ? new URL(page.url()).searchParams.get('otp') ?? ''
    : await page.getByLabel('OTP').inputValue();
  if (!otp) throw new Error('OTP was not exposed; start API with E2E_EXPOSE_OTP=1');
  await page.getByLabel('OTP').fill(otp);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL('**/orgs');
  const ownerAccess = await page.evaluate(() => sessionStorage.getItem('zoqo.access') ?? '');
  if (!ownerAccess) throw new Error('owner access token missing from sessionStorage');

  const createOrg = await api(request, 'POST', '/v1/orgs', ownerAccess, undefined, {
    name: `Acme ${stamp}`,
    industry: 'Software',
    size: '11-50',
    country: 'BD',
    timezone: 'Asia/Dhaka',
  });
  expect(createOrg.res.status()).toBe(201);
  const orgId = ((createOrg.json.data as Json | undefined)?.organization as Json | undefined)?.id as string | undefined;
  expect(orgId).toBeTruthy();
  const resolvedOrgId = orgId as string;

  await page.evaluate((id) => sessionStorage.setItem('zoqo.org', id), resolvedOrgId);
  await page.goto(`/orgs/${resolvedOrgId}`);
  await expect(page.getByRole('heading', { name: 'Organization' })).toBeVisible();

  const createDept = await api(request, 'POST', `/v1/orgs/${resolvedOrgId}/departments`, ownerAccess, resolvedOrgId, {
    name: 'Engineering',
  });
  expect(createDept.res.status()).toBe(201);
  const deptId = ((createDept.json.data as Json | undefined)?.id as string | undefined) ?? '';
  expect(deptId).toBeTruthy();

  const createTeam = await api(request, 'POST', `/v1/orgs/${resolvedOrgId}/teams`, ownerAccess, resolvedOrgId, {
    departmentId: deptId,
    name: 'Platform',
  });
  expect(createTeam.res.status()).toBe(201);

  const registerMember = await request.fetch(`${apiBase}/v1/auth/register`, {
    method: 'POST',
    data: { name: 'Member User', email: memberEmail, password },
  });
  expect(registerMember.status()).toBe(201);
  const registerJson = (await registerMember.json()) as Json;
  const verificationCode = (((registerJson.data as Json | undefined)?.verificationCode as string | undefined) ?? '').trim();
  expect(verificationCode).toMatch(/^\d{6}$/);

  const verifyMember = await request.fetch(`${apiBase}/v1/auth/verify-email`, {
    method: 'POST',
    data: { email: memberEmail, otp: verificationCode },
  });
  expect(verifyMember.status()).toBe(200);

  const loginMember = await request.fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    data: { email: memberEmail, password },
  });
  expect(loginMember.status()).toBe(200);
  const loginMemberJson = (await loginMember.json()) as Json;
  const memberAccess = ((loginMemberJson.data as Json | undefined)?.accessToken as string | undefined) ?? '';
  const memberId = (((loginMemberJson.data as Json | undefined)?.user as Json | undefined)?.id as string | undefined) ?? '';
  expect(memberAccess).toBeTruthy();
  expect(memberId).toBeTruthy();

  const inviteMember = await api(request, 'POST', `/v1/orgs/${resolvedOrgId}/invite`, ownerAccess, resolvedOrgId, {
    emails: [memberEmail],
    role: 'member',
  });
  expect(inviteMember.res.status()).toBe(201);
  const invitations = ((inviteMember.json.data as Json | undefined)?.invitations as Json[] | undefined) ?? [];
  const inviteToken = ((invitations[0] as Json | undefined)?.token as string | undefined) ?? '';
  expect(inviteToken).toBeTruthy();

  const acceptInvite = await request.fetch(`${apiBase}/v1/orgs/invitations/accept`, {
    method: 'POST',
    headers: { authorization: `Bearer ${memberAccess}`, 'content-type': 'application/json' },
    data: { token: inviteToken },
  });
  expect(acceptInvite.status()).toBe(200);

  const promoteMember = await api(
    request,
    'PATCH',
    `/v1/orgs/${resolvedOrgId}/members/${memberId}`,
    ownerAccess,
    resolvedOrgId,
    {
    role: 'manager',
    departmentId: deptId,
    },
  );
  expect(promoteMember.res.status()).toBe(200);
  const promotedRole = ((promoteMember.json.data as Json | undefined)?.role as string | undefined) ?? '';
  expect(promotedRole).toBe('manager');

  const members = await api(request, 'GET', `/v1/orgs/${resolvedOrgId}/members`, ownerAccess, resolvedOrgId);
  expect(members.res.status()).toBe(200);
  const list = (members.json.data as Json[] | undefined) ?? [];
  const promoted = list.find((m) => m.userId === memberId) as Json | undefined;
  expect(promoted?.role as string | undefined).toBe('manager');

  const departments = await api(request, 'GET', `/v1/orgs/${resolvedOrgId}/departments`, ownerAccess, resolvedOrgId);
  expect(departments.res.status()).toBe(200);
  const deptList = (departments.json.data as Json[] | undefined) ?? [];
  expect(deptList.some((d) => d.name === 'Engineering')).toBeTruthy();

  const teams = await api(request, 'GET', `/v1/orgs/${resolvedOrgId}/teams`, ownerAccess, resolvedOrgId);
  expect(teams.res.status()).toBe(200);
  const teamList = (teams.json.data as Json[] | undefined) ?? [];
  expect(teamList.some((t) => t.name === 'Platform')).toBeTruthy();
});
