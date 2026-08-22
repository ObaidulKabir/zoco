import { expect, test } from '@playwright/test';

type Json = Record<string, unknown>;
const apiBase = process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const api = async (
  request: import('@playwright/test').APIRequestContext,
  method: 'GET' | 'POST' | 'DELETE',
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

test('journey 3: B2B cross-org connect, external messaging, and isolation @journey-3 @P0', async ({ page, request }) => {
  test.setTimeout(90_000);

  const stamp = Date.now();
  const acmeOwnerEmail = `rahim${stamp}@acme.test`;
  const tokyoOwnerEmail = `tanaka${stamp}@tokyo.test`;
  const password = 'CorrectH0rse!';

  // 1. Register Acme Owner
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Rahim Acme');
  await page.getByLabel('Email').fill(acmeOwnerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Verify email' })).toBeVisible();
  const acmeOtp = page.url().includes('otp=')
    ? new URL(page.url()).searchParams.get('otp') ?? ''
    : await page.getByLabel('OTP').inputValue();
  if (!acmeOtp) throw new Error('Acme OTP not available');
  await page.getByLabel('OTP').fill(acmeOtp);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL('**/orgs');

  const acmeToken = await page.evaluate(() => sessionStorage.getItem('zoqo.access') ?? '');
  if (!acmeToken) throw new Error('acme access token missing');

  // Create Acme Corp
  const createAcmeOrg = await api(request, 'POST', '/v1/orgs', acmeToken, undefined, {
    name: `Acme Corp ${stamp}`,
    industry: 'Software',
    size: '11-50',
    country: 'BD',
    timezone: 'Asia/Dhaka',
  });
  expect(createAcmeOrg.res.status()).toBe(201);
  const acmeOrgId = ((createAcmeOrg.json as any)?.data?.organization?.id || (createAcmeOrg.json as any)?.data?.id) as string;
  expect(acmeOrgId).toBeTruthy();

  // 2. Register Tokyo Corp Owner via API
  const regTokyo = await api(request, 'POST', '/v1/auth/register', '', undefined, {
    name: 'Tanaka Tokyo',
    email: tokyoOwnerEmail,
    password,
  });
  expect(regTokyo.res.status()).toBe(201);
  const tokyoOtp = ((regTokyo.json as any)?.data?.otp as string) ?? '';

  const verTokyo = await api(request, 'POST', '/v1/auth/verify-email', '', undefined, {
    email: tokyoOwnerEmail,
    otp: tokyoOtp || '123456',
  });
  const tokyoToken = ((verTokyo.json as any)?.data?.accessToken as string) ?? '';
  const tokyoUserId = ((verTokyo.json as any)?.data?.user?.id as string) ?? '';

  const createTokyoOrg = await api(request, 'POST', '/v1/orgs', tokyoToken, undefined, {
    name: `Tokyo Corp ${stamp}`,
    industry: 'Manufacturing',
    size: '51-200',
    country: 'JP',
    timezone: 'Asia/Tokyo',
  });
  expect(createTokyoOrg.res.status()).toBe(201);
  const tokyoOrgId = ((createTokyoOrg.json as any)?.data?.organization?.id || (createTokyoOrg.json as any)?.data?.id) as string;
  expect(tokyoOrgId).toBeTruthy();

  // 3. Send B2B Connection Request from Acme to Tokyo Corp
  const sendConn = await api(request, 'POST', '/v1/b2b/connections', acmeToken, acmeOrgId, {
    receiverOrgId: tokyoOrgId,
    introMessage: 'We would like to establish a B2B supply chain sync channel.',
  });
  expect(sendConn.res.status()).toBe(201);
  const connId = ((sendConn.json as any)?.data?.id as string) ?? '';
  expect(connId).toBeTruthy();

  // 4. Tokyo Corp accepts the connection request
  const acceptConn = await api(request, 'POST', `/v1/b2b/connections/${connId}/accept`, tokyoToken, tokyoOrgId, {});
  expect(acceptConn.res.status()).toBe(200);

  // 5. Verify cross-org DM is now permitted
  const startDm = await api(request, 'POST', '/v1/messenger/conversations/dm', acmeToken, acmeOrgId, {
    recipientId: tokyoUserId,
  });
  expect(startDm.res.status()).toBe(201);
  const convId = ((startDm.json as any)?.data?.id as string) ?? '';
  expect(convId).toBeTruthy();

  // Send message from Acme to Tokyo Corp user
  const sendMsg = await api(request, 'POST', `/v1/messenger/conversations/${convId}/messages`, acmeToken, acmeOrgId, {
    contentCiphertext: 'b2b-secure-message-payload',
    envelopeIv: 'mock-iv',
    envelopeTag: 'mock-tag',
  });
  expect(sendMsg.res.status()).toBe(201);

  // 6. Cross-tenant isolation verification: Acme user cannot list Tokyo Corp channels
  const listTokyoChannels = await api(request, 'GET', '/v1/channels', acmeToken, tokyoOrgId);
  expect(listTokyoChannels.res.status()).toBe(403);

  // 7. Disconnect partner relation
  const disconnect = await api(request, 'DELETE', `/v1/b2b/connections/${connId}`, acmeToken, acmeOrgId);
  expect(disconnect.res.status()).toBe(200);
});
