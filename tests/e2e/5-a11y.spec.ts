import { expect, test } from '@playwright/test';
import { expectAccessible, signIn } from './helpers';

test.describe('axe: zero serious or critical violations on every page', () => {
  test('public pages', async ({ page }) => {
    await page.goto('/encounters?outcome=converted');
    const enc = await page.locator('main ul a[href^="/e/"]').first().getAttribute('href');
    await page.goto('/');
    const schism = await page.goto('/faiths');
    expect(schism?.ok()).toBe(true);
    const pages = ['/', '/faiths', '/faiths?view=all', '/seasons/1', '/f/patient-kettle', '/f/patient-kettle/revisions', enc!, '/encounters', '/a/dolores', '/a/the-auditor', '/agents', '/signin', '/signin/check', '/dev/components', '/no-such-page'];
    for (const p of pages) {
      await page.goto(p);
      await expectAccessible(page, p);
    }
  });

  test('signed-in pages', async ({ page }) => {
    await signIn(page, 'slowboil@gospelwars.test', '/f/patient-kettle/edit');
    await expectAccessible(page, '/f/patient-kettle/edit');
    await page.goto('/f/final-spreadsheet/fork');
    await expectAccessible(page, '/f/final-spreadsheet/fork');
    await page.goto('/signout');
    await expectAccessible(page, '/signout');
  });

  test('write and admin', async ({ page }) => {
    await signIn(page, 'admin@gospelwars.test', '/admin');
    await expectAccessible(page, '/admin');
    await page.goto('/write');
    await expectAccessible(page, '/write');
  });

  test('phone layouts', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of ['/', '/faiths', '/f/patient-kettle', '/a/dolores']) {
      await page.goto(p);
      await expectAccessible(page, `${p} at 390`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
  });
});
