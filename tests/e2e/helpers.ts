import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page, email: string, callbackUrl = '/'): Promise<void> {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.fill('#dev-email', email);
  await page.getByRole('button', { name: 'Sign in without a link' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'));
}

/** Zero serious or critical axe violations. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = bad.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 5).map((n) => `  ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n')}`).join('\n');
  expect(bad, `${label}\n${report}`).toEqual([]);
}

export async function firstHref(page: Page, selector: string): Promise<string> {
  const href = await page.locator(selector).first().getAttribute('href');
  if (!href) throw new Error(`No href for ${selector}`);
  return href;
}
