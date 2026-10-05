import { expect, test, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function login(page: Page, username = 'operator') {
  await page.goto('/');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD ?? 'Local-demo-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

test('filters persist through details, reload and browser navigation', async ({ page }) => {
  await login(page);
  await page.getByLabel('Search company').fill('Nova');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/companySearch=Nova/);
  await expect(page.getByRole('table', { name: 'Submissions' })).toContainText(
    'Nova Health Systems',
  );
  await page.reload();
  await expect(page.getByLabel('Search company')).toHaveValue('Nova');
  await page
    .getByRole('table')
    .getByRole('link', { name: 'Nova Health Systems', exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Opportunity overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Company contacts' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page
    .getByRole('link', { name: /Download/ })
    .first()
    .click();
  expect((await download).suggestedFilename()).toMatch(/sample-document-.*.txt/);
  await page.getByRole('link', { name: 'Back to submissions' }).click();
  await expect(page.getByLabel('Search company')).toHaveValue('Nova');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page).not.toHaveURL(/companySearch/);
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('tab', { name: 'New', exact: true }).click();
  await expect(page).toHaveURL(/status=new/);
  await expect(page).not.toHaveURL(/page=2/);
});
test('advanced filtering and empty state', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Priority', exact: true }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/priority=high/);
  await expect(page.getByRole('table')).toContainText('High priority');
  await page.getByLabel('Search company').fill('not-a-company');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching records' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
});
test('error state, retry and missing record', async ({ page }) => {
  await login(page);
  await page.route('**/api/submissions/?*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"detail":"Test outage"}',
    }),
  );
  await page.goto('/submissions?companySearch=Nova');
  await expect(page.locator('.MuiAlert-root')).toContainText('Test outage');
  await page.unroute('**/api/submissions/?*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto('/submissions/999999');
  await expect(page.locator('.MuiAlert-root')).toContainText('could not be found');
});
test('mobile accessibility and navigation', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-cards')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.locator('.mobile-cards').getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Opportunity overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('desktop accessibility, session renewal and sign out', async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => !c.name.endsWith('_access')));
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
