import { expect, test } from '@playwright/test';
import { mailpitEnabled, waitForOtp } from './support/mailpit';

test('journey 1: register organization and set a team setting @journey-1', async ({ page }) => {
  const stamp = Date.now();
  const email = `sarah${stamp}@acme.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Sarah Chen');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('CorrectH0rse!');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Verify email' })).toBeVisible();

  const otp = await readOtp(page, email);
  await page.getByLabel('OTP').fill(otp);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL('**/orgs');
  await page.getByRole('link', { name: 'Create organization' }).click();
  await page.getByLabel('Name').fill('Acme');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('#general')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Invitation policy').fill('owner_only');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
});

/**
 * Against a deployment the code is collected from the inbox, the way a person
 * would. Locally the API is started with E2E_EXPOSE_OTP=1 and puts it on the
 * page, which avoids needing a mail server for the fast path.
 */
async function readOtp(page: import('@playwright/test').Page, email: string): Promise<string> {
  if (mailpitEnabled()) return waitForOtp(email);

  const otp = page.url().includes('otp=')
    ? new URL(page.url()).searchParams.get('otp') ?? ''
    : await page.getByLabel('OTP').inputValue();
  if (!otp) {
    throw new Error('No OTP available: start the API with E2E_EXPOSE_OTP=1, or set MAILPIT_URL to read mail.');
  }
  return otp;
}
