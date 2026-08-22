import { expect, test } from '@playwright/test';

type Json = Record<string, unknown>;
const apiBase = process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = async (
  request: import('@playwright/test').APIRequestContext,
  method: 'GET' | 'POST',
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

test('journey 2: dm send and offline replay @journey-2 @P0', async ({ page, request }) => {
  test.setTimeout(90_000);

  const stamp = Date.now();
  const ownerEmail = `rahim${stamp}@acme.test`;
  const peerEmail = `sarah${stamp}@acme.test`;
  const password = 'CorrectH0rse!';
  const dmText = `hello-offline-${stamp}`;

  // Owner self-signup through UI, same path as a user.
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Rahim Owner');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Verify email' })).toBeVisible();
  const ownerOtp = page.url().includes('otp=')
    ? new URL(page.url()).searchParams.get('otp') ?? ''
    : await page.getByLabel('OTP').inputValue();
  if (!ownerOtp) throw new Error('Owner OTP not available (E2E_EXPOSE_OTP likely disabled)');
  await page.getByLabel('OTP').fill(ownerOtp);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL('**/orgs');

  const ownerAccess = await page.evaluate(() => sessionStorage.getItem('zoqo.access') ?? '');
  if (!ownerAccess) throw new Error('owner access token missing');

  // Create org by API so we can deterministically capture the org id.
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

  // Create peer account (offline initially from journey perspective).
  const registerPeer = await request.fetch(`${apiBase}/v1/auth/register`, {
    method: 'POST',
    data: { name: 'Sarah Peer', email: peerEmail, password },
  });
  expect(registerPeer.status()).toBe(201);
  const registerPeerJson = (await registerPeer.json()) as Json;
  const peerOtp = (((registerPeerJson.data as Json | undefined)?.verificationCode as string | undefined) ?? '').trim();
  expect(peerOtp).toMatch(/^\d{6}$/);

  const verifyPeer = await request.fetch(`${apiBase}/v1/auth/verify-email`, {
    method: 'POST',
    data: { email: peerEmail, otp: peerOtp },
  });
  expect(verifyPeer.status()).toBe(200);

  const loginPeer = await request.fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    data: { email: peerEmail, password },
  });
  expect(loginPeer.status()).toBe(200);
  const loginPeerJson = (await loginPeer.json()) as Json;
  const peerAccess = ((loginPeerJson.data as Json | undefined)?.accessToken as string | undefined) ?? '';
  const peerUserId = (((loginPeerJson.data as Json | undefined)?.user as Json | undefined)?.id as string | undefined) ?? '';
  expect(peerAccess).toBeTruthy();
  expect(peerUserId).toBeTruthy();

  // Invite and accept so both members are in the same org.
  const invite = await api(request, 'POST', `/v1/orgs/${resolvedOrgId}/invite`, ownerAccess, resolvedOrgId, {
    emails: [peerEmail],
    role: 'member',
  });
  expect(invite.res.status()).toBe(201);
  const invitations = ((invite.json.data as Json | undefined)?.invitations as Json[] | undefined) ?? [];
  const inviteToken = ((invitations[0] as Json | undefined)?.token as string | undefined) ?? '';
  expect(inviteToken).toBeTruthy();

  const accept = await request.fetch(`${apiBase}/v1/orgs/invitations/accept`, {
    method: 'POST',
    headers: { authorization: `Bearer ${peerAccess}`, 'content-type': 'application/json' },
    data: { token: inviteToken },
  });
  expect(accept.status()).toBe(200);

  // DM conversation + encrypted message send by owner.
  const dm = await api(request, 'POST', '/v1/messenger/conversations/dm', ownerAccess, resolvedOrgId, {
    recipientId: peerUserId,
  });
  expect(dm.res.status()).toBe(201);
  const convId = ((dm.json.data as Json | undefined)?.id as string | undefined) ?? '';
  expect(convId).toBeTruthy();

  const ciphertext = Buffer.from(`cipher_${dmText}`).toString('base64');
  const send = await api(
    request,
    'POST',
    `/v1/messenger/conversations/${convId}/messages`,
    ownerAccess,
    resolvedOrgId,
    {
      contentCiphertext: ciphertext,
      envelopeIv: 'journey2_iv',
      envelopeTag: 'journey2_tag',
      contentType: 'text',
    },
  );
  expect(send.res.status()).toBe(201);

  // "Offline replay" proof: when peer comes online and fetches history, message is present.
  const history = await api(request, 'GET', `/v1/messenger/conversations/${convId}/messages`, peerAccess, resolvedOrgId);
  expect(history.res.status()).toBe(200);
  const rows = (history.json.data as Json[] | undefined) ?? [];
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.some((m) => (m.contentCiphertext as string | undefined) === ciphertext)).toBeTruthy();

  // UI sanity: peer can open DM screen with valid session/org context.
  await page.evaluate(
    ({ access, org }) => {
      localStorage.setItem('zoqo_access_token', access);
      sessionStorage.setItem('zoqo.access', access);
      sessionStorage.setItem('zoqo.org', org);
    },
    { access: peerAccess, org: resolvedOrgId },
  );
  await page.goto(`/orgs/${resolvedOrgId}/messages`);
  await expect(page.getByRole('heading', { name: 'Direct Messages' })).toBeVisible();
});

