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

  await expect(page.getByText('25', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/fleet-overview.png', fullPage: true });
  await page.waitForTimeout(2200);
  await page.getByRole('link', { name: 'View queue', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole('table').getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Maintenance history' })).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByRole('link', { name: 'Log service' }).click();
  await page.getByRole('combobox', { name: /Mechanic/ }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: /Service type/ }).click();
  await page.getByRole('option', { name: 'inspection', exact: true }).click();
  await page.getByLabel('Cost (USD)').fill('95.00');
  await page
    .getByLabel('Service notes')
    .fill('Demonstration: inspection completed and vehicle cleared for service.');
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Create record' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.waitForTimeout(1800);
  await page.getByRole('table').getByRole('link').first().click();
  await expect(
    page.getByText('Demonstration: inspection completed and vehicle cleared for service.'),
  ).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/fleet-detail.png', fullPage: true });
  await page.waitForTimeout(1800);
  await page.getByRole('link', { name: 'Manage service records' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Demonstration: inspection completed' });
  await row.getByRole('button', { name: /Delete maintenance/ }).click();
  await page.getByRole('button', { name: 'Delete record', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click();
  await page.getByLabel('Search vehicles').fill('Ford');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/search=Ford/);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '../../docs/screenshots/fleet-vehicles.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-cards')).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/fleet-mobile.png', fullPage: true });
  await page.waitForTimeout(1800);

  expect(errors).toEqual([]);
});
