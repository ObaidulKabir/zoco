import { expect, test } from '@playwright/test';

test('home shell @smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Zoqo' })).toBeVisible();
});
