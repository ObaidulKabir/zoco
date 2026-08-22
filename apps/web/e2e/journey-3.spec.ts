import { expect, test } from '@playwright/test';
import { mailpitEnabled, waitForOtp } from './support/mailpit';

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
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(orgId ? { 'x-org-id': orgId } : {}),
      'content-type': 'application/json',
    },
    data: body,
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { res, json };
};

test('journey 3: B2B cross-org connect, external messaging, and isolation @journey-3 @P0', async ({ request }) => {
  test.setTimeout(90_000);

  const stamp = Date.now();
  const acmeOwnerEmail = `rahim${stamp}@acme.test`;
  const tokyoOwnerEmail = `tanaka${stamp}@tokyo.test`;
  const password = 'CorrectH0rse!';

  // 1. Register and verify Acme owner through the API to avoid UI transport
  // assumptions; this journey validates B2B behavior, not auth page rendering.
  const acme = await registerAndVerify(request, {
    name: 'Rahim Acme',
    email: acmeOwnerEmail,
    password,
  });
  const acmeToken = acme.accessToken;

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

  // 2. Register Tokyo Corp owner
  const tokyo = await registerAndVerify(request, {
    name: 'Tanaka Tokyo',
    email: tokyoOwnerEmail,
    password,
  });
  const tokyoToken = tokyo.accessToken;
  const tokyoUserId = tokyo.userId;

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

async function registerAndVerify(
  request: import('@playwright/test').APIRequestContext,
  input: { name: string; email: string; password: string },
): Promise<{ accessToken: string; userId: string }> {
  const register = await api(request, 'POST', '/v1/auth/register', '', undefined, input);
  expect(register.res.status()).toBe(201);
  const embeddedOtp =
    ((register.json as any)?.data?.verificationCode as string | undefined) ??
    ((register.json as any)?.data?.otp as string | undefined) ??
    '';
  const otp = embeddedOtp || (mailpitEnabled() ? await waitForOtp(input.email) : '');
  if (!otp) {
    throw new Error('No OTP available: set MAILPIT_URL, or run local API with E2E_EXPOSE_OTP=1.');
  }

  const verify = await api(request, 'POST', '/v1/auth/verify-email', '', undefined, {
    email: input.email,
    otp,
  });
  expect([200, 201]).toContain(verify.res.status());
  const accessToken = ((verify.json as any)?.data?.accessToken as string) ?? '';
  const userId = ((verify.json as any)?.data?.user?.id as string) ?? '';
  expect(accessToken).toBeTruthy();
  expect(userId).toBeTruthy();
  return { accessToken, userId };
}
