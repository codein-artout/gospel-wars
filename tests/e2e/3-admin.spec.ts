import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('as admin, advance a tick and see the chronicle update', async ({ page }) => {
  await signIn(page, 'admin@gospelwars.test', '/');
  const medallion = page.getByRole('group', { name: 'Rose window of the world' }).locator('span.font-display');
  const before = Number(await medallion.innerText());
  await page.getByRole('button', { name: 'Advance tick' }).first().click();
  await expect(page.getByText(new RegExp(`^Tick ${before + 1} done\\.`))).toBeVisible({ timeout: 30_000 });
  await expect(medallion).toHaveText(String(before + 1));
  const firstRow = page.locator('#chron-h').locator('xpath=../..').locator('li').first();
  await expect(firstRow).toContainText(`Tick ${before + 1}`);
});

test('non-admins do not see the Advance tick button or the admin console', async ({ page }) => {
  await signIn(page, 'slowboil@gospelwars.test', '/');
  await expect(page.getByRole('button', { name: 'Advance tick' })).toHaveCount(0);
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);
});
