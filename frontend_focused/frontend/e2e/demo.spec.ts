import { test, expect } from '@playwright/test';
test.skip(
  !process.env.RECORD_DEMO,
  'Run explicitly with RECORD_DEMO=1 to record the review walkthrough.',
);
test.use({
  video: { mode: 'on', size: { width: 1440, height: 1000 } },
  viewport: { width: 1440, height: 1000 },
});
test('review walkthrough', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy'))
      errors.push(message.text());
  });
  await page.goto('/');
  await page.getByLabel('Username').fill('operator');
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD ?? 'Local-demo-2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

  await expect(page.getByRole('table', { name: 'Submissions' })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/submissions-list.png', fullPage: true });
  await page.waitForTimeout(2200);
  await page.getByRole('tab', { name: 'In review', exact: true }).click();
  await expect(page).toHaveURL(/status=in_review/);
  await page.waitForTimeout(1600);
  await page.getByLabel('Search company').fill('Nova');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/companySearch=Nova/);
  await page.waitForTimeout(1800);
  await page
    .getByRole('table')
    .getByRole('link', { name: 'Nova Health Systems', exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Opportunity overview' })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/submissions-detail.png', fullPage: true });
  await page.waitForTimeout(2200);
  const download = page.waitForEvent('download');
  await page
    .getByRole('link', { name: /Download/ })
    .first()
    .click();
  await download;
  await page.getByRole('heading', { name: 'Notes & activity' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(2200);
  await page.getByRole('link', { name: 'Back to submissions' }).click();
  await expect(page.getByLabel('Search company')).toHaveValue('Nova');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Priority', exact: true }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/priority=high/);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-cards')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../../docs/screenshots/submissions-mobile.png', fullPage: true });
  await page.waitForTimeout(1800);

  expect(errors).toEqual([]);
});
