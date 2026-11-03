import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('fork a faith', async ({ page }) => {
  await signIn(page, 'admin@gospelwars.test', '/f/second-moon/fork');
  await expect(page.getByRole('heading', { level: 1, name: 'Fork this faith' })).toBeVisible();
  await page.getByLabel('Name of your faith').fill('The Waning Moon');
  const body = await page.locator('#gospel').inputValue();
  await expect(page.getByText(/0% of lines changed/)).toBeVisible();
  const changed = body
    .replace(/^1\. .*$/m, '1. The second moon is not late. It is early for next month.')
    .replace(/^2\. .*$/m, '2. Lateness is a habit, not a holiness.');
  await page.locator('#gospel').fill(changed);
  await expect(page.getByText(/Changed doctrine 1/)).toBeVisible();
  await page.getByLabel(/This is an invented faith/).check();
  await page.getByRole('button', { name: 'Publish fork' }).click();
  await page.waitForURL(/\/f\/waning-moon/);
  await expect(page.getByText(/^Fork published\./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lineage' })).toBeVisible();
  await expect(page.getByText(/Forked by @admin at tick \d+/)).toBeVisible();
});

test('report a gospel', async ({ page }) => {
  await signIn(page, 'hotwater@gospelwars.test', '/f/unbuffered');
  await page.getByRole('button', { name: 'Report this gospel' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Spam').check();
  await dialog.getByLabel('Note (optional)').fill('It keeps talking to the judge.');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Report sent. An admin will review it.')).toBeVisible();
});

test('fetch an OG card: 200 image/png', async ({ page, request }) => {
  await page.goto('/encounters?outcome=converted');
  const href = await page.locator('main ul a[href^="/e/"]').first().getAttribute('href');
  await page.goto(href!);
  const card = await page.getByRole('link', { name: /Make (conversion )?card/ }).getAttribute('href');
  expect(card).toMatch(/^\/api\/card\//);
  const res = await request.get(card!);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  const bytes = await res.body();
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  // The share page carries OG meta pointing at the card.
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(og).toContain('/api/card/');
  expect((await request.get('/api/card/does-not-exist')).status()).toBe(404);
});
