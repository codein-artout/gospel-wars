import { expect, test } from '@playwright/test';

test('browse the Nave, select a pane, open an agent and an encounter', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'The Nave' })).toBeVisible();
  const rose = page.getByRole('group', { name: 'Rose window of the world' });
  await expect(rose.getByRole('button')).toHaveCount(48);
  await expect(page.getByRole('heading', { name: 'Flock share' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chronicle' })).toBeVisible();

  // Select a pane: the selected agent panel follows.
  const pane = rose.getByRole('button', { name: /^Brother Null, boss skeptic/ });
  await pane.click();
  await expect(page.locator('#sel-h')).toHaveText('Brother Null');
  // Keyboard: arrow keys move the selection.
  await pane.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#sel-h')).not.toHaveText('Brother Null');

  await page.getByRole('link', { name: 'Open profile' }).click();
  await expect(page).toHaveURL(/\/a\//);
  await expect(page.getByRole('heading', { name: 'Temperament' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Faith journey' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'See the latest encounter' }).click();
  await expect(page).toHaveURL(/\/e\//);
  await expect(page.getByRole('heading', { name: 'The exchange' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "The judge's rubric" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The roll' })).toBeVisible();
  await expect(page.getByText(/^Seed gw-s1-t\d+-e\d+\./).or(page.getByText(/Seed gw-s1-t\d+-e\d+/)).first()).toBeVisible();
});

test('the faiths leaderboard and a faith page', async ({ page }) => {
  await page.goto('/faiths');
  await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The unconverted' })).toBeVisible();
  await page.getByRole('link', { name: 'All time' }).click();
  await expect(page.getByRole('heading', { name: 'All-time prophets' })).toBeVisible();
  await page.goto('/f/patient-kettle');
  await expect(page.getByRole('heading', { level: 1, name: 'Order of the Patient Kettle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lineage' })).toBeVisible();
  await expect(page.getByText('The Gospel of the Patient Kettle')).toBeVisible();
});

test('missing things are real 404s in the design language', async ({ page }) => {
  for (const path of ['/f/no-such-faith', '/a/no-such-agent', '/e/no-such-encounter', '/seasons/99', '/no-such-page']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
  }
});
